// Traces found on an item (DNA, fingerprints): whose they are and where they were found.
// Stored as JSON in a table cell so they move with their row.

import type { DnaEntry, DnaEntryInput } from "@/features/dna-db/types"
import { sameText } from "@/lib/text"
import type { Column, Lookup } from "./templates"
import type { Row } from "./types"

export type TraceKind = "dna" | "fa"

/** One trace; with several kinds recorded together (DNA and fingerprints), the pair of one person. */
export interface Trace {
  id: string
  /** DNA-ID; may be empty. */
  dna: string
  /** Fingerprint ID; may be empty. */
  fa: string
  /** Whose trace it is; empty while unknown. */
  name: string
  /** Where on the item it was found. */
  ort: string
}

export const TRACE_LABELS: Record<TraceKind, { noun: string; id: string }> = {
  dna: { noun: "DNA-Spuren", id: "DNA-ID" },
  fa: { noun: "Fingerabdrücke", id: "Fingerabdruck-ID" },
}

/** "DNA-Spuren", or "DNA & Fingerabdrücke" for both. */
export function tracesNoun(kinds: TraceKind[]) {
  return kinds.length > 1 ? "DNA & Fingerabdrücke" : TRACE_LABELS[kinds[0]].noun
}

/** The entry's ID for traces of `kind`. */
export function entryRef(entry: DnaEntry, kind: TraceKind) {
  return (kind === "dna" ? entry.dnaId : entry.fingerprintId).trim()
}

/** The entry whose `field` is `value`, ignoring case; none for an empty value. */
export function findEntry(entries: DnaEntry[], field: DbField, value: string) {
  if (!value.trim()) return undefined
  return entries.find((e) => dbValue(e, field) && sameText(dbValue(e, field), value))
}

/** Whether a value is an ID rather than a name: it has a digit and no spaces, e.g. "D-0042". */
export function looksLikeId(value: string) {
  const v = value.trim()
  return /\d/.test(v) && !/\s/.test(v)
}

/** What a value of the DNA database is: a person's name, a DNA-ID or a fingerprint ID. */
export type DbField = "name" | TraceKind

export function dbValue(entry: DnaEntry, field: DbField) {
  return field === "name" ? entry.name.trim() : entryRef(entry, field)
}

/** The database's values of `field` for a dropdown, the IDs with the person's name (or "Unbekannt") next to them. */
export function dbOptions(entries: DnaEntry[], field: DbField) {
  return entries.flatMap((e) => {
    const value = dbValue(e, field)
    if (!value) return []
    return [{ value, hint: field === "name" ? e.dnaId.trim() || undefined : e.name.trim() || "Unbekannt" }]
  })
}

const str = (v: unknown) => (typeof v === "string" ? v : "")

/**
 * The traces of a cell; text from before traces were managed counts as one trace. Traces
 * stored before DNA and fingerprints were recorded together have one `ref`, of `kind`.
 */
export function parseTraces(cell: string | undefined, kind: TraceKind = "dna"): Trace[] {
  const text = cell?.trim() ?? ""
  if (!text) return []
  if (text.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(text)
      if (Array.isArray(parsed))
        return parsed
          .filter((t): t is Record<string, unknown> => typeof t === "object" && t !== null)
          .map((t) => ({
            id: typeof t.id === "string" ? t.id : crypto.randomUUID(),
            dna: str(t.dna) || (kind === "dna" ? str(t.ref) : ""),
            fa: str(t.fa) || (kind === "fa" ? str(t.ref) : ""),
            name: str(t.name),
            ort: str(t.ort),
          }))
    } catch {
      // Not JSON after all: plain text.
    }
  }
  return [{ id: "legacy", dna: "", fa: "", name: text, ort: "" }]
}

/**
 * The traces of a row, stored under `key`. Rows from before the `kinds` were recorded together
 * have them in the cells of each kind instead: those of the same person become one pair.
 */
