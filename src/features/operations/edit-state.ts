import { createContext, useContext, useRef, type FocusEvent } from "react"

/** True while a finished operation is shown read-only. */
export const LockedContext = createContext(false)

export function useLocked() {
  return useContext(LockedContext)
}

/**
 * Remembers a field's value when it gets the focus and hands the before and after values to
 * `onCommit` when it loses it, so a history entry is written once per edit instead of per key.
 */
export function useEditSession(value: string, onCommit: ((before: string, after: string) => void) | undefined) {
  const before = useRef<string | null>(null)
  return {
    onFocus: () => {
      before.current = value
    },
    onBlur: (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (before.current !== null) onCommit?.(before.current, e.currentTarget.value)
      before.current = null
    },
  }
}
