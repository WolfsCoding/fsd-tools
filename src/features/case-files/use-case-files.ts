import { useCallback, useMemo } from "react"
import { useLocalStorage } from "@/lib/local-storage"
import { sameText, textKey } from "@/lib/text"
import type { CaseFileKind } from "./kind"
import { DEFAULT_COLORS, DEFAULT_DEPARTMENT, type Colors } from "./markdown"
import { createReader, SUGGESTION_GROUPS, templateFields, TEMPLATES, type SuggestionGroup } from "./templates"
import type { CaseFile, Doc, Row, Value, Values } from "./types"

/** Own name and rank; together (`Rang Name`) they replace `{{ME}}` in the templates. */
export const ME_KEY = "akten:me"
export const ME_RANK_KEY = "akten:me-rank"
/** Own department; replaces `{{DEPARTMENT}}`, e.g. in the header. */
export const DEPARTMENT_KEY = "akten:department"
/** Colors of the markdown. */
export const COLORS_KEY = "akten:colors"
const NO_CASE_FILES: CaseFile[] = []
const NO_NAME = ""
const NO_COLORS: Partial<Colors> = {}

/** Checks imported data before it replaces the own settings and the case files under `caseFileKeys`. */
export function isValidCaseFilesData(data: Record<string, unknown>, caseFileKeys: string[]) {
  const me = data[ME_KEY]
  const rank = data[ME_RANK_KEY]
  const department = data[DEPARTMENT_KEY]
  const colors = data[COLORS_KEY] as Record<string, unknown> | undefined
  return (
    (colors === undefined ||
      (typeof colors === "object" && colors !== null && Object.values(colors).every((c) => typeof c === "string"))) &&
    (me === undefined || typeof me === "string") &&
    (rank === undefined || typeof rank === "string") &&
    (department === undefined || typeof department === "string") &&
    caseFileKeys.every((k) => isValidCaseFiles(data[k]))
  )
}

/** Whether `value` (imported data) is a list of case files; missing counts as valid. */
export function isValidCaseFiles(value: unknown) {
  return value === undefined || (Array.isArray(value) && value.every(isCaseFile))
}

function isCaseFile(value: unknown): value is CaseFile<string> {
  if (typeof value !== "object" || value === null) return false
  const v = value as Record<string, unknown>
  return (
    ["id", "title", "createdAt", "updatedAt"].every((k) => typeof v[k] === "string") &&
    (v.settled === undefined || typeof v.settled === "boolean") &&
    Array.isArray(v.docs) &&
    v.docs.length > 0 &&
    v.docs.every(
      (d) =>
        typeof d?.id === "string" &&
        // Templates that were removed since are allowed; their documents just aren't shown.
        typeof d.template === "string" &&
        typeof d.values === "object" &&
        d.values !== null,
    )
  )
}

/** Who is filling in the case files, from the settings. */
export interface Identity {
  name: string
  rank: string
  /** "Officer I Ryan Shaw": rank and name, which replace `{{ME}}`. */
  full: string
  /** Replaces `{{DEPARTMENT}}`; the default department while none is set. */
  department: string
}

export function useOwnIdentity() {
  const [name, setName] = useLocalStorage(ME_KEY, NO_NAME)
  const [rank, setRank] = useLocalStorage(ME_RANK_KEY, NO_NAME)
  const [department, setDepartment] = useLocalStorage(DEPARTMENT_KEY, NO_NAME)
  const full = [rank.trim(), name.trim()].filter(Boolean).join(" ")
  const ownDepartment = department.trim() || DEFAULT_DEPARTMENT
  const identity = useMemo<Identity>(
    () => ({ name: name.trim(), rank: rank.trim(), full, department: ownDepartment }),
    [name, rank, full, ownDepartment],
  )
  // `name`, `rank` and `department` are kept as typed so inputs don't lose spaces while typing.
  return { identity, name, rank, department, setName, setRank, setDepartment }
}

/** The markdown colors from the settings; unset ones keep their default. */
export function useColors() {
  const [stored, setStored] = useLocalStorage<Partial<Colors>>(COLORS_KEY, NO_COLORS)
  const colors = useMemo<Colors>(
    () => ({
      heading: stored.heading?.trim() || DEFAULT_COLORS.heading,
    }),
    [stored],
  )
  const setColor = useCallback(
    (key: keyof Colors, value: string) => setStored((prev) => ({ ...prev, [key]: value })),
    [setStored],
  )
  return { colors, stored, setColor }
}

/** Rank and name together, e.g. "Officer I Ryan Shaw"; "" while neither is set. */
export function useOwnName() {
  return useOwnIdentity().identity.full
}

type Templates = CaseFileKind["templates"]

function plainDocName(d: Doc<string>, me: string, templates: Templates) {
  const t = templates[d.template]
  return d.title?.trim() || t.subject(createReader(t, d.values, me)) || t.label
}