export function rowTraces(row: Row, key: string, kinds: Partial<Record<TraceKind, string>>): Trace[] {
  const own = Object.entries(kinds) as [TraceKind, string][]
  if (row[key]?.trim() || own.every(([, k]) => k === key)) return parseTraces(row[key], own[0]?.[0])
  const traces: Trace[] = []
  for (const [kind, k] of own)
    for (const t of parseTraces(row[k], kind)) {
      const pair = t.name.trim() && traces.find((p) => sameText(p.name, t.name) && !p[kind].trim() && (!p.ort.trim() || !t.ort.trim() || sameText(p.ort, t.ort)))
      if (pair) Object.assign(pair, { [kind]: t[kind], ort: pair.ort.trim() || t.ort })
      else traces.push({ ...t, id: t.id === "legacy" ? crypto.randomUUID() : t.id })
    }
  return traces
}

const hasContent = (t: Trace) => !!(t.dna.trim() || t.fa.trim() || t.name.trim() || t.ort.trim())

/** Traces as a cell; entries left completely empty are dropped. */
export function storeTraces(traces: Trace[]) {
  const kept = traces.filter(hasContent)
  return kept.length ? JSON.stringify(kept) : ""
}

/** "Keine", "1 Gefunden", "3 Gefunden". */
export function traceSummary(count: number) {
  return count ? `${count} Gefunden` : "Keine"
}

/** "Max Muster (D-0042)": the name and the ID; "Unbekannt (D-0042)" without a name, only the name without an ID. */
export function personLabel(name: string, id: string) {
  const n = name.trim()
  const i = id.trim().toUpperCase()
  if (!i) return n || "Unbekannt"
  return `${n || "Unbekannt"} (${i})`
}

/**
 * "Griff: Max Muster (D-0042), Abzug: Unbekannt (D-0099)": where, whose and the ID of `kind`.
 * With `entries`, names and IDs come from the DNA database, so they follow it.
 */
export function formatTraces(traces: Trace[], kind: TraceKind, fallback: string, entries: DnaEntry[] = []) {
  // Only traces with an ID of `kind`, or with none at all (they count as both).
  const kept = traces.filter((t) => hasContent(t) && (t[kind].trim() || (!t.dna.trim() && !t.fa.trim())))
  if (!kept.length) return fallback
  return kept
    .map((t) => {
      const entry = traceEntry(entries, t, ["dna", "fa"])
      const who = personLabel(entry?.name.trim() || t.name, t[kind].trim() || (entry ? entryRef(entry, kind) : ""))
      return t.ort.trim() ? `${t.ort.trim()}: ${who}` : who
    })
    .join(", ")
}

/**
 * What the traces add to the DNA database: a new entry for each trace with an ID it doesn't
 * know yet, and the empty fields of known entries filled in (e.g. the name of a known DNA-ID).
 */
export function newDbData(entries: DnaEntry[], traces: Trace[], kinds: TraceKind[]) {
  const add: DnaEntryInput[] = []
  const update: { id: string; input: Partial<DnaEntryInput> }[] = []
  // Entries added for earlier traces count as known, so one person isn't added twice.
  const known = [...entries]
  for (const t of traces) {
    const dnaId = kinds.includes("dna") ? t.dna.trim().toUpperCase() : ""
    const fingerprintId = kinds.includes("fa") ? t.fa.trim().toUpperCase() : ""
    const name = t.name.trim()
    if (!dnaId && !fingerprintId) continue
    const entry = findEntry(known, "dna", dnaId) ?? findEntry(known, "fa", fingerprintId)
    if (!entry) {
      add.push({ name, dnaId, fingerprintId })
      known.push({ name, dnaId, fingerprintId, id: "", createdAt: "", updatedAt: "" })
      continue
    }
    const input: Partial<DnaEntryInput> = {
      ...(name && !entry.name.trim() && { name }),
      ...(dnaId && !entry.dnaId.trim() && { dnaId }),
      ...(fingerprintId && !entry.fingerprintId.trim() && { fingerprintId }),
    }
    // Entries added above are only completed by their own trace; known ones are updated.
    if (Object.keys(input).length && entry.id) {
      update.push({ id: entry.id, input })
      known[known.indexOf(entry)] = { ...entry, ...input }
    }
  }
  return { add, update }
}

