import { useState, type DragEvent } from "react"
import { cn } from "cn"
import type { Note, NoteFolder } from "./types"

/** A note or folder in the list. */
export type Item = { kind: "note" | "folder"; id: string }

/** Where a dragged item goes: next to another one, or into a folder (the top level when undefined). */
export type Place = { before: Item } | { after: Item } | { into: string | undefined }

export type Arrange = (item: Item, place: Place) => void

type Zone = "before" | "after" | "into"

const DRAG_ITEM = "application/x-fsd-note-item"

/**
 * Position in the list: folders above notes, each by their `order` once dragged,
 * new and never dragged ones above those, newest first.
 */
export function byPosition(a: Note | NoteFolder, b: Note | NoteFolder) {
  const aIsNote = "title" in a
  if (aIsNote !== "title" in b) return aIsNote ? 1 : -1
  if (a.order !== undefined && b.order !== undefined) return a.order - b.order
  if (a.order !== undefined) return 1
  if (b.order !== undefined) return -1
  return b.createdAt.localeCompare(a.createdAt)
}

/**
 * Drag and drop for one row: its handle drags `item`, and dropping on the row puts
 * what was dragged above or below `item`, or into the folder `into` when given.
 * Without `onArrange` nothing can be dragged or dropped.
 */
export function useArrangeRow({
  item,
  into,
  onArrange,
}: {
  item?: Item
  /** Folder a drop in the middle of the row (or anywhere when there is no `item`) goes into. */
  into?: { id: string | undefined }
  onArrange?: Arrange
}) {
  const [zone, setZone] = useState<Zone | null>(null)

  /** Where a drop at the pointer goes; none for a folder over a note, as folders stay on top. */
  function zoneAt(e: DragEvent): Zone | null {
    if (!e.dataTransfer.types.includes(DRAG_ITEM)) return null
    if (!item) return "into"
    const dragged = e.dataTransfer.types.includes(`${DRAG_ITEM}-note`) ? "note" : "folder"
    if (dragged !== item.kind) return item.kind === "folder" ? "into" : null
    const rect = e.currentTarget.getBoundingClientRect()
    const y = (e.clientY - rect.top) / rect.height
    if (!into) return y < 0.5 ? "before" : "after"
    return y < 0.25 ? "before" : y > 0.75 ? "after" : "into"
  }

  if (!onArrange) return { zone: null, handle: undefined, row: {}, rowClassName: undefined }

  return {
    zone,
    handle: {
      draggable: true,
      onDragStart: (e: DragEvent) => {
        if (!item) return
        e.dataTransfer.setData(DRAG_ITEM, JSON.stringify(item))
        // The kind as a type of its own, since rows can only read types while dragging over them.
        e.dataTransfer.setData(`${DRAG_ITEM}-${item.kind}`, "")
        e.dataTransfer.effectAllowed = "move"
        const row = e.currentTarget.closest("li")
        if (row) e.dataTransfer.setDragImage(row, 16, 16)
      },
    },
    row: {
      onDragOver: (e: DragEvent) => {
        const at = zoneAt(e)
        setZone(at)
        if (!at) return
        e.preventDefault()
        e.dataTransfer.dropEffect = "move"
      },
      onDragLeave: (e: DragEvent) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setZone(null)
      },
      onDrop: (e: DragEvent) => {
        setZone(null)
        const raw = e.dataTransfer.getData(DRAG_ITEM)
        const at = zoneAt(e)
        if (!raw || !at) return
        e.preventDefault()
        const dragged = JSON.parse(raw) as Item
        if (item && dragged.kind === item.kind && dragged.id === item.id) return
        onArrange(dragged, at === "into" || !item ? { into: into?.id } : at === "before" ? { before: item } : { after: item })
      },
    },
    // A line above or below the row, drawn over its children's backgrounds.
    rowClassName: cn(
      "relative",
      (zone === "before" || zone === "after") &&
        "after:pointer-events-none after:absolute after:inset-x-0 after:z-10 after:h-0.5 after:bg-primary",
      zone === "before" && "after:top-0",
      zone === "after" && "after:bottom-0",
      zone === "into" && "bg-accent ring-2 ring-primary ring-inset",
    ),
  }
}
