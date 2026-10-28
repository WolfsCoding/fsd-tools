import { useAtomValue } from "@effect/atom-react"
import * as Schema from "effect/Schema"
import type * as Types from "effect/Types"
import { Atom } from "effect/reactivity"
import { appRegistry } from "@/lib/runtime"

// All of the app's data lives in localStorage. Every stored value is an atom typed by its
// Schema (`stored`), so components read it with `useAtom` and the backups know what to accept.

/** All keys are namespaced so multiple tools can share one origin safely. */
const PREFIX = "fsd-tools:"

export function storageKey(key: string) {
  return PREFIX + key
}

/** A value that couldn't be saved, e.g. because the storage is full. */
export interface WriteFailure {
  key: string
  error: unknown
  at: number
}

/** The last failed write; the status bar shows a warning for it. */
export const writeFailureAtom = Atom.make<WriteFailure | null>(null).pipe(Atom.keepAlive)

/** Bumped on every change to any of the app's keys, e.g. for the storage size in the settings. */
export const storageVersionAtom = Atom.make(0).pipe(Atom.keepAlive)

// Parsed values per raw string, so re-reads keep the same references.
const cache = new Map<string, { raw: string; value: unknown }>()
const listeners = new Map<string, Set<() => void>>()

function subscribe(fullKey: string, listener: () => void) {
  const set = listeners.get(fullKey) ?? new Set()
  set.add(listener)
  listeners.set(fullKey, set)
  return () => {
    set.delete(listener)
    if (set.size === 0) listeners.delete(fullKey)
  }
}

/** Tells the atoms of `fullKey` (all of them for `null`, i.e. a cleared storage) and the version. */
function notify(fullKey: string | null) {
  const keys = fullKey === null ? [...listeners.keys()] : [fullKey]
  for (const key of keys) for (const listener of listeners.get(key) ?? []) listener()
  appRegistry.set(storageVersionAtom, appRegistry.get(storageVersionAtom) + 1)
}

// "storage" fires for changes made in other tabs.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === null || event.key.startsWith(PREFIX)) notify(event.key)
  })
}

/** Stores `raw`; on failure (quota, private mode) tells the app instead of throwing. */
function setRaw(fullKey: string, raw: string) {
  try {
    localStorage.setItem(fullKey, raw)
    return true
  } catch (error) {
    appRegistry.set(writeFailureAtom, { key: fullKey, error, at: Date.now() })
    return false
  }
}

function writeValue(fullKey: string, value: unknown) {
  const raw = JSON.stringify(value)
  if (!setRaw(fullKey, raw)) return false
  cache.set(fullKey, { raw, value })
  notify(fullKey)
  return true
}

function removeValue(fullKey: string) {
  localStorage.removeItem(fullKey)
  cache.delete(fullKey)
  notify(fullKey)
}

/** The value of a stored atom: its schema's type, with the arrays and objects writable. */
export type StoredValue<S extends Schema.Top> = Types.DeepMutable<S["Type"]>

/** What the backups and the settings know about a stored atom, whatever its value type. */
export interface StoredEntry {
  /** The key without the app prefix, e.g. "notes:notes". */
  readonly key: string
  /** Whether a value (e.g. from an import) has the shape this key stores. */
  readonly is: (value: unknown) => boolean
}

export interface StoredAtom<A> extends Atom.Writable<A, A>, StoredEntry {}

/**
 * The value under `key`, synced across components and tabs. Pass a stable `fallback`; it
 * is the value while nothing is stored. A stored value of another shape is read as it is
 * (with a warning), never dropped: older versions wrote it, and the readers migrate it.
 */
export function stored<S extends Schema.Top>(key: string, schema: S, fallback: StoredValue<S>): StoredAtom<StoredValue<S>> {
  type A = StoredValue<S>
  const fullKey = storageKey(key)
  const is = Schema.is(schema)

  const read = (): A => {
    const raw = localStorage.getItem(fullKey)
    if (raw === null) return fallback
    const cached = cache.get(fullKey)
    if (cached?.raw === raw) return cached.value as A
    let value = fallback
    try {
      const parsed: unknown = JSON.parse(raw)
      if (!is(parsed)) console.warn(`Stored "${key}" has an unexpected shape; it is used as it is.`)
      value = parsed as A
    } catch {
      // Not JSON: it wasn't written by this app.
    }
    cache.set(fullKey, { raw, value })
    return value
  }

  const atom = Atom.writable<A, A>(
    (get) => {
      get.addFinalizer(subscribe(fullKey, () => get.refreshSelf()))
      return read()
    },
    (ctx, value) => {
      if (writeValue(fullKey, value)) ctx.setSelf(value)
    },
  ).pipe(Atom.withLabel(`stored:${key}`))

  return Object.assign(atom, { key, is })
}

/** Parsed values of the stored `keys` as `{ key: value }`; missing keys are omitted. */
export function readKeys(keys: string[]): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  for (const key of keys) {
    const raw = localStorage.getItem(storageKey(key))
    if (raw === null) continue
    try {
      data[key] = JSON.parse(raw)
    } catch {
      // Skip values that aren't JSON; they weren't written by this app.
    }
  }
  return data
}

/** Replaces `keys` with the values in `data`; keys missing from `data` are removed. */
export function replaceKeys(keys: string[], data: Record<string, unknown>) {
  for (const key of keys) {
    if (key in data) writeValue(storageKey(key), data[key])
    else removeValue(storageKey(key))
  }
}

/** Approximate bytes used by all of this app's keys (localStorage stores UTF-16). */
export function totalStorageBytes() {
  let sum = 0
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key?.startsWith(PREFIX)) continue
    sum += (key.length + (localStorage.getItem(key)?.length ?? 0)) * 2
  }
  return sum
}

function storageBytes(keys: string[]) {
  return keys.reduce((sum, key) => {
    const raw = localStorage.getItem(storageKey(key))
    return raw === null ? sum : sum + (storageKey(key).length + raw.length) * 2
  }, 0)
}

/** Live byte count for `keys`; re-renders when any stored value changes. */
export function useStorageBytes(keys: string[]) {
  useAtomValue(storageVersionAtom)
  return storageBytes(keys)
}
