import { useState, type DragEvent } from "react"
import { cn } from "cn"

/** `items` with the item at `from` moved to `to`. */
export function move<T>(items: T[], from: number, to: number) {
  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

interface Drag {
  from: number
  to: number
  list: HTMLElement
  /** Where each row was, from the top of the list, when the drag started. */
  spans: { top: number; bottom: number }[]
}

/**
 * Drag-to-reorder for rows that are held by a handle. Only the held row is draggable,
 * so text inside the rows stays selectable. While dragging, the rows slide into the order
 * they would get, and the held one into its new place.
 */
export function useReorder(onMove: (from: number, to: number) => void) {
  const [grabbed, setGrabbed] = useState<number>()
  const [drag, setDrag] = useState<Drag>()

  function finish() {
    if (drag && drag.from !== drag.to) onMove(drag.from, drag.to)
    setDrag(undefined)
    setGrabbed(undefined)
  }

  /** How far row `i` is moved to show the new order. */
  function shift(i: number) {
    if (!drag) return 0
    const { from, to, spans } = drag
    if (i === from) return to > from ? spans[to].bottom - spans[from].bottom : spans[to].top - spans[from].top
    if (from < i && i <= to) return spans[from].top - spans[from + 1].top
    if (to <= i && i < from) return spans[from].bottom - spans[from - 1].bottom
    return 0
  }

  return {
    row: (i: number) => ({
      "data-reorder-row": i,
      draggable: grabbed === i,
      // Only while dragging: on drop the rows take their new places at once, without sliding back.
      style: drag && { transform: `translateY(${shift(i)}px)`, transition: "transform 200ms var(--ease-out-quint, ease-out)" },
      onDragStart: (e: DragEvent<HTMLElement>) => {
        e.dataTransfer.effectAllowed = "move"
        const list = e.currentTarget.parentElement!
        const origin = list.getBoundingClientRect().top
        const spans: Drag["spans"] = []
        for (const el of list.querySelectorAll<HTMLElement>(":scope > [data-reorder-row]")) {
          const r = el.getBoundingClientRect()
          spans[Number(el.dataset.reorderRow)] = { top: r.top - origin, bottom: r.bottom - origin }
        }
        setDrag({ from: i, to: i, list, spans })
      },
      onDragOver: (e: DragEvent) => {
        if (!drag) return
        e.preventDefault()
        // From where the rows were, as the shifted ones are no longer where they belong.
        const y = e.clientY - drag.list.getBoundingClientRect().top
        const to = drag.spans.filter((s, k) => k !== drag.from && (s.top + s.bottom) / 2 < y).length
        if (drag.to !== to) setDrag({ ...drag, to })
      },
      onDrop: (e: DragEvent) => {
        e.preventDefault()
        finish()
      },
      onDragEnd: finish,
    }),
    handle: (i: number) => ({
      onPointerDown: () => setGrabbed(i),
      onPointerUp: () => !drag && setGrabbed(undefined),
    }),
    /** Dims the held row in its new place. */
    rowClass: (i: number) => cn(drag?.from === i && "relative z-10 opacity-50"),
  }
}
