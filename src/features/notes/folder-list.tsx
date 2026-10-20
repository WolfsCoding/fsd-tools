import type { ComponentProps } from "react"
import { Link } from "react-router"
import { CornerLeftUpIcon, FolderIcon, FolderOpenIcon, GripVerticalIcon, PencilIcon, Trash2Icon } from "lucide-react"
import { cn } from "cn"
import { InlineEdit } from "@/components/inline-edit"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import { useArrangeRow, type Arrange } from "./arrange"
import { useAfterMenuClose } from "./use-after-menu-close"
import { folderName } from "./folders"
import { folderPath } from "./paths"
import type { NoteFolder } from "./types"

/** Row of the list; notes, folders and ".." look alike. */
export const ROW = "flex items-center gap-2 bg-card px-3 py-2.5 transition-colors"

/** Grip at the start of a row; dragging it moves the row. */
export function DragHandle({ label, className, ...props }: ComponentProps<"span"> & { label: string }) {
  return (
    <span
      aria-label={label}
      title={label}
      className={cn(
        "-ml-1 flex h-8 w-5 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground/60 hover:bg-accent hover:text-foreground active:cursor-grabbing",
        className,
      )}
      {...props}
    >
      <GripVerticalIcon className="size-4" />
    </span>
  )
}

/**
 * A folder among the notes: opens on click, takes what is dropped in its middle, and
 * offers "Umbenennen" and "Löschen" on right click. Renaming turns its name into a field.
 */
export function FolderItem({
  folder,
  description,
  renaming,
  onRename,
  onRenameDone,
  onRemove,
  onArrange,
}: {
  folder: NoteFolder
  /** What is inside, e.g. "1 Ordner · 3 Notizen". */
  description: string
  renaming: boolean
  onRename: () => void
  /** The new name, or undefined to keep the old one. */
  onRenameDone: (name: string | undefined) => void
  onRemove: () => void
  onArrange?: Arrange
}) {
  const drag = useArrangeRow({ item: { kind: "folder", id: folder.id }, into: { id: folder.id }, onArrange })
  const menu = useAfterMenuClose()
  const name = folderName(folder)
  const body = (
    <>
      {drag.zone === "into" ? (
        <FolderOpenIcon className="size-4 shrink-0 text-primary" />
      ) : (
        <FolderIcon className="size-4 shrink-0 fill-current text-amber-400/80" />
      )}
      <span className="grid min-w-0 flex-1">
        {renaming ? (
          <InlineEdit value={folder.name} onDone={onRenameDone} aria-label="Ordnername" className="text-lg font-semibold" />
        ) : (
          <span className="truncate text-lg font-semibold">{name}</span>
        )}
        <span className="truncate text-xs text-muted-foreground">{description}</span>
      </span>
    </>
  )
  const BODY = "flex min-w-0 flex-1 items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <li {...drag.row} className={cn(ROW, drag.rowClassName)}>
          {drag.handle && <DragHandle label={`„${name}“ verschieben`} {...drag.handle} />}
          {/* A link would follow clicks into the field, so it waits until the name is saved. */}
          {renaming ? (
            <div className={BODY}>{body}</div>
          ) : (
            <Link to={folderPath(folder.id)} className={BODY}>
              {body}
            </Link>
          )}
        </li>
      </ContextMenuTrigger>
      <ContextMenuContent onCloseAutoFocus={menu.onCloseAutoFocus}>
        <ContextMenuItem onSelect={menu.later(onRename)}>
          <PencilIcon /> Umbenennen
        </ContextMenuItem>
        <ContextMenuItem variant="destructive" onSelect={onRemove}>
          <Trash2Icon /> Löschen
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

/** "..": leads to the folder around the open one and takes what is dropped onto it. */
export function ParentItem({ parentId, onArrange }: { parentId: string | undefined; onArrange?: Arrange }) {
  const drag = useArrangeRow({ into: { id: parentId }, onArrange })
  return (
    <li {...drag.row} className={cn(ROW, drag.rowClassName)}>
      <Link
        to={folderPath(parentId)}
        aria-label="Zurück zum übergeordneten Ordner"
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <CornerLeftUpIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="text-lg font-semibold tracking-widest">...</span>
      </Link>
    </li>
  )
}
