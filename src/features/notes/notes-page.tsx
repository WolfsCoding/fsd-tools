import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router"
import { FilePlusIcon, FileTextIcon, FolderIcon, FolderPlusIcon, NotebookPenIcon } from "lucide-react"
import { Explorer } from "@/components/explorer"
import { NoResults } from "@/components/no-results"
import { SearchField } from "@/components/search-field"
import { Button } from "@/components/ui/button"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { useRegisterCommands, type CommandGroupDef } from "@/hooks/use-command-palette"
import { useTabTitle, useTabTrail } from "@/hooks/use-tabs"
import { removedToast } from "@/lib/undo"
import { byPosition, type Item, type Place } from "./arrange"
import { useAfterMenuClose } from "./use-after-menu-close"
import { folderName, folderSubtree, folderTrail, useNoteFolders } from "./folders"
import { NoteList } from "./note-list"
import { folderPath, notePath } from "./paths"
import type { Note, NoteFolder } from "./types"
import { noteTitle, useNotes } from "./use-notes"

const now = () => new Date().toISOString()

/** Notes in Markdown/HTML, like the ones about a person, in folders and in the order they're dragged to. */
export function NotesPage() {
  const { notes, updateNotes } = useNotes()
  const [folders, setFolders] = useNoteFolders()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState("")
  const [creating, setCreating] = useState(false)
  // Id of the folder whose name is being edited in place.
  const [renaming, setRenaming] = useState<string | null>(null)
  // Set by the command palette; folded open once, then taken out of the URL again.
  const reveal = params.get("note") ?? undefined

  // Notes and folders whose folder is gone (e.g. after an import) sit at the top level.
  const folderIds = useMemo(() => new Set(folders.map((f) => f.id)), [folders])
  const placeOf = (id: string | undefined) => (id && folderIds.has(id) ? id : undefined)
  const opened = useParams()["*"]
  const current = opened && folderIds.has(opened) ? opened : undefined
  const trail = folderTrail(folders, current)

  useTabTitle(current ? folderName(trail.at(-1)) : undefined)
  useTabTrail(trail.slice(0, -1).map((f) => ({ label: folderName(f), to: folderPath(f.id) })))

  useEffect(() => {
    if (!reveal) return
    setQuery("")
    setParams((p) => (p.delete("note"), p), { replace: true })
  }, [reveal, setParams])

  const menu = useAfterMenuClose()

  /** Adds "Neuer Ordner" on top of the open folder, its name ready to be typed over. */
  const createFolder = useCallback(() => {
    const at = now()
    const id = crypto.randomUUID()
    setQuery("")
    setFolders((list) => [...list, { id, name: "Neuer Ordner", parentId: current, createdAt: at, updatedAt: at }])
    setRenaming(id)
  }, [current, setFolders])

  const commandGroups = useMemo<CommandGroupDef[]>(
    () => [
      {
        heading: "Notizen",
        items: [
          { id: "notes:new", label: "Neue Notiz", icon: FilePlusIcon, onSelect: () => setCreating(true) },
          { id: "notes:new-folder", label: "Neuer Ordner", icon: FolderPlusIcon, onSelect: () => createFolder() },
        ],
      },
      {
        heading: "Alle Ordner",
        actionLabel: "Ordner öffnen",
        items: folders.map((f) => ({
          id: `notes:folder:${f.id}`,
          label: folderName(f),
          icon: FolderIcon,
          onSelect: () => navigate(folderPath(f.id)),
        })),
      },
      {
        heading: "Alle Notizen",
        actionLabel: "Notiz öffnen",
        items: notes.map((n) => ({
          id: `notes:note:${n.id}`,
          label: noteTitle(n),
          keywords: [n.content.slice(0, 500)],
          icon: FileTextIcon,
          onSelect: () => navigate(notePath(n.id, n.folderId && folderIds.has(n.folderId) ? n.folderId : undefined)),
        })),
      },
    ],
    [notes, folders, folderIds, navigate, createFolder],
  )
  useRegisterCommands("notes", commandGroups)

  /** The notes and folders directly in `folderId`, in their order. */
  const contents = (folderId: string | undefined): (Note | NoteFolder)[] =>
    [
      ...notes.filter((n) => placeOf(n.folderId) === folderId),
      ...folders.filter((f) => placeOf(f.parentId) === folderId),
    ].sort(byPosition)

  /** Puts `item` at `place` and numbers everything in its new folder in that order. */
  function arrange(item: Item, place: Place) {
    const ref = "into" in place ? undefined : "before" in place ? place.before : place.after
    const refEntry = ref && (ref.kind === "note" ? notes : folders).find((x) => x.id === ref.id)
    if (ref && !refEntry) return
    const target =
      "into" in place ? place.into : placeOf(refEntry && ("title" in refEntry ? refEntry.folderId : refEntry.parentId))
    // A folder can't go into itself or one inside it.
    if (item.kind === "folder" && target && folderSubtree(folders, item.id).has(target)) return

    const isItem = (e: Note | NoteFolder) => e.id === item.id && ("title" in e) === (item.kind === "note")
    const list = contents(target).filter((e) => !isItem(e))
    const moved = (item.kind === "note" ? notes : folders).find((x) => x.id === item.id)
    if (!moved) return
    // Into a folder goes on top; next to a row goes above or below it.
    const index = ref ? list.findIndex((e) => e === refEntry) + ("after" in place ? 1 : 0) : 0
    list.splice(index, 0, moved)
    const order = new Map(list.map((e, i) => [`${"title" in e ? "note" : "folder"}:${e.id}`, i]))

    setFolders((all) =>
      all.map((f) => {
        const i = order.get(`folder:${f.id}`)
        if (i === undefined) return f
        return item.kind === "folder" && f.id === item.id ? { ...f, order: i, parentId: target } : { ...f, order: i }
      }),
    )
    updateNotes((all) =>
      all.map((n) => {
        const i = order.get(`note:${n.id}`)
        if (i === undefined) return n
        return item.kind === "note" && n.id === item.id ? { ...n, order: i, folderId: target } : { ...n, order: i }
      }),
    )
  }

  function renameFolder(folder: NoteFolder, name: string | undefined) {
    setRenaming(null)
    if (name === undefined) return
    setFolders((list) => list.map((f) => (f.id === folder.id ? { ...f, name, updatedAt: now() } : f)))
  }

  /** Removes the folder with everything in it; "Rückgängig" puts it all back. */
  function removeFolder(folder: NoteFolder) {
    const ids = folderSubtree(folders, folder.id)
    const inside = (id: string | undefined) => !!id && ids.has(id)
    const removedFolders = folders.filter((f) => ids.has(f.id))
    const removedNotes = notes.filter((n) => inside(n.folderId))
    setFolders((list) => list.filter((f) => !ids.has(f.id)))
    updateNotes((list) => list.filter((n) => !inside(n.folderId)))
    removedToast(`Ordner „${folderName(folder)}“`, () => {
      setFolders((list) => [...list, ...removedFolders.filter((f) => !list.some((x) => x.id === f.id))])
      updateNotes((list) => [...list, ...removedNotes.filter((n) => !list.some((x) => x.id === n.id))])
    })
  }

  function describe(folder: NoteFolder) {
    const subfolders = folders.filter((f) => f.parentId === folder.id).length
    const inside = notes.filter((n) => n.folderId === folder.id).length
    return [subfolders && `${subfolders} Ordner`, `${inside} ${inside === 1 ? "Notiz" : "Notizen"}`]
      .filter(Boolean)
      .join(" · ")
  }

  const q = query.trim().toLowerCase()
  // A search looks through all folders.
  const shown = q
    ? notes.filter((n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q))
    : notes.filter((n) => placeOf(n.folderId) === current)
  const subfolders = q ? [] : folders.filter((f) => placeOf(f.parentId) === current)
  const hasAny = notes.length > 0 || folders.length > 0

  return (
    <Explorer
      title="Notizen"
      toolbar={
        hasAny && (
          <>
            <SearchField value={query} onChange={setQuery} aria-label="Notizen durchsuchen" focusKey />
            <Button variant="outline" onClick={createFolder}>
              <FolderPlusIcon /> <span className="hidden sm:inline">Neuer Ordner</span>
            </Button>
            <Button onClick={() => setCreating(true)}>
              <FilePlusIcon /> Neue Notiz
            </Button>
          </>
        )
      }
    >
      {/* Right click on the free space creates notes and folders; rows have menus of their own. */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="flex min-h-full flex-col">
            <NoteList
              notes={shown}
              onUpdate={updateNotes}
              creating={creating}
              onCreatingChange={setCreating}
              reveal={reveal}
              folderId={current}
              folders={{
                items: subfolders,
                describe,
                renaming,
                onRename: (f) => setRenaming(f.id),
                onRenameDone: renameFolder,
                onRemove: removeFolder,
              }}
              parent={current && !q ? { id: placeOf(trail.at(-1)?.parentId) } : undefined}
              // The results of a search come from all folders, so they keep their places.
              onArrange={q ? undefined : arrange}
              empty={
                q ? (
                  <NoResults query={query} onReset={() => setQuery("")} />
                ) : !hasAny ? (
                  <Home onCreate={() => setCreating(true)} onCreateFolder={createFolder} />
                ) : (
                  <p className="py-6 text-center text-sm text-muted-foreground">Dieser Ordner ist leer.</p>
                )
              }
            />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent onCloseAutoFocus={menu.onCloseAutoFocus}>
          <ContextMenuItem onSelect={menu.later(() => setCreating(true))}>
            <FilePlusIcon /> Neue Notiz
          </ContextMenuItem>
          <ContextMenuItem onSelect={menu.later(createFolder)}>
            <FolderPlusIcon /> Neuer Ordner
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </Explorer>
  )
}

function Home({ onCreate, onCreateFolder }: { onCreate: () => void; onCreateFolder: () => void }) {
  return (
    <Empty className="flex-1">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <NotebookPenIcon />
        </EmptyMedia>
        <EmptyTitle>Noch keine Notizen</EmptyTitle>
        <EmptyDescription>Schreib Notizen in Markdown, mit Vorschau daneben, und sortier sie in Ordner.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center">
        <Button variant="outline" onClick={onCreateFolder}>
          <FolderPlusIcon /> Neuer Ordner
        </Button>
        <Button onClick={onCreate}>
          <FilePlusIcon /> Neue Notiz
        </Button>
      </EmptyContent>
    </Empty>
  )
}
