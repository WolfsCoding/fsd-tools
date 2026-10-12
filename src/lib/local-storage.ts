import { useCallback, useSyncExternalStore } from "react"

// All keys are namespaced so multiple tools can share one origin safely.
const PREFIX = "fsd-tools:"
const CHANGE_EVENT = "fsd-tools:storage"

export function storageKey(key: string) {
  return PREFIX + key
}

function subscribe(callback: () => void) {
  // "storage" fires for other tabs, CHANGE_EVENT for this tab.
  window.addEventListener("storage", callback)
  window.addEventListener(CHANGE_EVENT, callback)
  return () => {
    window.removeEventListener("storage", callback)
    window.removeEventListener(CHANGE_EVENT, callback)
  }
}

// Cache parsed values per raw string so useSyncExternalStore gets stable references.
const parseCache = new Map<string, { raw: string | null; value: unknown }>()

function read<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key)
  const cached = parseCache.get(key)
  if (cached && cached.raw === raw) return cached.value as T

  let value: T = fallback
  if (raw !== null) {
    try {
      value = JSON.parse(raw) as T
    } catch {
      value = fallback
    }
  }
  parseCache.set(key, { raw, value })
  return value
}

/** Event fired when a value couldn't be saved, e.g. because the storage is full. */
export const WRITE_FAILED_EVENT = "fsd-tools:write-failed"

/** Stores `raw`; on failure (quota, private mode) tells the app instead of throwing. */
function setItem(key: string, raw: string) {
  try {
    localStorage.setItem(key, raw)
    return true
  } catch (error) {
    window.dispatchEvent(new CustomEvent(WRITE_FAILED_EVENT, { detail: error }))
    return false
  }
}

function write<T>(key: string, value: T) {
  if (setItem(key, JSON.stringify(value))) {
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }
}

/** Approximate bytes used by all of this app's keys. */
export function totalStorageBytes() {
  let sum = 0
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key?.startsWith(PREFIX)) continue
    sum += (key.length + (localStorage.getItem(key)?.length ?? 0)) * 2
  }
  return sum
}

/** Approximate bytes used by `keys` (localStorage stores UTF-16). */
function storageBytes(keys: string[]) {
  return keys.reduce((sum, key) => {
    const raw = localStorage.getItem(storageKey(key))
    return raw === null ? sum : sum + (storageKey(key).length + raw.length) * 2
  }, 0)
}

/** Live byte count for `keys`; re-renders when any stored value changes. */
export function useStorageBytes(keys: string[]) {
  return useSyncExternalStore(
    subscribe,
    () => storageBytes(keys),
    () => 0,
  )
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
    if (key in data) {
      setItem(storageKey(key), JSON.stringify(data[key]))
    } else {
      localStorage.removeItem(storageKey(key))
    }
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

/**
 * Persist state in localStorage, synced across components and tabs.
 * `key` is automatically prefixed with the app namespace.
 * Pass a stable `fallback` (e.g. a module-level constant) to keep `setValue` stable.
 */
export function useLocalStorage<T>(key: string, fallback: T) {
  const fullKey = storageKey(key)

  const value = useSyncExternalStore(
    subscribe,
    () => read(fullKey, fallback),
    () => fallback,
  )

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = read(fullKey, fallback)
      const resolved =
        typeof next === "function" ? (next as (prev: T) => T)(prev) : next
      write(fullKey, resolved)
    },
    [fullKey, fallback],
  )

  return [value, setValue] as const
}
