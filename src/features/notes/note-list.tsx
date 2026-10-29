import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react"
import { PencilIcon, Trash2Icon } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useOwnIdentity } from "@/features/case-files/use-case-files"
import { useFullscreen } from "@/hooks/use-fullscreen"
import { formatLongDateTime } from "@/lib/format-date"
import { removedToast } from "@/lib/undo"
import { byPosition, useArrangeRow, type Arrange } from "./arrange"
import { DragHandle, FolderItem, ParentItem, ROW } from "./folder-list"
import { useAfterMenuClose } from "./use-after-menu-close"
import { MarkdownEditor, NoteMarkdown } from "./markdown-editor"
import type { Note, NoteFolder } from "./types"
import { noteTitle } from "./use-notes"

/** Changes the stored notes to what `change` returns for them as stored by then. */
export type UpdateNotes = (change: (notes: Note[]) => Note[]) => void

/** Folders shown among the notes, with what to do with them. */
export interface FolderRows {
  items: NoteFolder[]
  /** What is inside, e.g. "1 Ordner · 3 Notizen". */
  describe: (folder: NoteFolder) => string
  /** Id of the folder whose name is being edited in place. */
  renaming: string | null
  onRename: (folder: NoteFolder) => void
  /** The new name, or undefined to keep the old one. */
  onRenameDone: (folder: NoteFolder, name: string | undefined) => void
  onRemove: (folder: NoteFolder) => void
}

const NEW = "new"
const now = () => new Date().toISOString()

/**
 * Notes, each folding open to its Markdown/HTML and edited in place.
 * `creating` opens the dialog for a new one; its button sits with the caller.
 */
export function NoteList({
  notes: shown,
  onUpdate,
  creating,
  onCreatingChange,
  empty,
  reveal,
  folderId,
  folders,
  parent,
  onArrange,
}: {
  /** The notes to list; changes go to all stored ones through `onUpdate`. */
  notes: Note[]
  onUpdate: UpdateNotes
  creating: boolean
  onCreatingChange: (creating: boolean) => void
  /** Shown instead of the list when there are no notes. */
  empty: ReactNode
  /** Note to fold open and scroll to, e.g. when opened from the command palette. */
  reveal?: string
  /** Folder new notes go into. */
  folderId?: string
  /** Folders listed among the notes. */
  folders?: FolderRows
  /** Leads up to this folder (the top level when its id is undefined) with a ".." row first. */
  parent?: { id: string | undefined }
  /** Lets notes and folders be dragged into another place or folder by their handles. */
  onArrange?: Arrange
}) {
  const { identity } = useOwnIdentity()
  // Id of the note being edited in place; one at a time.
  const [editing, setEditing] = useState<string | null>(null)
  const entries = [...shown, ...(folders?.items ?? [])].sort(byPosition)
  // All folded at the start; each folds open on click.
  const [open, setOpen] = useState(() => new Set<string>())
  const toggle = (id: string, isOpen: boolean) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (isOpen) next.add(id)
      else next.delete(id)
      return next
    })

  useEffect(() => {
    if (!reveal) return
    setOpen((prev) => new Set(prev).add(reveal))
    requestAnimationFrame(() => document.getElementById(`note-${reveal}`)?.scrollIntoView({ block: "start" }))
  }, [reveal])

  function save(id: string, title: string, content: string) {
    const at = now()
    if (id === NEW) {
      const note: Note = {
        id: crypto.randomUUID(),
        title,
        content,
        ...(identity.full ? { author: identity.full } : {}),
        ...(folderId ? { folderId } : {}),
        createdAt: at,
        updatedAt: at,
      }
      onUpdate((list) => [...list, note])
      onCreatingChange(false)
    } else {
      onUpdate((list) => list.map((n) => (n.id === id ? { ...n, title, content, updatedAt: at } : n)))
      setEditing(null)
    }
  }

  function remove(note: Note) {
    let index = -1
    if (editing === note.id) setEditing(null)
    onUpdate((list) => {
      index = list.findIndex((n) => n.id === note.id)
      return list.filter((n) => n.id !== note.id)
    })
    removedToast(`Notiz „${note.title}“`, () =>
      onUpdate((list) =>
        list.some((n) => n.id === note.id) ? list : [...list.slice(0, index), note, ...list.slice(index)],
      ),
    )
  }

  return (
    <div className="grid gap-3 has-data-[slot=empty]:flex-1">
      {(entries.length > 0 || parent) && (
        <ul className="divide-y overflow-hidden rounded-lg border stagger-in">
          {parent && <ParentItem parentId={parent.id} onArrange={onArrange} />}
          {entries.map((entry) =>
            "title" in entry ? (
              <NoteItem
                key={entry.id}
                note={entry}
                open={open.has(entry.id) || editing === entry.id}
                editing={editing === entry.id}
                onOpenChange={(isOpen) => toggle(entry.id, isOpen)}
                onEdit={() => setEditing(entry.id)}
                onSave={(title, content) => save(entry.id, title, content)}
                onCancel={() => setEditing(null)}
                onRemove={() => remove(entry)}
                onArrange={onArrange}
              />
            ) : (
              <FolderItem
                key={entry.id}
                folder={entry}
                description={folders!.describe(entry)}
                renaming={folders!.renaming === entry.id}
                onRename={() => folders!.onRename(entry)}
                onRenameDone={(name) => folders!.onRenameDone(entry, name)}
                onRemove={() => folders!.onRemove(entry)}
                onArrange={onArrange}
              />
            ),
          )}
        </ul>
      )}
      {!entries.length && empty}

      <NewNoteDialog
        open={creating}
        author={identity.full || undefined}
        onOpenChange={onCreatingChange}
        onSave={(title, content) => save(NEW, title, content)}
      />
    </div>
  )
}

