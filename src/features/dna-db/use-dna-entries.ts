import { useCallback, useEffect } from "react"
import { useLocalStorage } from "@/lib/local-storage"
import { sameText } from "@/lib/text"
import { isNote } from "@/features/notes/use-notes"
import { isTagColor, sameTag } from "./tags"
import { PROFILE_FIELDS, type DnaEntry, type DnaEntryInput, type DnaTag } from "./types"

export const DNA_ENTRIES_KEY = "dna-db:entries"
const EMPTY: DnaEntry[] = []
/** IDs of deleted entries, so linking them with the analyses doesn't add them back. */
export const DNA_DISMISSED_KEY = "dna-db:dismissed"
const NO_IDS: string[] = []

/** Checks imported data before it replaces the stored entries. */
export function isValidDnaData(data: Record<string, unknown>) {
  const entries = data[DNA_ENTRIES_KEY]
  const dismissed = data[DNA_DISMISSED_KEY]
  return (
    (entries === undefined ||
      (Array.isArray(entries) && entries.every(isDnaEntry))) &&
    (dismissed === undefined ||
      (Array.isArray(dismissed) && dismissed.every((id) => typeof id === "string")))
  )
}

function isDnaEntry(value: unknown): value is DnaEntry {
  if (typeof value !== "object" || value === null) return false
  const v = value as Record<string, unknown>
  return (
    ["id", "name", "dnaId", "fingerprintId", "createdAt", "updatedAt"].every(
      (k) => typeof v[k] === "string",
    ) &&
    (v.tags === undefined || (Array.isArray(v.tags) && v.tags.every(isDnaTag))) &&
    (v.caseNumbers === undefined ||
      (Array.isArray(v.caseNumbers) && v.caseNumbers.every((n) => typeof n === "string"))) &&
    PROFILE_FIELDS.every((f) => v[f.key] === undefined || typeof v[f.key] === "string") &&
    (v.notes === undefined || (Array.isArray(v.notes) && v.notes.every(isNote)))
  )
}

