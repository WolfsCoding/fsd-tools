import { useMemo, useState, type ReactNode } from "react"
import { Navigate, NavLink, Route, Routes, useNavigate, useParams } from "react-router"
import { PencilIcon, PlusIcon, SirenIcon, Trash2Icon } from "lucide-react"
import { cn } from "cn"
import { Hint } from "@/components/hint"
import { InlineEdit } from "@/components/inline-edit"
import { NoResults } from "@/components/no-results"
import { SearchField } from "@/components/search-field"
import { SidePanel } from "@/components/side-panel"
import { Button } from "@/components/ui/button"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { useRegisterCommands, type CommandGroupDef } from "@/hooks/use-command-palette"
import { formatRelative } from "@/lib/format-date"
import { removedToast } from "@/lib/undo"
import { OperationBoard } from "./operation-board"
import { operationPath } from "./paths"
import { Shortcut } from "./task-row"
import type { Operation } from "./types"
import { operationTitle, useOperations } from "./use-operations"

type Api = ReturnType<typeof useOperations>

/** What the list needs from the page: creating, renaming and deleting operations. */
interface ListActions {
  onCreate: () => void
  /** The operation whose title is being edited in the list. */
  renamingId: string | undefined
  onRename: (id: string | undefined) => void
  onDelete: (operation: Operation) => void
}

/** Operation leader sheets, one per operation. */
export function OperationsPage() {
  const api = useOperations()
  const navigate = useNavigate()
  const [renamingId, setRenamingId] = useState<string | undefined>()

  const actions = useMemo<ListActions>(
    () => ({
      onCreate: () => {
        const id = api.createOperation()
        setRenamingId(id)
        navigate(operationPath(id))
      },
      renamingId,
      onRename: setRenamingId,
      onDelete: (operation) => {
        api.deleteOperation(operation.id)
        removedToast(`„${operationTitle(operation)}“`, () => api.restoreOperation(operation))
      },
    }),
    [api, navigate, renamingId],
  )

  const commandGroups = useMemo<CommandGroupDef[]>(
    () => [
      {
        heading: "Einsatzleitung",
        items: [{ id: "einsatz:new", label: "Neuer Einsatz", icon: PlusIcon, onSelect: actions.onCreate }],
      },
      {
        heading: "Alle Einsätze",
        actionLabel: "Einsatz öffnen",
        items: api.operations.map((e) => ({
          id: `einsatz:${e.id}`,
          label: operationTitle(e),
          keywords: [e.location, ...e.units.map((u) => u.callsign)],
          icon: SirenIcon,
          onSelect: () => navigate(operationPath(e.id)),
        })),
      },
    ],
    [api, navigate, actions.onCreate],
  )
  useRegisterCommands("einsatz", commandGroups)

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
      <Route path=":einsatzId" element={<OperationRoute api={api} actions={actions} />} />
    </Routes>
  )
}

function OperationRoute({ api, actions }: { api: Api; actions: ListActions }) {
  const { einsatzId: operationId } = useParams()
  const operation = api.operations.find((e) => e.id === operationId)
  if (!operation) return <Navigate to=".." replace />
  return (
    <Layout api={api} currentId={operation.id} actions={actions}>
      <OperationBoard key={operation.id} operation={operation} api={api} onDelete={actions.onDelete} />
    </Layout>
  )
}

function Layout({
  api,
  currentId,
  actions,
  children,
}: {
  api: Api
  currentId?: string
  actions: ListActions
  children: ReactNode
}) {
  return (
    <div className="flex min-h-0 flex-1">
      {/* On phones the list and the open operation take turns. */}
      <OperationList api={api} currentId={currentId} actions={actions} />
      <div className={cn("min-h-0 min-w-0 flex-1 flex-col", currentId ? "flex" : "hidden md:flex")}>{children}</div>
    </div>
  )
}