/**
 * The document's own title, else who or what it is about, else the template name. With the
 * case file's `docs`, documents of the same name are numbered, e.g. "Blutanalyse 2".
 */
export function docName(d: Doc<string>, me: string, templates: Templates = TEMPLATES, docs?: Doc<string>[]) {
  const name = plainDocName(d, me, templates)
  const same = docs?.filter((x) => sameText(plainDocName(x, me, templates), name)) ?? []
  return same.length > 1 ? `${name} ${same.indexOf(d) + 1}` : name
}

/** `docName` behind the template's emoji, e.g. "🔴 Max Mustermann". */
export function docLabel(d: Doc<string>, me: string, templates: Templates = TEMPLATES, docs?: Doc<string>[]) {
  return `${templates[d.template].emoji} ${docName(d, me, templates, docs)}`
}

/** Field of the case number, e.g. of the analyses; the automatic title ends with it. */
const CASE_NUMBER_KEY = "fallnummer"
/** How many suspects the automatic title names; the others are counted. */
const TITLE_SUSPECTS = 2

/**
 * The title, else one made from the main document: the template, what it is about, the
 * suspects named in any of its documents and the case number, e.g. "Strafakte – Davis Street
 * – John Doe – #1234".
 */
export function caseFileTitle(caseFile: CaseFile<string> | undefined, me: string, templates: Templates = TEMPLATES) {
  if (!caseFile) return "Akte"
  if (caseFile.title.trim()) return caseFile.title.trim()
  const main = caseFile.docs[0]
  const t = templates[main.template]
  const subject = (t.caseSubject ?? t.subject)(createReader(t, main.values, me))
  let number = ""
  const suspects: string[] = []
  for (const d of caseFile.docs) {
    const dt = templates[d.template]
    if (!dt) continue
    const r = createReader(dt, d.values, me)
    for (const f of templateFields(dt)) {
      if (f.type !== "text") continue
      const value = r.filled(f.key)
      if (!value) continue
      if (f.key === CASE_NUMBER_KEY) number ||= value
      else if (f.group === "suspect" && !sameText(value, subject) && !suspects.some((x) => sameText(x, value)))
        suspects.push(value)
    }
  }
  const more = suspects.length - TITLE_SUSPECTS
  return [
    t.label,
    subject,
    suspects.slice(0, TITLE_SUSPECTS).join(", ") + (more > 0 ? ` +${more}` : ""),
    number && `#${number.replace(/^#/, "")}`,
  ]
    .filter(Boolean)
    .join(" – ")
}

/** Everything entered in a case file as one text, for searching it. */
export function caseFileText(caseFile: CaseFile<string>) {
  const texts: string[] = []
  const add = (value: unknown) => {
    if (typeof value === "string") texts.push(value)
    else if (Array.isArray(value)) value.forEach(add)
    else if (typeof value === "object" && value !== null) Object.values(value).forEach(add)
  }
  for (const d of caseFile.docs) {
    add(d.title)
    add(d.values)
  }
  return texts.join("\n")
}

/** An entered value and every field it was entered in, so a field never suggests its own value. */
export interface Suggestion {
  value: string
  sources: string[]
}

/** A remembered table row, merged from every row with the same identifying value. */
export interface KnownRow {
  row: Row
  sources: string[]
}

export interface Suggestions {
  groups: Record<SuggestionGroup, Suggestion[]>
  /** Rows of tables with `remember`, by table key. */
  rows: Record<string, KnownRow[]>
  /** Earlier values of autocompleted columns, by `tableKey.columnKey`. */
  columns: Record<string, Suggestion[]>
}

/** Identifies a field (or a table cell) as the source of a suggestion. */
export function sourceId(docId: string, key: string, rowId?: string, column?: string) {
  return [docId, key, rowId, column].filter(Boolean).join(":")
}

/** The values of `list` that were also entered somewhere other than `source`. */
export function offered<T extends { sources: string[] }>(list: T[], source: string) {
  return list.filter((s) => s.sources.some((x) => x !== source))
}

/** Values that only stand in for a missing one and are never worth suggesting. */
const NOT_A_VALUE = new Set(["---", "xxx", "nicht gewollt"])

/**
 * Everything entered for each suggestion group, from the open case file first, then the
 * others (newest first). People also include the own name.
 */
