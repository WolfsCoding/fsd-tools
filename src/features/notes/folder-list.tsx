import type { ComponentProps } from "react"
import { Link } from "react-router"
import { CornerLeftUpIcon, FolderIcon, FolderInputIcon, FolderOpenIcon, GripVerticalIcon, PencilIcon, Trash2Icon } from "lucide-react"
import { cn } from "cn"
import { InlineEdit } from "@/components/inline-edit"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { useArrangeRow, type Arrange, type MoveTarget } from "./arrange"
import { useAfterMenuClose } from "./use-after-menu-close"
import { folderName } from "./folders"
import { folderPath } from "./paths"
import type { NoteFolder } from "./types"

/** Row of the list; notes, folders and ".." look alike. */
export const ROW = "flex items-center gap-2 bg-card px-3 py-2.5 transition-colors hover:bg-accent/60"

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

/** "Verschieben nach" in a row's menu: files the note or folder without dragging it. */
export function MoveMenu({ targets, onMove }: { targets: MoveTarget[]; onMove: (folderId: string | undefined) => void }) {
  if (targets.length === 0) return null
  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger>
        <FolderInputIcon /> Verschieben nach
      </ContextMenuSubTrigger>
      <ContextMenuSubContent className="max-h-72 overflow-y-auto">
        {targets.map((t) => (
          <ContextMenuItem key={t.id ?? ""} onSelect={() => onMove(t.id)}>
            {t.id ? <FolderIcon /> : <CornerLeftUpIcon />} {t.label}
          </ContextMenuItem>
        ))}
      </ContextMenuSubContent>
    </ContextMenuSub>
  )
}

/**
 * A folder among the notes: opens on click, takes what is dropped in its middle, and
 * offers "Umbenennen", "Verschieben nach" and "Löschen" on right click. Renaming turns its
 * name into a field.
 */
export function FolderItem({
  folder,
  description,
  renaming,
  onRename,
  onRenameDone,
  onRemove,
  onArrange,
  moveTargets = [],
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
  /** Where "Verschieben nach" can send the folder. */
  moveTargets?: MoveTarget[]
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
          <InlineEdit value={folder.name} onDone={onRenameDone} aria-label="Ordnername" className="text-sm font-medium" />
        ) : (
          <span className="truncate text-sm font-medium">{name}</span>
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
        {onArrange && <MoveMenu targets={moveTargets} onMove={(into) => onArrange({ kind: "folder", id: folder.id }, { into })} />}
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
      {/* Keeps the icon in line with the rows that have a grip. */}
      {drag.handle && <span className="-ml-1 w-5 shrink-0" />}
      {/* As tall as a name with a line below it, like the other rows. */}
      <Link
        to={folderPath(parentId)}
        aria-label="Zurück zum übergeordneten Ordner"
        className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <CornerLeftUpIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="text-sm font-medium">Übergeordneter Ordner</span>
      </Link>
    </li>
  )
}
