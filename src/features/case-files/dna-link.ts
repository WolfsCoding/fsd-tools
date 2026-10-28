// Keeps the analyses and the DNA database linked: IDs entered in an analysis get an entry in
// the database, what the database knows about a trace is filled into the analyses, and names
// and IDs changed in the database change in the analyses too.

import { useEffect, useRef, useState } from "react"
import type { DnaEntry, DnaEntryInput } from "@/features/dna-db/types"
import { sameText } from "@/lib/text"
import { useAtom } from "@effect/atom-react"
import { useDnaEntries } from "@/features/dna-db/use-dna-entries"
import { POLICE_FILES_KIND } from "./police-files"
import { templateFields, type Column, type Lookup } from "./templates"
import {
  completeTraces,
  dbValue,
  findById,
  findEntry,
  looksLikeId,
  newDbData,
  rowLookup,
  rowTraces,
  storeTraces,
  type DbField,
  type Trace,
  type TraceKind,
} from "./traces"
import type { CaseFile, Row } from "./types"

const KINDS: TraceKind[] = ["dna", "fa"]
const FIELDS: DbField[] = ["name", "dna", "fa"]

/** Columns of DNA-IDs or fingerprint IDs, e.g. the DNA of a blood trace. */
const isIdLookup = (lookup: Lookup) => lookup.field === "dna" || lookup.field === "fa"

/**
 * The case files with each row of their tables passed through `fn` (with the columns of its
 * table); the same case files, documents and rows wherever nothing changes. A text field
 * picked from the database (e.g. the suspect) counts as a row with that one column.
 * Settled case files are only read (`settled`), never changed: they stay as they were handed in.
 * Changes made here don't count as edits, so `updatedAt` (and the order of the list) stays.
 */
function mapRows(caseFiles: CaseFile<string>[], fn: (row: Row, columns: Column[]) => Row, settled = false) {
  let changed = false
  const next = caseFiles.map((a) => {
    if (a.settled && !settled) return a
    let docsChanged = false
    const docs = a.docs.map((d) => {
      const t = POLICE_FILES_KIND.templates[d.template]
      if (!t) return d
      let values = d.values
      for (const f of templateFields(t)) {
        const value = values[f.key]
        if (f.type === "text" && f.lookup && typeof value === "string") {
          const row = { [f.key]: value }
          const mapped = fn(row, [{ key: f.key, label: f.label, fallback: "", lookup: f.lookup }])
          if (mapped !== row && mapped[f.key] !== value) values = { ...values, [f.key]: mapped[f.key] }
          continue
        }
        if (f.type !== "table" || !Array.isArray(value)) continue
        const rows = value as Row[]
        const mapped = rows.map((row) => (typeof row === "object" ? fn(row, f.columns) : row))
        if (mapped.some((row, i) => row !== rows[i])) values = { ...values, [f.key]: mapped }
      }
      if (values === d.values) return d
      docsChanged = true
      return { ...d, values }
    })
    if (!docsChanged) return a
    changed = true
    return { ...a, docs }
  })
  return changed ? next : caseFiles
}

/**
 * Every trace in the case files, plus the IDs of lookup columns with the name next to them.
 * Settled case files count too: what they found still belongs in the database.
 */
function allTraces(caseFiles: CaseFile<string>[], entries: DnaEntry[]) {
  const traces: Trace[] = []
  const collect = (row: Row, columns: Column[]) => {
    for (const c of columns) {
      const lookup = rowLookup(c, row)
      const value = row[c.key] ?? ""
      if (c.traces) traces.push(...rowTraces(row, c.key, c.traces.kinds))
      else if (lookup && isIdLookup(lookup)) {
        const kind = lookup.field as TraceKind
        const name = lookup.fill?.name
        traces.push({ id: "", dna: "", fa: "", [kind]: value, name: name ? (row[name] ?? "") : "", ort: "" })
      } else if (lookup?.or?.length && looksLikeId(value)) {
        // e.g. the DNA of a suspect not known by name; an ID the database doesn't know is of the first kind.
        const kind = findById(entries, lookup.or, value)?.kind ?? lookup.or[0]
        traces.push({ id: "", dna: "", fa: "", [kind]: value, name: "", ort: "" })
      }
    }
    return row
  }
  mapRows(caseFiles, collect, true)
  return traces
}

/**
 * The row with what `entries` know filled in: the name of the person whose ID it has (the
 * database has the say), and IDs into empty cells. The same row while nothing changes.
 */
function completeRow(row: Row, columns: Column[], entries: DnaEntry[]) {
  let next = row
  for (const c of columns) {
    if (c.traces) {
      const traces = rowTraces(next, c.key, c.traces.kinds)
      const done = completeTraces(traces, entries, Object.keys(c.traces.kinds) as TraceKind[])
      if (done !== traces) next = { ...next, [c.key]: storeTraces(done) }
    } else if (rowLookup(c, next)?.fill) {
      const { field, fill } = c.lookup!
      const entry = findEntry(entries, field, next[c.key] ?? "")
      if (!entry) continue
      for (const [from, key] of Object.entries(fill!) as [DbField, string][]) {
        const known = dbValue(entry, from)
        const current = next[key]?.trim() ?? ""
        if (known && (from === "name" ? current !== known : !current)) next = { ...next, [key]: known }
      }
    }
  }
  return next
}

