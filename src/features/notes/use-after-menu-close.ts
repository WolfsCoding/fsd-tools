import { useRef } from "react"

/**
 * Runs a menu item's action once its context menu has let go of the focus, so a field
 * it opens keeps it: not pulled back into the menu while it closes, nor handed back to
 * the row once its closing animation is done.
 */
export function useAfterMenuClose() {
  const used = useRef(false)
  return {
    later: (action: () => void) => () => {
      used.current = true
      setTimeout(action)
    },
    onCloseAutoFocus: (e: Event) => {
      if (!used.current) return
      used.current = false
      e.preventDefault()
    },
  }
}
