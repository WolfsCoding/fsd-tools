import { useEffect, useRef } from "react"
import { useNavigate } from "react-router"
import { ChargesInput } from "@/features/case-files/charges-input"
import { casePath, templateGroups } from "@/features/case-files/kind"
import { withNow } from "@/features/case-files/markdown"
import { POLICE_FILES_KIND, usePoliceFiles } from "@/features/case-files/police-files"
import { createReader, missingRequired, type Field, type Template, type TextField } from "@/features/case-files/templates"
import type { Row, Values } from "@/features/case-files/types"
import { caseFileTitle, useColors, useOwnIdentity } from "@/features/case-files/use-case-files"
import { useDnaEntries } from "@/features/dna-db/use-dna-entries"
import { books } from "@/features/law-book/data/books"
import { citation, formatFine, matchesParagraph, OFFENSES, parseQuery, penaltyNotes, type Offense } from "@/features/law-book/offenses"
import { lawBookPath } from "@/features/law-book/paths"
import { ApiError, desktop } from "@/lib/desktop"

// Answers the desktop shell's local API (electron/api.cjs), e.g. for the Raycast extension in
// `raycast/`. Its routes and what they return are listed in raycast/README.md.

const kind = POLICE_FILES_KIND

/** A field as the API describes it; fields the API can't fill (automatic ones, custom inputs) are left out. */
type ApiField =
  | { type: "text"; key: string; label: string; hint?: string; required?: boolean; placeholder: string; default?: string; suggestions?: string[] }
  | { type: "list"; key: string; label: string; hint?: string; required?: boolean; placeholder: string }
  | { type: "datetime"; key: string; label: string; hint?: string; required?: boolean }
  | { type: "checks"; key: string; label: string; hint?: string; required?: boolean; options: string[]; inline: ApiField[] }
  | {
      type: "table"
      key: string
      label: string
      hint?: string
      required?: boolean
      columns: { key: string; label: string; placeholder: string; choices?: string[] }[]
    }
  | { type: "charges"; key: string; label: string; hint?: string; required?: boolean }

function describeField(f: Field, me: string): ApiField | undefined {
  const base = { key: f.key, label: f.label, hint: f.hint, required: f.required }
  switch (f.type) {
    case "text":
      return describeText(f, me)
    case "list":
      return { ...base, type: "list", placeholder: f.fallback }
    case "datetime":
      return { ...base, type: "datetime" }
    case "checks":
      return {
        ...base,
        type: "checks",
        options: f.options,
        inline: (f.inline ?? []).map((i) => describeText(i, me)),
      }
    case "table":
      return {
        ...base,
        type: "table",
        columns: f.columns
          .filter((c) => !c.traces && !c.parts)
          .map((c) => ({ key: c.key, label: c.label, placeholder: c.fallback, choices: c.choices?.map((x) => x.value) })),
      }
    case "custom":
      return f.component === ChargesInput ? { ...base, type: "charges" } : undefined
    case "choice":
      return undefined
  }
}

function describeText(f: TextField, me: string) {
  return {
    type: "text" as const,
    key: f.key,
    label: f.label,
    hint: f.hint,
    required: f.required,
    placeholder: f.fallback ?? "N/A",
    default: f.me ? me : undefined,
    suggestions: f.suggestions,
  }
}

function describeTemplate(t: Template<string>, group: string, me: string) {
  return {
    id: t.id,
    label: t.label,
    emoji: t.emoji,
    description: t.description,
    group,
    sections: t.sections.map((s) => ({
      title: s.title,
      description: s.description,
      fields: s.fields.flatMap((f) => describeField(f, me) ?? []),
    })),
  }
}

function describeOffense(o: Offense) {
  return {
    id: o.id,
    ref: o.ref,
    title: o.title,
    book: o.book.abbreviation,
    fine: o.fine ? formatFine(o.fine) : undefined,
    notes: penaltyNotes(o),
    excerpt: o.excerpt,
  }
}