/** A name or ID changed in the database: `from` becomes `to` wherever it was entered. */
export interface Rename {
  field: DbField
  from: string
  to: string
}

/** The names and IDs that entries kept (by their id) changed from `before` to `after`. */
export function renames(before: DnaEntry[], after: DnaEntry[]): Rename[] {
  const result: Rename[] = []
  for (const e of after) {
    const old = before.find((b) => b.id === e.id)
    if (!old) continue
    for (const field of FIELDS) {
      const from = dbValue(old, field)
      const to = dbValue(e, field)
      if (from && to && !sameText(from, to)) result.push({ field, from, to })
    }
  }
  return result
}

/** The row with the `renames` applied to its traces and looked up cells. */
function renameRow(row: Row, columns: Column[], list: Rename[]) {
  const swap = (value: string | undefined, field: DbField) =>
    list.find((r) => r.field === field && value && sameText(value, r.from))?.to
  let next = row
  for (const c of columns) {
    const value = next[c.key]
    if (c.traces) {
      const traces = rowTraces(next, c.key, c.traces.kinds)
      let changed = false
      const renamed = traces.map((t) => {
        const patch: Partial<Trace> = {}
        for (const field of FIELDS) {
          const key = field === "name" ? "name" : field
          const to = swap(t[key], field)
          if (to) patch[key] = to
        }
        if (!Object.keys(patch).length) return t
        changed = true
        return { ...t, ...patch }
      })
      if (changed) next = { ...next, [c.key]: storeTraces(renamed) }
    } else {
      const lookup = rowLookup(c, next)
      if (!lookup) continue
      // A name column with `or` may hold an ID instead.
      const fields: DbField[] = [lookup.field, ...(lookup.or ?? [])]
      const to = fields.map((f) => swap(value, f)).find(Boolean)
      if (to) next = { ...next, [c.key]: to }
    }
  }
  return next
}

/**
 * What linking the case files with the DNA database changes: the `renames` made there applied,
 * entries to add for IDs the database doesn't know (except `dismissed` ones, whose entries
 * were deleted), entries to complete, and the case files completed from the database. The
 * same case files while nothing changes.
 */
export function linkDna(caseFiles: CaseFile<string>[], entries: DnaEntry[], dismissed: string[] = [], renamed: Rename[] = []) {
  const current = renamed.length ? mapRows(caseFiles, (row, columns) => renameRow(row, columns, renamed)) : caseFiles
  const isDismissed = (id: string) => !!id && dismissed.includes(id)
  const { add: found, update } = newDbData(entries, allTraces(current, entries), KINDS)
  const add: DnaEntryInput[] = found.filter((e) => !isDismissed(e.dnaId) && !isDismissed(e.fingerprintId))
  const known: DnaEntry[] = [
    ...entries.map((e) => ({ ...e, ...update.find((u) => u.id === e.id)?.input })),
    ...add.map((e) => ({ ...e, id: "", createdAt: "", updatedAt: "" })),
  ]
  return { caseFiles: mapRows(current, (row, columns) => completeRow(row, columns, known)), add, update }
}

/** Whether a text field has the focus. */
function inTextField() {
  const el = document.activeElement
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el instanceof HTMLElement && el.isContentEditable)
}

/**
 * Links the analyses with the DNA database whenever either changes. While a case file is
 * edited in the focused text field it waits until the field loses the focus, so half typed
 * IDs and names are never linked. Rendered once, by the layout.
 */
export function DnaLink() {
  const { entries, dismissed, addEntry, updateEntry } = useDnaEntries()
  const [caseFiles, setCaseFiles] = useAtom(POLICE_FILES_KIND.atom)
  // Bumped when a field loses the focus, to link what was entered in it.
  const [blurs, setBlurs] = useState(0)
  // The case files when the focused field got the focus; different ones were edited in it.
  const latest = useRef(caseFiles)
  const atFocus = useRef(caseFiles)
  // The entries the case files were last linked with, to find names and IDs changed since.
  const linkedEntries = useRef(entries)
  useEffect(() => {
    latest.current = caseFiles
  }, [caseFiles])

  useEffect(() => {
    const onFocus = () => (atFocus.current = latest.current)
    const onBlur = () => setBlurs((n) => n + 1)
    document.addEventListener("focusin", onFocus)
    document.addEventListener("focusout", onBlur)
    return () => {
      document.removeEventListener("focusin", onFocus)
      document.removeEventListener("focusout", onBlur)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (inTextField() && caseFiles !== atFocus.current) return
      const linked = linkDna(caseFiles, entries, dismissed, renames(linkedEntries.current, entries))
      for (const { id, input } of linked.update) updateEntry(id, input)
      for (const input of linked.add) addEntry(input)
      if (linked.caseFiles === caseFiles) {
        linkedEntries.current = entries
        return
      }
      // Our own change doesn't count as typing.
      if (atFocus.current === caseFiles) atFocus.current = linked.caseFiles
      // Changed in the meantime: linked again with the new state, renames included.
      setCaseFiles((prev) => {
        if (prev !== caseFiles) return prev
        linkedEntries.current = entries
        return linked.caseFiles
      })
    }, 300)
    return () => clearTimeout(timer)
  }, [caseFiles, entries, dismissed, blurs, addEntry, updateEntry, setCaseFiles])

  return null
}