/**
 * The entry a trace belongs to: the one with its DNA-ID or fingerprint ID, else the one with
 * its name and no ID that differs from the trace's.
 */
export function traceEntry(entries: DnaEntry[], t: Trace, kinds: TraceKind[]) {
  for (const k of kinds) {
    const entry = findEntry(entries, k, t[k])
    if (entry) return entry
  }
  if (!t.name.trim()) return undefined
  return entries.find(
    (e) => sameText(e.name, t.name) && kinds.every((k) => !t[k].trim() || !entryRef(e, k) || sameText(t[k], entryRef(e, k))),
  )
}

/**
 * The traces with what the DNA database knows filled in: each gets the name of its entry (the
 * database has the say, so renaming there renames here) and its IDs while its own are empty.
 * The same array while nothing changes.
 */
export function completeTraces(traces: Trace[], entries: DnaEntry[], kinds: TraceKind[]) {
  let changed = false
  const next = traces.map((t) => {
    const entry = traceEntry(entries, t, kinds)
    if (!entry) return t
    const fill: Partial<Trace> = {
      ...(entry.name.trim() && t.name.trim() !== entry.name.trim() && { name: entry.name.trim() }),
      ...Object.fromEntries(kinds.filter((k) => entryRef(entry, k) && !t[k].trim()).map((k) => [k, entryRef(entry, k)])),
    }
    if (!Object.keys(fill).length) return t
    changed = true
    // Plain text from before traces were managed becomes a trace of its own.
    return { ...t, ...fill, ...(t.id === "legacy" && { id: crypto.randomUUID() }) }
  })
  return changed ? next : traces
}

/** The column's lookup where it applies to the row (see `Lookup.only`). */
export function rowLookup(column: Pick<Column, "lookup">, row: Row) {
  const { lookup } = column
  return lookup && (!lookup.only || lookup.only(row)) ? lookup : undefined
}

/** The entry with ID `value` of one of the `kinds`, and which kind it is. */
export function findById(entries: DnaEntry[], kinds: TraceKind[], value: string) {
  for (const kind of kinds) {
    const entry = findEntry(entries, kind, value)
    if (entry) return { entry, kind }
  }
  return undefined
}

/** The entry's first ID of the `kinds`, e.g. its DNA-ID, else its fingerprint ID. */
export function firstRef(entry: DnaEntry, kinds: TraceKind[]) {
  for (const k of kinds) if (entryRef(entry, k)) return entryRef(entry, k)
  return ""
}

/**
 * A cell looked up in the DNA database as the document shows it, following the database:
 * name and ID ("Max Muster (D-0042)") where the row has no other cell for them, else just its
 * own part, e.g. the name of a blood trace whose DNA is known. "" while empty.
 */
export function lookupLabel(row: Row, key: string, lookup: Lookup, entries: DnaEntry[]) {
  const value = row[key]?.trim() ?? ""
  if (lookup.field !== "name") {
    if (!value || lookup.fill?.name) return value.toUpperCase()
    return personLabel(findEntry(entries, lookup.field, value)?.name ?? "", value)
  }
  if (lookup.or) {
    if (!value) return ""
    const byId = findById(entries, lookup.or, value)
    if (byId || looksLikeId(value)) return personLabel(byId?.entry.name ?? "", value)
    const entry = findEntry(entries, "name", value)
    return personLabel(entry?.name || value, entry ? firstRef(entry, lookup.or) : "")
  }
  // The name of the person whose ID is in the row.
  for (const [from, k] of Object.entries(lookup.fill ?? {}) as [DbField, string][]) {
    const name = from !== "name" && findEntry(entries, from, row[k] ?? "")?.name.trim()
    if (name) return name
  }
  return value
}
