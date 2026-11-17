import { useEffect, useRef } from "react"

/** Keys that move around or close a dialog without changing what is in it. */
const PASSIVE_KEYS = ["Escape", "Tab", "Shift", "Control", "Alt", "Meta"]

/**
 * For the `DialogContent` of a dialog that holds a draft (a new Akte, a note, a person):
 * a stray click next to it never closes it, and once it was worked in, a stray Escape
 * doesn't either. The X and "Abbrechen" always close it; Escape still closes a dialog
 * that was only opened.
 *
 * Any press or key inside counts as working in it, also inside the pickers it opens:
 * a value picked with the mouse or the arrow keys types nothing.
 */
export function useDraftGuard(open: boolean) {
  const touched = useRef(false)
  useEffect(() => {
    if (open) touched.current = false
  }, [open])
  const touch = () => {
    touched.current = true
  }
  return {
    onPointerDown: touch,
    onInput: touch,
    onKeyDown: (e: { key: string }) => {
      if (!PASSIVE_KEYS.includes(e.key)) touch()
    },
    onInteractOutside: (e: Event) => e.preventDefault(),
    onEscapeKeyDown: (e: KeyboardEvent) => {
      if (touched.current) e.preventDefault()
    },
  }
}
