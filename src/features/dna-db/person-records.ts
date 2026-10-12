// What the Akten record about one entry: the charges against them and the statements they
// gave or are named in. Read straight from the stored case files, like `case-file-mentions`.

import { useMemo } from "react"
import { chargeEntries, fineOf, totalOf, type Charge, type UnknownCharge } from "@/features/case-files/charges"
import { ChargesInput } from "@/features/case-files/charges-input"
import { code } from "@/features/case-files/markdown"
import { caseFilePath } from "@/features/case-files/paths"
import { POLICE_FILES_KEY, POLICE_FILES_KIND } from "@/features/case-files/police-files"
import { listItems, tableRows, templateFields, type Template } from "@/features/case-files/templates"
import type { CaseFile, Doc } from "@/features/case-files/types"
import { docName, useOwnName } from "@/features/case-files/use-case-files"
import { formatFine, needsQuantity, quantityLabel } from "@/features/law-book/offenses"
import { formatDate } from "@/lib/format-date"
import { useLocalStorage } from "@/lib/local-storage"
import { matchesWord, textKey } from "@/lib/text"
import { caseFileMentionTitle, mentionsOf, useCaseFileMentions, type CaseFileMention } from "./case-file-mentions"
import type { DnaEntry } from "./types"
import { entryName } from "./use-dna-entries"

const NO_CASE_FILES: CaseFile<string>[] = []

/** Field of the statement's text; documents with it are statements. */
const STATEMENT_KEY = "aussage"
/** Fields naming who gave a statement, e.g. the witness or the officer. */
const SPEAKER_KEYS = ["name", "von"]
/** Field of the date in the documents that have one. */
const DATE_KEY = "datum"
/** A value of a datetime-local input, e.g. "2026-10-02T14:30". */
const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/

/** Where an item was found: the Akte and the document in it. */
export interface RecordSource {
  caseFileId: string
  caseFileTitle: string
  /** The document's name in the Akte, e.g. "Zeugenaussage" or the suspect's name. */
  docLabel: string
  /** Opens the Akte on that document. */
  path: string
  /** Date of the document, else of the Akte's main document, else when the Akte was created. */
  date: string
}

export interface PersonCharge extends RecordSource {
  charge: Charge | UnknownCharge
}

export interface PersonStatement extends RecordSource {
  /** Gave it themselves, or are named in it (e.g. in an officer's statement). */
  role: "given" | "mentioned"
  /** How the statement calls them, e.g. "BES"; only for mentions that say so. */
  as?: string
  lines: string[]
}

export interface PersonRecords {
  mentions: CaseFileMention[]
  charges: PersonCharge[]
  statements: PersonStatement[]
}

/** Whether a typed value is the entry: its name, DNA-ID or fingerprint ID. */
function matcher(entry: DnaEntry) {
  const keys = new Set([entry.name, entry.dnaId, entry.fingerprintId].map(textKey).filter(Boolean))
  return (value: unknown) => typeof value === "string" && keys.has(textKey(value))
}

function dateOf(doc: Doc<string>, caseFile: CaseFile<string>) {
  for (const value of [doc.values[DATE_KEY], caseFile.docs[0]?.values[DATE_KEY]]) {
    if (typeof value === "string" && LOCAL_DATE.test(value)) return value
  }
  return caseFile.createdAt
}

/** The values of the suspects' fields of a document, e.g. the name of a suspect's statement. */
function suspectValues(template: Template<string>, doc: Doc<string>) {
  const values: string[] = []
  for (const f of templateFields(template)) {
    const value = doc.values[f.key]
    if (f.type === "text" && f.group === "suspect" && typeof value === "string" && value.trim()) values.push(value)
    if (f.type !== "table") continue
    // Columns whose cells are suspects only in some rows, e.g. the people called "BES".
    for (const c of f.columns) {
      if (!c.group) continue
      for (const row of tableRows(value)) {
        const group = typeof c.group === "function" ? c.group(row) : c.group
        if (group === "suspect" && row[c.key]?.trim()) values.push(row[c.key])
      }
    }
  }
  return values
}

/**
 * The charges recorded against the entry and the statements they gave or are named in, newest
 * first. A document's charges are theirs when its suspect is them (a Beschuldigten-Bericht);
 * a document without a suspect of its own (a Strafakte) charges the Akte's suspect, so it
 * counts when they are the only one the Akte names.
 */