export function collectSuggestions(
  caseFiles: CaseFile<string>[],
  currentId: string,
  me: Identity,
  templates: Templates = TEMPLATES,
): Suggestions {
  const groups = Object.fromEntries(SUGGESTION_GROUPS.map((g) => [g, new Map()])) as Record<
    SuggestionGroup,
    Map<string, Suggestion>
  >
  const columns: Record<string, Map<string, Suggestion>> = {}
  const known: Record<string, Map<string, KnownRow>> = {}
  const clean = (value: unknown) => {
    if (typeof value !== "string") return ""
    const v = value.trim()
    return v && !v.includes("{{") && !NOT_A_VALUE.has(textKey(v)) ? v : ""
  }
  const put = (map: Map<string, Suggestion>, value: unknown, source: string) => {
    const v = clean(value)
    if (!v) return
    const entry = map.get(textKey(v))
    if (entry) entry.sources.push(source)
    else map.set(textKey(v), { value: v, sources: [source] })
  }
  const add = (group: SuggestionGroup, value: unknown, source: string) => put(groups[group], value, source)

  add("officer", me.full, "me")
  // Tables with an own row (e.g. the patrol) know the own name with its rank from the start.
  for (const t of Object.values(templates)) {
    for (const f of templateFields(t)) {
      if (f.type !== "table" || !f.remember || !f.ownRow || !me.name) continue
      const row = f.ownRow(me)
      ;(known[f.key] ??= new Map()).set(textKey(me.name), { row, sources: ["me"] })
    }
  }
  const ordered = [...caseFiles.filter((a) => a.id === currentId), ...caseFiles.filter((a) => a.id !== currentId)]
  for (const caseFile of ordered) {
    for (const d of caseFile.docs) {
      const t = templates[d.template]
      if (!t) continue
      for (const f of templateFields(t)) {
        if (f.type === "text" && f.group) add(f.group, d.values[f.key], sourceId(d.id, f.key))
        if (f.type !== "table") continue
        const rows = d.values[f.key]
        if (!Array.isArray(rows)) continue
        rows.forEach((row, i) => {
          if (typeof row !== "object") return
          const rowId = row.id ?? String(i)
          for (const c of f.columns) {
            if (c.autocomplete) put((columns[`${f.key}.${c.key}`] ??= new Map()), row[c.key], sourceId(d.id, f.key, rowId, c.key))
            const group = typeof c.group === "function" ? c.group(row) : c.group
            if (!group || !clean(row[c.key])) continue
            // e.g. "Officer I Ryan Shaw" from a patrol row, as people are named elsewhere.
            const value = [c.groupPrefix && clean(row[c.groupPrefix]), row[c.key]].filter(Boolean).join(" ")
            add(group, value, sourceId(d.id, f.key, rowId, c.key))
          }
          const name = f.remember && clean(row[f.remember])
          if (!f.remember || !name) return
          const table = (known[f.key] ??= new Map())
          const entry = table.get(textKey(name))
          const source = sourceId(d.id, f.key, rowId)
          if (!entry) {
            table.set(textKey(name), { row: { ...row }, sources: [source] })
            return
          }
          // Earlier rows fill in what the newer ones left empty.
          entry.sources.push(source)
          for (const c of f.columns) if (!entry.row[c.key]?.trim() && row[c.key]?.trim()) entry.row[c.key] = row[c.key]
        })
      }
    }
  }
  return {
    groups: listed(groups),
    columns: listed(columns),
    rows: listed(known),
  }
}

/** What fields asking for `groups` offer, without what was entered at `source` itself. */
export function offeredFrom(suggestions: Suggestions, groups: SuggestionGroup[], source: string) {
  return groups.flatMap((g) => offered(suggestions.groups[g], source).map((s) => s.value))
}

/** Each map's values as a list, under the same key. */
function listed<K extends string, V>(maps: Record<K, Map<string, V>>) {
  return Object.fromEntries(Object.entries<Map<string, V>>(maps).map(([k, m]) => [k, [...m.values()]])) as Record<K, V[]>
}

const uid = () => crypto.randomUUID()
const now = () => new Date().toISOString()

/**
 * A new document; with `docs` (the case file's) it takes over the inherited values from the
 * main document, else from the newest one that has them.
 */
function newDoc(kind: CaseFileKind, template: string, docs: Doc<string>[] = [], id = uid()): Doc<string> {
  // Copied so editing a document never touches the shared initial values.
  const values = structuredClone(kind.templates[template].initial ?? {})
  const sources = [...docs.slice(0, 1), ...docs.slice(1).reverse()]
  for (const key of kind.inherit ?? []) {
    const from = sources.find((d) => d.values[key] !== undefined)
    if (from) values[key] = structuredClone(from.values[key])
  }
  return { id, template, values }
}

/**
 * Case files created in this session and not changed since. They are drafts: leaving one
 * (`discardDraft`) deletes it, so case files opened by mistake don't pile up.
 */
const drafts = new Set<string>()