function NoteItem({
  note,
  open,
  editing,
  onOpenChange,
  onEdit,
  onSave,
  onCancel,
  onRemove,
  onArrange,
}: {
  note: Note
  open: boolean
  editing: boolean
  onOpenChange: (open: boolean) => void
  onEdit: () => void
  onSave: (title: string, content: string) => void
  onCancel: () => void
  onRemove: () => void
  onArrange?: Arrange
}) {
  const drag = useArrangeRow({ item: { kind: "note", id: note.id }, onArrange })
  const menu = useAfterMenuClose()
  return (
    <Collapsible asChild open={open} onOpenChange={(o) => !editing && onOpenChange(o)}>
      <li {...drag.row} id={`note-${note.id}`} className={cn("scroll-mt-4", drag.rowClassName)}>
        {/* "Bearbeiten" and "Löschen" on right click. */}
        <ContextMenu>
          <ContextMenuTrigger asChild>
          <div className={ROW}>
          {drag.handle && <DragHandle label={`„${noteTitle(note)}“ verschieben`} {...drag.handle} />}
          <CollapsibleTrigger className="group/note flex min-w-0 flex-1 items-center gap-2.5 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="grid min-w-0">
              <span className={cn("truncate text-lg font-semibold", !note.title.trim() && "text-muted-foreground italic")}>
                {note.title.trim() || "Ohne Titel"}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                <NoteMeta date={note.createdAt} author={note.author} />
              </span>
            </span>
          </CollapsibleTrigger>
          </div>
          </ContextMenuTrigger>
          <ContextMenuContent onCloseAutoFocus={menu.onCloseAutoFocus}>
            <ContextMenuItem onSelect={menu.later(onEdit)} disabled={editing}>
              <PencilIcon /> Bearbeiten
            </ContextMenuItem>
            <ContextMenuItem variant="destructive" onSelect={onRemove}>
              <Trash2Icon /> Löschen
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        {/* No background, so the note reads like a page under its header. */}
        <CollapsibleContent className="border-t">
          {editing ? (
            <NoteForm note={note} onSave={onSave} onCancel={onCancel} />
          ) : (
            <>
              {note.content.trim() ? (
                <NoteMarkdown className="px-4 py-5">{note.content}</NoteMarkdown>
              ) : (
                <p className="px-4 py-5 text-sm text-muted-foreground italic">Leere Notiz</p>
              )}
              <div className="flex justify-end gap-2 px-4 pb-4">
                <Button variant="outline" size="sm" onClick={onRemove} className="text-red-400">
                  <Trash2Icon /> Löschen
                </Button>
                <Button variant="outline" size="sm" onClick={onEdit}>
                  <PencilIcon /> Bearbeiten
                </Button>
              </div>
            </>
          )}
        </CollapsibleContent>
      </li>
    </Collapsible>
  )
}

/** "Sonntag, 18. Oktober 2026 um 17:36 von HP - Ryan Shaw", as under a note's title. */
function NoteMeta({ date, author }: { date: string; author?: string }) {
  return (
    <>
      {formatLongDateTime(date)}
      {author && (
        <>
          {" "}
          von <span className="font-semibold text-foreground/80">{author}</span>
        </>
      )}
    </>
  )
}