/** The API's values as stored by the app: table rows and charges get their ids. */
function toValues(template: Template<string>, input: unknown): Values {
  if (typeof input !== "object" || input === null) throw new ApiError(400, "`values` fehlt.")
  const fields = new Map(template.sections.flatMap((s) => s.fields).map((f) => [f.key, f]))
  const values: Values = {}
  for (const [key, value] of Object.entries(input)) {
    const f = fields.get(key)
    if (f?.type === "custom" && f.component === ChargesInput && Array.isArray(value)) {
      values[key] = value.filter((id) => typeof id === "string").map((offense) => ({ id: crypto.randomUUID(), offense }))
    } else if (f?.type === "table" && Array.isArray(value)) {
      values[key] = value.filter((r): r is Row => typeof r === "object" && r !== null).map((r) => ({ id: crypto.randomUUID(), ...r }))
    } else if (typeof value === "string" || (Array.isArray(value) && value.every((v) => typeof v === "string"))) {
      values[key] = value
    }
  }
  return values
}

export function DesktopApi() {
  const files = usePoliceFiles()
  const { identity } = useOwnIdentity()
  const { colors } = useColors()
  const { entries } = useDnaEntries()
  const navigate = useNavigate()
  // The handler is registered once and reads the latest state from here.
  const state = useRef({ files, identity, colors, entries, navigate })
  useEffect(() => {
    state.current = { files, identity, colors, entries, navigate }
  })

  useEffect(() => {
    if (!desktop) return
    return desktop.serveApi((route, body) => {
      const { files, identity, colors, entries, navigate } = state.current
      const me = identity.full

      switch (route) {
        case "/status":
          return { me, department: identity.department }

        case "/templates":
          return templateGroups(kind).flatMap((g) => g.templates.map((t) => describeTemplate(t, g.label, me)))

        case "/documents": {
          const template = kind.templates[String(body.template)]
          if (!template?.standalone) throw new ApiError(404, `Unbekannte Vorlage: ${body.template}`)
          const values = { ...structuredClone(template.initial ?? {}), ...toValues(template, body.values) }
          const reader = createReader(template, values, me, colors, identity.department, entries)
          const markdown = withNow(template.render(reader))
          const missing = missingRequired(template, reader)
          if (body.save === false) return { markdown, missing }

          const id = files.createCaseFile(template.id, values)
          const at = new Date().toISOString()
          const title = caseFileTitle(
            { id, title: "", docs: [{ id, template: template.id, values }], createdAt: at, updatedAt: at },
            me,
            kind.templates,
          )
          const path = casePath(kind, id)
          if (body.open) navigate(path)
          return { id, title, path, markdown, missing }
        }

        case "/offenses":
          return OFFENSES.map(describeOffense)

        case "/law-book/search": {
          const terms = parseQuery(String(body.q ?? ""))
          return books.flatMap((book) =>
            book.chapters.flatMap((chapter) =>
              chapter.paragraphs
                .filter((p) => matchesParagraph(book, p, terms))
                .map((p) => ({
                  book: { id: book.id, title: book.title, abbreviation: book.abbreviation },
                  chapter: chapter.title,
                  number: p.number,
                  title: p.title,
                  citation: citation(book, p),
                  sections: p.sections.map((text, i) => ({ citation: citation(book, p, i), text })),
                  offenses: OFFENSES.filter((o) => o.paragraph === p).map(describeOffense),
                  path: lawBookPath(book.id, p.number),
                })),
            ),
          )
        }

        case "/open": {
          const path = String(body.path ?? "")
          if (!path.startsWith("/")) throw new ApiError(400, "`path` muss mit / beginnen.")
          navigate(path)
          return null
        }

        default:
          throw new ApiError(404, `Unbekannte Route: ${route}`)
      }
    })
  }, [])

  return null
}
