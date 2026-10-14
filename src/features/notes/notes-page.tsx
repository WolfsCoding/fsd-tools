import { useMemo, useState } from "react"
import { Link, Navigate, Route, Routes, useNavigate, useParams } from "react-router"
import { EllipsisIcon, FilePlusIcon, FileTextIcon, NotebookPenIcon, PencilIcon, Trash2Icon } from "lucide-react"
import { Explorer, EXPLORER_LIST, EXPLORER_ROW } from "@/components/explorer"
import { Hint } from "@/components/hint"
import { InlineEdit } from "@/components/inline-edit"
import { NoResults } from "@/components/no-results"
import { SearchField } from "@/components/search-field"
import { Button } from "@/components/ui/button"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { useRegisterCommands, type CommandGroupDef } from "@/hooks/use-command-palette"
import { formatRelative } from "@/lib/format-date"
import { removedToast } from "@/lib/undo"
import { NoteEditor } from "./note-editor"
import { notePath } from "./paths"
import type { Note } from "./types"
import { noteText, noteTitle, useNotes } from "./use-notes"

type NotesApi = ReturnType<typeof useNotes>

/** What the note list needs from the page: creating, renaming and deleting notes. */
interface ListActions {
  /** Creates a note, opens it and starts naming it in the editor. */
  onCreate: () => void
  /** The note created last, whose editor focuses its title. */
  createdId: string | undefined
  /** The note whose title is being edited in the list. */
  renamingId: string | undefined
  onRename: (id: string | undefined) => void
  onDelete: (note: Note) => void
}

/** Plain-text notes, each made of one or more DIN A4 pages. */
export function NotesPage() {
  const api = useNotes()
  const navigate = useNavigate()
  const [createdId, setCreatedId] = useState<string | undefined>()
  const [renamingId, setRenamingId] = useState<string | undefined>()

  const actions = useMemo<ListActions>(
    () => ({
      onCreate: () => {
        const id = api.createNote()
        setCreatedId(id)
        navigate(notePath(id))
      },
      createdId,
      renamingId,
      onRename: setRenamingId,
      onDelete: (note) => removedToast(`Notiz „${noteTitle(note)}"`, api.deleteNote(note.id)),
    }),
    [api, navigate, createdId, renamingId],
  )

  const commandGroups = useMemo<CommandGroupDef[]>(
    () => [
      {
        heading: "Notizen",
        items: [{ id: "notes:new", label: "Neue Notiz", icon: FilePlusIcon, onSelect: actions.onCreate }],
      },
      {
        heading: "Alle Notizen",
        actionLabel: "Notiz öffnen",
        items: api.notes.map((n) => ({
          id: `notes:note:${n.id}`,
          label: noteTitle(n),
          keywords: [noteText(n).slice(0, 500)],
          icon: FileTextIcon,
          onSelect: () => navigate(notePath(n.id)),
        })),
      },
    ],
    [api, navigate, actions.onCreate],
  )
  useRegisterCommands("notes", commandGroups)

  return (
    <Routes>
      <Route index element={<NoteList api={api} actions={actions} />} />
      <Route path=":noteId" element={<NoteRoute api={api} actions={actions} />} />
    </Routes>
  )
}

function NoteRoute({ api, actions }: { api: NotesApi; actions: ListActions }) {
  const { noteId } = useParams()
  const note = api.notes.find((n) => n.id === noteId)
  if (!note) return <Navigate to=".." replace />
  return (
    <NoteEditor
      key={note.id}
      note={note}
      onChange={(patch) => api.updateNote(note.id, patch)}
      autoFocusTitle={note.id === actions.createdId}
    />
  )
}