export function usePersonRecords(entry: DnaEntry | undefined): PersonRecords {
  const [caseFiles] = useLocalStorage(POLICE_FILES_KEY, NO_CASE_FILES)
  const me = useOwnName()
  const entries = useMemo(() => (entry ? [entry] : []), [entry])
  const mentionMap = useCaseFileMentions(entries)

  return useMemo(() => {
    if (!entry) return { mentions: [], charges: [], statements: [] }
    const mentions = mentionsOf(mentionMap, entry)
    const isEntry = matcher(entry)
    const words = [entry.name, entry.dnaId, entry.fingerprintId].filter((v) => v.trim())
    const templates = POLICE_FILES_KIND.templates
    const charges: PersonCharge[] = []
    const statements: PersonStatement[] = []

    for (const caseFile of caseFiles) {
      const docs = caseFile.docs.filter((d) => templates[d.template])
      const suspects = docs.flatMap((d) => suspectValues(templates[d.template], d))
      const onlySuspect = suspects.some(isEntry) && suspects.every(isEntry)

      for (const doc of docs) {
        const template = templates[doc.template]
        const fields = templateFields(template)
        const source = (): RecordSource => ({
          caseFileId: caseFile.id,
          caseFileTitle: caseFileMentionTitle(caseFile, me),
          docLabel: docName(doc, me, templates, docs),
          path: `${caseFilePath(caseFile.id)}?doc=${doc.id}`,
          date: dateOf(doc, caseFile),
        })

        const chargeField = fields.find((f) => f.type === "custom" && f.component === ChargesInput)
        if (chargeField) {
          const own = suspectValues(template, doc)
          if (own.length ? own.some(isEntry) : onlySuspect) {
            const at = source()
            for (const charge of chargeEntries(doc.values[chargeField.key])) charges.push({ ...at, charge })
          }
        }

        const statementField = fields.find((f) => f.key === STATEMENT_KEY && f.type === "list")
        if (!statementField) continue
        const lines = listItems(doc.values[STATEMENT_KEY]).filter((l) => l.trim())
        // A report without its optional statement isn't one; a statement document is, even while empty.
        if (!lines.length && !statementField.required) continue
        if (SPEAKER_KEYS.some((k) => isEntry(doc.values[k]))) {
          statements.push({ ...source(), role: "given", lines })
          continue
        }
        // Named in a table of the statement (e.g. "nachfolgend als BES bezeichnet"), else in its text.
        const named = fields.flatMap((f) =>
          f.type === "table" ? tableRows(doc.values[f.key]).filter((row) => f.columns.some((c) => isEntry(row[c.key]))) : [],
        )[0]
        if (named || lines.some((l) => words.some((w) => matchesWord(l, w)))) {
          statements.push({ ...source(), role: "mentioned", as: named?.als?.trim() || undefined, lines })
        }
      }
    }

    const newestFirst = (a: RecordSource, b: RecordSource) => b.date.localeCompare(a.date)
    // Stable sort: the charges of one document keep their order.
    return { mentions, charges: charges.sort(newestFirst), statements: statements.sort(newestFirst) }
  }, [caseFiles, entry, me, mentionMap])
}

/** The charge's offense as a short text, e.g. "Betäubungsmittel (Einheit: 25)". */
export function chargeTitle(c: Charge) {
  return needsQuantity(c.offense) ? `${c.offense.title} (${quantityLabel(c.offense)}: ${c.quantity})` : c.offense.title
}

/** The charge's penalty, e.g. "3.500 – 6.500 $ + Haft"; "--" without one. */
export function chargePenalty(c: Charge) {
  const fine = fineOf(c)
  return [fine && formatFine(fine), c.offense.other].filter(Boolean).join(" + ") || "--"
}

/** The penalties of all charges added up, e.g. "7.000 – 13.000 $ + Haft"; "" without known ones. */
export function chargesTotal(charges: PersonCharge[]) {
  const known = charges.map((c) => c.charge).filter((c): c is Charge => !!c.offense)
  if (!known.length) return ""
  const { fine, other, hasFine } = totalOf(known)
  return [hasFine && formatFine(fine), ...other].filter(Boolean).join(" + ")
}

/** e.g. "Aussage von", "Erwähnt als BES". */
export function statementRole(s: PersonStatement) {
  if (s.role === "given") return "Aussage von"
  return s.as ? `Erwähnt als ${s.as}` : "Erwähnt"
}

/** A table cell; pipes and line breaks would end it early. */
const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ")

/** Everything known about the entry as Markdown, for pasting elsewhere. */
export function personSummary(entry: DnaEntry, { mentions, charges, statements }: PersonRecords) {
  const facts: [string, string | undefined][] = [
    ["DNA-ID", entry.dnaId && code(entry.dnaId)],
    ["Fingerabdruck-ID", entry.fingerprintId && code(entry.fingerprintId)],
    ["Tags", entry.tags?.map((t) => t.name).join(", ")],
    ["Aktennummern", entry.caseNumbers?.map(code).join(", ")],
  ]
  const blocks = [
    `## ${entryName(entry)}`,
    facts
      .filter(([, value]) => value)
      .map(([label, value]) => `- **${label}:** ${value}`)
      .join("\n") || "_Keine IDs hinterlegt_",
  ]

  blocks.push(`### Akten (${mentions.length})`, mentions.map((m) => `- ${m.title}`).join("\n") || "_Keine_")

  const rows = charges.map(({ charge: c, date, caseFileTitle }) =>
    c.offense
      ? [formatDate(date), c.offense.ref, chargeTitle(c), chargePenalty(c), caseFileTitle]
      : [formatDate(date), c.row.offense || "--", "Unbekannte Straftat (nicht im Gesetzbuch)", "--", caseFileTitle],
  )
  const total = chargesTotal(charges)
  blocks.push(
    `### Straftaten (${charges.length})`,
    rows.length
      ? [
          "| Datum | Paragraph | Tatbestand | Strafmaß | Akte |",
          "| --- | --- | --- | --- | --- |",
          ...rows.map((r) => `| ${r.map(cell).join(" | ")} |`),
          ...(total ? ["", `**Gesamt:** ${code(total)}`] : []),
        ].join("\n")
      : "_Keine_",
  )

  blocks.push(
    `### Aussagen (${statements.length})`,
    statements
      .map((s) =>
        [
          `**${formatDate(s.date)} · ${statementRole(s)}** · ${s.docLabel} (${s.caseFileTitle})`,
          ...(s.lines.length ? s.lines.map((l) => `- ${l.replace(/^[-*]\s+/, "")}`) : ["_Ohne Text_"]),
        ].join("\n"),
      )
      .join("\n\n") || "_Keine_",
  )
  return blocks.join("\n\n")
}
