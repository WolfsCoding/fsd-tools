import { useId, useState, type KeyboardEvent } from "react"

/**
 * Keyboard and ARIA wiring of an input with a list of options under it (a combobox): the
 * arrows open the list and move through it, Enter picks, Escape closes. The focus stays in
 * the input; the active option is announced with `aria-activedescendant`.
 */
export function useListbox<T>({
  options,
  open,
  onOpen,
  onPick,
  onClose,
}: {
  options: T[]
  /** Whether the list is shown. */
  open: boolean
  onOpen: () => void
  onPick: (option: T) => void
  onClose: () => void
}) {
  const [active, setActive] = useState(0)
  const listId = useId()
  const index = Math.min(active, options.length - 1)
  const expanded = open && options.length > 0

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      if (!open) return onOpen()
      const step = e.key === "ArrowDown" ? 1 : -1
      setActive((index + step + options.length) % options.length)
    } else if (e.key === "Enter" && open && options[index] !== undefined) {
      e.preventDefault()
      onPick(options[index])
    } else if (e.key === "Escape" && open) {
      e.preventDefault()
      onClose()
    }
  }

  return {
    /** The active option. */
    index,
    /** Makes the first option the active one again, e.g. after typing. */
    reset: () => setActive(0),
    inputProps: {
      role: "combobox",
      "aria-expanded": expanded,
      "aria-controls": listId,
      "aria-activedescendant": expanded && options[index] !== undefined ? `${listId}-${index}` : undefined,
      "aria-autocomplete": "list",
      autoComplete: "off",
      onKeyDown,
    } as const,
    listProps: { id: listId, role: "listbox" } as const,
    optionProps: (i: number) =>
      ({
        id: `${listId}-${i}`,
        role: "option",
        "aria-selected": i === index,
        onMouseEnter: () => setActive(i),
      }) as const,
  }
}