function NoteList({ api, actions }: { api: NotesApi; actions: ListActions }) {
  const [query, setQuery] = useState("")

  const q = query.trim().toLowerCase()
  const shown = (
    q ? api.notes.filter((n) => n.title.toLowerCase().includes(q) || noteText(n).toLowerCase().includes(q)) : api.notes
  ).toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  function finishRename(n: Note, title: string | undefined) {
    if (title !== undefined) api.updateNote(n.id, { title })
    actions.onRename(undefined)
    // Back to the row, unless the field lost focus to something else.
    requestAnimationFrame(() => {
      if (document.activeElement === document.body) {
        document.querySelector<HTMLElement>(`[data-note-id="${n.id}"]`)?.focus()
      }
    })
  }

  if (api.notes.length === 0) return <Home onCreate={actions.onCreate} />

  return (
    <Explorer
      title="Notizen"
      toolbar={
        <>
          <SearchField value={query} onChange={setQuery} aria-label="Notizen durchsuchen" focusKey />
          <Hint label="Neue Notiz">
            <Button size="icon" onClick={actions.onCreate} aria-label="Neue Notiz">
              <FilePlusIcon />
            </Button>
          </Hint>
        </>
      }
    >
      <nav className={EXPLORER_LIST}>
        {shown.map((n) => {
          const details = (
            <>
              <span className="truncate text-xs text-muted-foreground">
                {noteText(n).trim().split("\n")[0] || "Leer"}
              </span>
              <span className="text-xs text-muted-foreground/70">
                {formatRelative(n.updatedAt)} · {n.pages.length} {n.pages.length === 1 ? "Seite" : "Seiten"}
              </span>
            </>
          )
          const items = [
            { label: "Umbenennen", icon: PencilIcon, onSelect: () => actions.onRename(n.id) },
            { label: "Löschen", icon: Trash2Icon, onSelect: () => actions.onDelete(n), destructive: true },
          ]

          if (actions.renamingId === n.id) {
            return (
              <div key={n.id} className={EXPLORER_ROW}>
                <InlineEdit
                  value={n.title}
                  onDone={(title) => finishRename(n, title)}
                  allowEmpty
                  placeholder="Ohne Titel"
                  aria-label="Titel"
                  className="text-sm font-medium"
                />
                {details}
              </div>
            )
          }

          return (
            <div key={n.id} className="group relative">
              <ContextMenu>
                <ContextMenuTrigger asChild>
                  <Link
                    to={notePath(n.id)}
                    data-note-id={n.id}
                    onKeyDown={(e) => {
                      if (e.key !== "F2") return
                      e.preventDefault()
                      actions.onRename(n.id)
                    }}
                    className={EXPLORER_ROW}
                  >
                    <span className="truncate text-sm font-medium">{noteTitle(n)}</span>
                    {details}
                  </Link>
                </ContextMenuTrigger>
                {/* Not refocusing the row keeps the focus in the title field after "Umbenennen". */}
                <ContextMenuContent onCloseAutoFocus={(e) => e.preventDefault()}>
                  {items.map((item) => (
                    <ContextMenuItem
                      key={item.label}
                      variant={item.destructive ? "destructive" : undefined}
                      onSelect={item.onSelect}
                    >
                      <item.icon /> {item.label}
                    </ContextMenuItem>
                  ))}
                </ContextMenuContent>
              </ContextMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Aktionen für „${noteTitle(n)}"`}
                    className="absolute top-1/2 right-2 -translate-y-1/2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 pointer-coarse:opacity-100"
                  >
                    <EllipsisIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  {items.map((item) => (
                    <DropdownMenuItem
                      key={item.label}
                      variant={item.destructive ? "destructive" : undefined}
                      onSelect={item.onSelect}
                    >
                      <item.icon /> {item.label}
                      {item.label === "Umbenennen" && <span className="ml-auto text-xs text-muted-foreground">F2</span>}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        })}
      </nav>
      {q && shown.length === 0 && <NoResults query={query} onReset={() => setQuery("")} />}
    </Explorer>
  )
}

function Home({ onCreate }: { onCreate: () => void }) {
  return (
    <Empty className="flex-1">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <NotebookPenIcon />
        </EmptyMedia>
        <EmptyTitle>Noch keine Notizen</EmptyTitle>
        <EmptyDescription>
          Schreib einfachen Text auf DIN-A4-Seiten – was nicht mehr passt, landet auf der nächsten Seite.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={onCreate}>
          <FilePlusIcon /> Neue Notiz
        </Button>
      </EmptyContent>
    </Empty>
  )
}
