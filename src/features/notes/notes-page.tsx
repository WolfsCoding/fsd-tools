import { useMemo, useState, type ReactNode } from "react"
import { Navigate, NavLink, Route, Routes, useNavigate, useParams } from "react-router"
import { EllipsisIcon, FilePlusIcon, FileTextIcon, NotebookPenIcon, PencilIcon, Trash2Icon } from "lucide-react"
import { cn } from "cn"
import { Hint } from "@/components/hint"
import { InlineEdit } from "@/components/inline-edit"
import { EmptyList, NoResults } from "@/components/no-results"
import { SearchField } from "@/components/search-field"
import { SidePanel } from "@/components/side-panel"
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
      <Route
        index
        element={
          <Layout api={api} actions={actions}>
            <Home api={api} onCreate={actions.onCreate} />
          </Layout>
        }
      />
      <Route path=":noteId" element={<NoteRoute api={api} actions={actions} />} />
    </Routes>
  )
}

function NoteRoute({ api, actions }: { api: NotesApi; actions: ListActions }) {
  const { noteId } = useParams()
  const note = api.notes.find((n) => n.id === noteId)
  if (!note) return <Navigate to=".." replace />
  return (
    <Layout api={api} currentId={note.id} actions={actions}>
      <NoteEditor
        key={note.id}
        note={note}
        onChange={(patch) => api.updateNote(note.id, patch)}
        autoFocusTitle={note.id === actions.createdId}
      />
    </Layout>
  )
}

function Layout({
  api,
  currentId,
  actions,
  children,
}: {
  api: NotesApi
  currentId?: string
  actions: ListActions
  children: ReactNode
}) {
  return (
    <div className="flex min-h-0 flex-1">
      {/* On phones the list and the open note take turns. */}
      <NoteList api={api} currentId={currentId} actions={actions} />
      <div className={cn("min-h-0 flex-1 flex-col", currentId ? "flex" : "hidden md:flex")}>{children}</div>
    </div>
  )
}

const ROW = "grid gap-0.5 rounded-md px-2.5 py-2 pr-9"

function NoteList({
  api,
  currentId,
  actions,
}: {
  api: NotesApi
  currentId?: string
  actions: ListActions
}) {
  const [query, setQuery] = useState("")
  // The open note keeps its place while it is edited and moves up once another one opens.
  const openedAt = api.notes.find((n) => n.id === currentId)?.updatedAt
  const [pinned, setPinned] = useState({ id: currentId, updatedAt: openedAt })
  if (pinned.id !== currentId) setPinned({ id: currentId, updatedAt: openedAt })

  const q = query.trim().toLowerCase()
  const sortKey = (n: Note) => (n.id === pinned.id && pinned.updatedAt) || n.updatedAt
  const shown = (
    q ? api.notes.filter((n) => n.title.toLowerCase().includes(q) || noteText(n).toLowerCase().includes(q)) : api.notes
  ).toSorted((a, b) => sortKey(b).localeCompare(sortKey(a)))

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

  return (
    <SidePanel title="Notizen" mobileHidden={!!currentId}>
      <div className="flex gap-2 p-4">
        <SearchField value={query} onChange={setQuery} aria-label="Notizen durchsuchen" focusKey />
        <Hint label="Neue Notiz">
          <Button size="icon" onClick={actions.onCreate} aria-label="Neue Notiz">
            <FilePlusIcon />
          </Button>
        </Hint>
      </div>

      <nav className="grid min-h-0 flex-1 content-start gap-px overflow-y-auto px-4 pb-4">
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
              <div key={n.id} className={cn(ROW, n.id === currentId && "bg-accent")}>
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
                  <NavLink
                    to={notePath(n.id)}
                    data-note-id={n.id}
                    onDoubleClick={() => actions.onRename(n.id)}
                    onKeyDown={(e) => {
                      if (e.key !== "F2") return
                      e.preventDefault()
                      actions.onRename(n.id)
                    }}
                    className={cn(ROW, "hover:bg-accent/60", n.id === currentId && "bg-accent hover:bg-accent")}
                  >
                    <span className="truncate text-sm font-medium">{noteTitle(n)}</span>
                    {details}
                  </NavLink>
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
                    className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 pointer-coarse:opacity-100"
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
        {q && shown.length === 0 && <NoResults query={query} onReset={() => setQuery("")} />}
        {!q && shown.length === 0 && <EmptyList>Noch keine Notizen</EmptyList>}
      </nav>
    </SidePanel>
  )
}

function Home({ api, onCreate }: { api: NotesApi; onCreate: () => void }) {
  const empty = api.notes.length === 0
  return (
    <Empty className="flex-1">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <NotebookPenIcon />
        </EmptyMedia>
        <EmptyTitle>{empty ? "Noch keine Notizen" : "Keine Notiz geöffnet"}</EmptyTitle>
        <EmptyDescription>
          {empty
            ? "Schreib einfachen Text auf DIN-A4-Seiten – was nicht mehr passt, landet auf der nächsten Seite."
            : "Wähle links eine Notiz aus oder leg eine neue an."}
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
