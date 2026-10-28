import { useState, type DragEvent } from "react"
import { cn } from "cn"

/** `items` with the item at `from` moved to `to`. */
export function move<T>(items: T[], from: number, to: number) {
  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

/**
 * Drag-to-reorder for rows that are held by a handle. Only the held row is draggable,
 * so text inside the rows stays selectable.
 */
export function useReorder(onMove: (from: number, to: number) => void) {
  const [grabbed, setGrabbed] = useState<number>()
  const [drag, setDrag] = useState<{ from: number; to: number }>()

  function finish() {
    if (drag && drag.from !== drag.to) onMove(drag.from, drag.to)
    setDrag(undefined)
    setGrabbed(undefined)
  }

  return {
    row: (i: number) => ({
      draggable: grabbed === i,
      onDragStart: (e: DragEvent) => {
        e.dataTransfer.effectAllowed = "move"
        setDrag({ from: i, to: i })
      },
      onDragOver: (e: DragEvent) => {
        if (!drag) return
        e.preventDefault()
        if (drag.to !== i) setDrag({ ...drag, to: i })
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
    /** Dims the dragged row and draws a line where it will land. */
    rowClass: (i: number) =>
      cn(
        drag?.from === i && "opacity-40",
        drag &&
          drag.to === i &&
          drag.from !== i &&
          (drag.to < drag.from ? "shadow-[inset_0_2px_0_var(--primary)]" : "shadow-[inset_0_-2px_0_var(--primary)]"),
      ),
  }
}