function isDnaTag(value: unknown): value is DnaTag {
  if (typeof value !== "object" || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.name === "string" && isTagColor(v.color)
}

/** How DNA and fingerprint IDs are stored: trimmed and in capitals, e.g. "d-0042" → "D-0042". */
export function toId(value: string) {
  return value.trim().toUpperCase()
}

/** Both set and equal (ignoring case), or one of them empty. */
const fits = (a: string, b: string) => !a.trim() || !b.trim() || sameText(a, b)

/** Entries for the same trace: they share an ID, and nothing they both have differs. They get merged into one. */
export function isDuplicate(a: DnaEntry, b: DnaEntry) {
  const sharesId = (!!a.dnaId && a.dnaId === b.dnaId) || (!!a.fingerprintId && a.fingerprintId === b.fingerprintId)
  return sharesId && fits(a.name, b.name) && fits(a.dnaId, b.dnaId) && fits(a.fingerprintId, b.fingerprintId)
}

/** Items of `a`, then those of `b` with an id `a` doesn't have; undefined while there are none. */
function byId<T extends { id: string }>(a: T[] = [], b: T[] = []) {
  const all = [...a, ...b.filter((x) => !a.some((y) => y.id === x.id))]
  return all.length ? all : undefined
}

/** `into` with what only `from` has: empty fields filled, tags, case numbers and notes of both. */
function merge(into: DnaEntry, from: DnaEntry): DnaEntry {
  const tags = [...(into.tags ?? [])]
  for (const tag of from.tags ?? []) if (!tags.some((t) => sameTag(t.name, tag.name))) tags.push(tag)
  const caseNumbers = [...(into.caseNumbers ?? [])]
  for (const n of from.caseNumbers ?? []) if (!caseNumbers.some((c) => sameText(c, n))) caseNumbers.push(n)
  const profile = Object.fromEntries(
    PROFILE_FIELDS.map(({ key }) => [key, into[key]?.trim() || from[key]]).filter(([, v]) => v),
  )
  return {
    ...into,
    ...profile,
    notes: byId(into.notes, from.notes),
    name: into.name.trim() || from.name,
    dnaId: into.dnaId || from.dnaId,
    fingerprintId: into.fingerprintId || from.fingerprintId,
    tags: tags.length ? tags : undefined,
    caseNumbers: caseNumbers.length ? caseNumbers : undefined,
    createdAt: into.createdAt < from.createdAt ? into.createdAt : from.createdAt,
    updatedAt: into.updatedAt > from.updatedAt ? into.updatedAt : from.updatedAt,
  }
}

/**
 * The entries with their IDs in capitals and entries that only differed in upper/lower case
 * combined into one (the first one keeps its id). The same array while nothing changes.
 */
export function normalizeEntries(entries: DnaEntry[]) {
  const result: DnaEntry[] = []
  let changed = false
  for (const entry of entries) {
    const dnaId = toId(entry.dnaId)
    const fingerprintId = toId(entry.fingerprintId)
    const e = dnaId === entry.dnaId && fingerprintId === entry.fingerprintId ? entry : { ...entry, dnaId, fingerprintId }
    if (e !== entry) changed = true
    const i = result.findIndex((r) => isDuplicate(r, e))
    if (i === -1) {
      result.push(e)
    } else {
      result[i] = merge(result[i], e)
      changed = true
    }
  }
  return changed ? result : entries
}

/** The IDs given in `input`, in capitals. */
function ids(input: Partial<DnaEntryInput>) {
  return {
    ...(input.dnaId !== undefined && { dnaId: toId(input.dnaId) }),
    ...(input.fingerprintId !== undefined && { fingerprintId: toId(input.fingerprintId) }),
  }
}

// The entries last normalized; the hook is used in many places, so each version is checked once.
let normalized: DnaEntry[] | undefined

export function useDnaEntries() {
  const [entries, setEntries] = useLocalStorage<DnaEntry[]>(DNA_ENTRIES_KEY, EMPTY)
  const [dismissed, setDismissed] = useLocalStorage<string[]>(DNA_DISMISSED_KEY, NO_IDS)

  // Older and imported entries may have IDs in lower case, or duplicates that only differ in it.
  useEffect(() => {
    if (entries === normalized) return
    const next = normalizeEntries(entries)
    normalized = next
    if (next !== entries) setEntries(next)
  }, [entries, setEntries])

  const addEntry = useCallback(
    (input: DnaEntryInput) => {
      const now = new Date().toISOString()
      const entry = { ...input, ...ids(input), id: crypto.randomUUID(), createdAt: now, updatedAt: now }
      setEntries((prev) => [...prev, entry])
      // Added again: linked with the analyses again.
      setDismissed((prev) => {
        const next = prev.filter((id) => id !== entry.dnaId && id !== entry.fingerprintId)
        return next.length === prev.length ? prev : next
      })
    },
    [setEntries, setDismissed],
  )

  /** Changes the given fields; with a function, those it returns for the entry as stored by then. */
  const updateEntry = useCallback(
    (id: string, input: Partial<DnaEntryInput> | ((entry: DnaEntry) => Partial<DnaEntryInput>)) => {
      const now = new Date().toISOString()
      setEntries((prev) =>
        prev.map((e) => {
          if (e.id !== id) return e
          const changes = typeof input === "function" ? input(e) : input
          return { ...e, ...changes, ...ids(changes), updatedAt: now }
        }),
      )
    },
    [setEntries],
  )

  /** Deletes the entry; the returned function puts it back where it was. */
  const deleteEntry = useCallback(
    (id: string) => {
      const index = entries.findIndex((e) => e.id === id)
      const entry = entries[index]
      if (!entry) return () => {}
      setEntries((prev) => prev.filter((e) => e.id !== id))
      // Analyses may still have its IDs; they shouldn't bring it back.
      const gone = [entry.dnaId, entry.fingerprintId].filter((v) => !!v && !dismissed.includes(v))
      if (gone.length) setDismissed((prev) => [...prev.filter((v) => !gone.includes(v)), ...gone])
      return () => {
        // Into the entries as they are by then, so changes made since are kept.
        setEntries((prev) =>
          prev.some((e) => e.id === id) ? prev : [...prev.slice(0, index), entry, ...prev.slice(index)],
        )
        // Only the IDs this deletion dismissed; ones dismissed before stay so.
        if (gone.length) setDismissed((prev) => prev.filter((v) => !gone.includes(v)))
      }
    },
    [entries, dismissed, setEntries, setDismissed],
  )

  return { entries, dismissed, addEntry, updateEntry, deleteEntry }
}

/** The entry's name, or "Unbekannt" for a trace not yet matched to a person. */
export function entryName(entry: DnaEntry) {
  return entry.name.trim() || "Unbekannt"
}