/** The stored case files of `kind`, newest first, and everything that changes them. */
export function useCaseFiles(kind: CaseFileKind) {
  const [stored, setCaseFiles] = useLocalStorage<CaseFile<string>[]>(kind.storageKey, NO_CASE_FILES)

  // Documents of templates that were removed stay stored but aren't shown; nor is a case file whose main document it is.
  const caseFiles = useMemo(
    () =>
      stored
        .flatMap((a) => {
          if (!(a.docs[0]?.template in kind.templates)) return []
          const docs = a.docs.filter((d) => d.template in kind.templates)
          return [docs.length === a.docs.length ? a : { ...a, docs }]
        })
        .sort((a, b) => Number(!!a.settled) - Number(!!b.settled) || b.updatedAt.localeCompare(a.updatedAt)),
    [stored, kind],
  )

  /** Applies `fn` to case file `id`, which then is no draft anymore. */
  const change = useCallback(
    (id: string, fn: (a: CaseFile<string>) => CaseFile<string>) => {
      drafts.delete(id)
      setCaseFiles((prev) => prev.map((a) => (a.id === id ? { ...fn(a), updatedAt: now() } : a)))
    },
    [setCaseFiles],
  )

  /** Applies `fn` to the values of document `docId`. */
  const changeValues = useCallback(
    (id: string, docId: string, fn: (values: Values) => Values) =>
      change(id, (a) => ({ ...a, docs: a.docs.map((d) => (d.id === docId ? { ...d, values: fn(d.values) } : d)) })),
    [change],
  )

  const actions = useMemo(
    () => ({
      /**
       * Creates a case file and returns its id. With `values` (e.g. taken over from an
       * operation) they fill its main document over the template's initial ones and the case
       * file counts as edited; without, it is a draft (see `drafts`).
       */
      createCaseFile(template: string, values?: Values) {
        const at = now()
        const main = newDoc(kind, template)
        if (values) main.values = { ...main.values, ...structuredClone(values) }
        const caseFile: CaseFile<string> = { id: uid(), title: "", docs: [main], createdAt: at, updatedAt: at }
        if (!values) drafts.add(caseFile.id)
        setCaseFiles((prev) => [...prev, caseFile])
        return caseFile.id
      },
      /** Deletes case file `id` without asking while it is a draft nothing was entered in. */
      discardDraft(id: string) {
        if (drafts.delete(id)) setCaseFiles((prev) => prev.filter((a) => a.id !== id))
      },
      deleteCaseFile(id: string) {
        drafts.delete(id)
        setCaseFiles((prev) => prev.filter((a) => a.id !== id))
      },
      /** Puts back a case file removed with `deleteCaseFile`. */
      restoreCaseFile(caseFile: CaseFile<string>) {
        setCaseFiles((prev) => (prev.some((a) => a.id === caseFile.id) ? prev : [...prev, caseFile]))
      },
      rename(id: string, title: string) {
        change(id, (a) => ({ ...a, title }))
      },
      setSettled(id: string, settled: boolean) {
        change(id, (a) => ({ ...a, settled: settled || undefined }))
      },
      /** An empty title goes back to the automatic one. */
      renameDoc(id: string, docId: string, title: string) {
        change(id, (a) => ({ ...a, docs: a.docs.map((d) => (d.id === docId ? { ...d, title } : d)) }))
      },
      setValue(id: string, docId: string, key: string, value: Value) {
        changeValues(id, docId, (values) => ({ ...values, [key]: value }))
      },
      /** Sets a value from the stored one, e.g. to put a removed row back among the rows as they are now. */
      updateValue(id: string, docId: string, key: string, fn: (value: Value | undefined) => Value) {
        changeValues(id, docId, (values) => ({ ...values, [key]: fn(values[key]) }))
      },
      /** Sets several values of a document at once. */
      setValues(id: string, docId: string, values: Record<string, Value>) {
        changeValues(id, docId, (prev) => ({ ...prev, ...values }))
      },
      /** Attaches a new document and returns its id. */
      addDoc(id: string, template: string) {
        const docId = uid()
        change(id, (a) => ({ ...a, docs: [...a.docs, newDoc(kind, template, a.docs, docId)] }))
        return docId
      },
      removeDoc(id: string, docId: string) {
        change(id, (a) => ({ ...a, docs: a.docs.filter((d, i) => i === 0 || d.id !== docId) }))
      },
      /** Puts back a document removed with `removeDoc` at its old position. */
      restoreDoc(id: string, d: Doc<string>, index: number) {
        change(id, (a) =>
          a.docs.some((x) => x.id === d.id) ? a : { ...a, docs: [...a.docs.slice(0, index), d, ...a.docs.slice(index)] },
        )
      },
    }),
    [setCaseFiles, change, changeValues, kind],
  )

  // The actions stay the same, so only changed case files make this a new object.
  return useMemo(() => ({ caseFiles, ...actions }), [caseFiles, actions])
}

export type CaseFilesApi = ReturnType<typeof useCaseFiles>