function OperationList({
  api,
  currentId,
  actions,
}: {
  api: Api
  currentId?: string
  actions: ListActions
}) {
  const [query, setQuery] = useState("")

  const q = query.trim().toLowerCase()
  const shown = q
    ? api.operations.filter((e) =>
        [e.title, e.location, ...e.units.map((u) => u.callsign)].some((s) => s.toLowerCase().includes(q)),
      )
    : api.operations
  const running = shown.filter((e) => !e.endedAt)
  const ended = shown.filter((e) => e.endedAt)

  const details = (e: Operation) => (
    <>
      <span className="truncate text-xs text-muted-foreground">{e.location.trim() || "Kein Einsatzort"}</span>
      <span className="text-xs text-muted-foreground/70">
        {formatRelative(e.updatedAt)} · {e.units.length} {e.units.length === 1 ? "Streife" : "Streifen"}
      </span>
    </>
  )
  const dot = (e: Operation) =>
    !e.endedAt && <span aria-label="Läuft" className="size-2 shrink-0 animate-pulse rounded-full bg-red-400" />

  const item = (e: Operation) =>
    actions.renamingId === e.id ? (
      // Edited outside the link, so clicking into the field doesn't follow it.
      <div key={e.id} className="grid gap-0.5 rounded-md bg-accent px-2.5 py-2">
        <span className="flex items-center gap-2">
          {dot(e)}
          <InlineEdit
            value={e.title}
            placeholder="Unbenannter Einsatz"
            aria-label="Titel"
            className="text-sm font-medium"
            onDone={(title) => {
              if (title !== undefined) {
                api.setField(e.id, "title", title)
                api.commitField(e.id, "title", e.title, title)
              }
              actions.onRename(undefined)
            }}
          />
        </span>
        {details(e)}
      </div>
    ) : (
      <ContextMenu key={e.id}>
        <ContextMenuTrigger asChild>
          <NavLink
            to={operationPath(e.id)}
            onDoubleClick={() => actions.onRename(e.id)}
            onKeyDown={(ev) => {
              if (ev.key === "F2") {
                ev.preventDefault()
                actions.onRename(e.id)
              }
            }}
            className={cn(
              "grid gap-0.5 rounded-md px-2.5 py-2 hover:bg-accent/60",
              e.id === currentId && "bg-accent hover:bg-accent",
            )}
          >
            <span className="flex items-center gap-2">
              {dot(e)}
              <span className="truncate text-sm font-medium">{operationTitle(e)}</span>
            </span>
            {details(e)}
          </NavLink>
        </ContextMenuTrigger>
        {/* Not refocusing the row keeps the focus in the title field after "Umbenennen". */}
        <ContextMenuContent onCloseAutoFocus={(ev) => ev.preventDefault()}>
          <ContextMenuItem onSelect={() => actions.onRename(e.id)}>
            <PencilIcon /> Umbenennen <Shortcut>F2</Shortcut>
          </ContextMenuItem>
          <ContextMenuItem variant="destructive" onSelect={() => actions.onDelete(e)}>
            <Trash2Icon /> Löschen
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    )

  return (
    <SidePanel title="Einsätze" mobileHidden={!!currentId}>
      <div className="flex gap-2 p-4">
        {/* The units tab of an open operation has the "/" shortcut. */}
        <SearchField value={query} onChange={setQuery} focusKey={!currentId} aria-label="Einsätze durchsuchen" />
        <Hint label="Neuer Einsatz">
          <Button size="icon" onClick={actions.onCreate} aria-label="Neuer Einsatz">
            <PlusIcon />
          </Button>
        </Hint>
      </div>

      <nav className="grid min-h-0 flex-1 content-start gap-px overflow-y-auto px-4 pb-4">
        {running.length > 0 && <ListHeading>Laufend</ListHeading>}
        {running.map(item)}
        {ended.length > 0 && <ListHeading>Beendet</ListHeading>}
        {ended.map(item)}
        {q && shown.length === 0 && <NoResults query={query} onReset={() => setQuery("")} />}
      </nav>
    </SidePanel>
  )
}

function ListHeading({ children }: { children: ReactNode }) {
  return <p className="px-2.5 pt-3 pb-1 text-xs font-medium text-muted-foreground">{children}</p>
}

function Home({ api, onCreate }: { api: Api; onCreate: () => void }) {
  const empty = api.operations.length === 0
  return (
    <Empty className="flex-1">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SirenIcon />
        </EmptyMedia>
        <EmptyTitle>{empty ? "Noch keine Einsätze" : "Kein Einsatz geöffnet"}</EmptyTitle>
        <EmptyDescription>
          {empty
            ? "Leg einen Einsatz an, um Streifen, ihren Status und ihre Aufgaben im Blick zu behalten. Jede Änderung landet im Verlauf."
            : "Wähle links einen Einsatz aus oder leg einen neuen an."}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={onCreate}>
          <PlusIcon /> Neuer Einsatz
        </Button>
      </EmptyContent>
    </Empty>
  )
}