/** Title of the dialog, dated when it opened (it mounts with each opening). */
function NewNoteHeader({ author }: { author?: string }) {
  const [openedAt] = useState(now)
  return (
    <DialogHeader>
      <DialogTitle>Notiz erstellen</DialogTitle>
      <DialogDescription>
        <NoteMeta date={openedAt} author={author} />
      </DialogDescription>
    </DialogHeader>
  )
}

/** Writes a new note, in a dialog like the reports'. */
function NewNoteDialog({
  open,
  author,
  onOpenChange,
  onSave,
}: {
  open: boolean
  author?: string
  onOpenChange: (open: boolean) => void
  onSave: (title: string, content: string) => void
}) {
  // "Vollbild" of the editor fills the dialog, which then grows to the whole screen.
  const contentRef = useRef<HTMLDivElement>(null)
  const [fullscreen, setFullscreen] = useFullscreen(contentRef)
  const change = (o: boolean) => {
    if (!o) setFullscreen(false)
    onOpenChange(o)
  }
  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent
        ref={contentRef}
        className={cn(
          "max-h-[calc(100dvh-2rem)] sm:max-w-[min(110rem,calc(100%-4rem))]",
          // "Vollbild" of the editor makes the dialog fill the screen, the rest stays as it is.
          fullscreen && "top-0 left-0 h-dvh max-h-none max-w-none translate-x-0 translate-y-0 rounded-none sm:max-w-none",
        )}
        // A stray click next to the editor shouldn't throw the note away; Esc and "Abbrechen" still do.
        onInteractOutside={(e) => e.preventDefault()}
        // Esc leaves "Vollbild" first instead of throwing the note away.
        onEscapeKeyDown={(e) => {
          if (!fullscreen) return
          e.preventDefault()
          setFullscreen(false)
        }}
      >
        {open && (
          <NoteForm
            dialog
            header={<NewNoteHeader author={author} />}
            fullscreen={fullscreen}
            onFullscreenChange={setFullscreen}
            onSave={(title, content) => {
              setFullscreen(false)
              onSave(title, content)
            }}
            onCancel={() => change(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Title and text: in a dialog for a new note, else in place of the note. */
function NoteForm({
  note,
  dialog = false,
  header,
  fullscreen,
  onFullscreenChange,
  onSave,
  onCancel,
}: {
  note?: Note
  dialog?: boolean
  header?: ReactNode
  /** The editor's "Vollbild", when the dialog controls it. */
  fullscreen?: boolean
  onFullscreenChange?: (fullscreen: boolean) => void
  onSave: (title: string, content: string) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(note?.title ?? "")
  const [content, setContent] = useState(note?.content ?? "")
  const id = note?.id ?? NEW
  const canSave = !!title.trim()

  function submit(e?: FormEvent) {
    e?.preventDefault()
    if (canSave) onSave(title.trim(), content)
  }

  const fields = (
    <>
      <div className="grid gap-2">
        <Label htmlFor={`note-title-${id}`}>
          <span className="text-destructive">*</span> Titel
        </Label>
        <Input id={`note-title-${id}`} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </div>
      <div className={cn("grid gap-2", fullscreen && "flex min-h-0 flex-1 flex-col")}>
        <Label htmlFor={`note-text-${id}`}>Text</Label>
        <MarkdownEditor
          id={`note-text-${id}`}
          value={content}
          onChange={setContent}
          onSubmit={() => submit()}
          fullscreen={fullscreen}
          onFullscreenChange={onFullscreenChange}
          // In the dialog, the dialog fills the screen and the editor grows with it.
          fullscreenClassName={dialog ? "min-h-0 flex-1" : undefined}
        />
        <p className="text-xs text-muted-foreground">
          Dieses Eingabefeld unterstützt Markdown und ein paar HTML-Tags · Strg+Enter speichert
        </p>
      </div>
    </>
  )
  const buttons = (
    <>
      <Button type="button" variant="outline" onClick={onCancel}>
        Abbrechen
      </Button>
      <Button type="submit" disabled={!canSave}>
        Speichern
      </Button>
    </>
  )

  if (dialog) {
    return (
      <form onSubmit={submit} className="contents">
        <DialogPanel className={cn("overflow-y-auto", fullscreen && "flex flex-1 flex-col")}>
          {header}
          {fields}
        </DialogPanel>
        <DialogFooter>{buttons}</DialogFooter>
      </form>
    )
  }
  return (
    <form onSubmit={submit} className="grid gap-4 p-4">
      {fields}
      <div className="flex items-center justify-end gap-2">{buttons}</div>
    </form>
  )
}
