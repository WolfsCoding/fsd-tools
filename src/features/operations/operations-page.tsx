import { useCallback, useMemo, useState, type FormEvent } from "react"
import { Link, Navigate, Route, Routes, useNavigate, useParams } from "react-router"
import { EllipsisIcon, PlusIcon, SirenIcon, Trash2Icon } from "lucide-react"
import { cn } from "cn"
import { Explorer } from "@/components/explorer"
import { NoResults } from "@/components/no-results"
import { SearchField } from "@/components/search-field"
import { Button } from "@/components/ui/button"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogPanel, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useRegisterCommands, type CommandGroupDef } from "@/hooks/use-command-palette"
import { formatDateAndTime } from "@/lib/format-date"
import { removedToast } from "@/lib/undo"
import { OperationView } from "./operation-view"
import { operationPath } from "./paths"
import type { Operation } from "./types"
import { useOperations, type OperationsApi } from "./use-operations"

/** The Einsatzleitung: one sheet per operation. */
export function OperationsPage() {
  const api = useOperations()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)

  const onDelete = useCallback(
    (operation: Operation) => {
      api.remove(operation.id)
      removedToast(`„${operation.title}“`, () => api.restore(operation))
    },
    [api],
  )

  // Registered again only when a title changes, not on every edit.
  const listed = api.operations.map((o) => `${o.id}\t${o.title}`).join("\n")
  const commandGroups = useMemo<CommandGroupDef[]>(
    () => [
      {
        heading: "Einsatzleitung",
        items: [{ id: "operations:new", label: "Neuer Einsatz", icon: PlusIcon, onSelect: () => setCreating(true) }],
      },
      {
        heading: "Alle Einsätze",
        actionLabel: "Einsatz öffnen",
        items: (listed ? listed.split("\n") : []).map((line) => {
          const [id, label] = line.split("\t")
          return { id: `operations:${id}`, label, icon: SirenIcon, onSelect: () => navigate(operationPath(id)) }
        }),
      },
    ],
    [listed, navigate],
  )
  useRegisterCommands("operations", commandGroups)

  return (
    <>
      <Routes>
        <Route index element={<OperationList api={api} onNew={() => setCreating(true)} onDelete={onDelete} />} />
        <Route path=":operationId" element={<OperationRoute api={api} onDelete={onDelete} />} />
      </Routes>
      <NewOperationDialog
        open={creating}
        onOpenChange={setCreating}
        onCreate={(title) => {
          setCreating(false)
          navigate(operationPath(api.create(title)))
        }}
      />
    </>
  )
}

function OperationRoute({ api, onDelete }: { api: OperationsApi; onDelete: (operation: Operation) => void }) {
  const { operationId } = useParams()
  const operation = api.operations.find((o) => o.id === operationId)
  if (!operation) return <Navigate to=".." replace />
  return <OperationView key={operation.id} operation={operation} api={api} onDelete={onDelete} />
}

const GAP = "pr-20"

function OperationList({ api, onNew, onDelete }: { api: OperationsApi; onNew: () => void; onDelete: (operation: Operation) => void }) {
  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()
  const shown = api.operations.filter((o) => !q || [o.title, o.ort].some((s) => s.toLowerCase().includes(q)))

  const row = (o: Operation) => (
    <ContextMenu key={o.id}>
      <ContextMenuTrigger asChild>
        {/* The title's link covers the whole row, so any cell opens the operation. */}
        <TableRow className="group/item relative">
          <TableCell className="w-full max-w-0 truncate font-medium">
            <Link
              to={operationPath(o.id)}
              className="outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
            >
              {o.title}
            </Link>
          </TableCell>
          <TableCell className={cn(GAP, !o.ort.trim() && "text-muted-foreground")}>{o.ort.trim() || "—"}</TableCell>
          <TableCell className={cn(GAP, "tabular-nums")}>{o.patrols.length}</TableCell>
          <TableCell className={cn(GAP, "tabular-nums")}>{o.people.length}</TableCell>
          <TableCell className={cn(GAP, "tabular-nums")}>{formatDateAndTime(o.createdAt)}</TableCell>
          <TableCell className="relative w-0 py-0 pr-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Aktionen für „${o.title}“`}
                  className="text-muted-foreground opacity-0 group-focus-within/item:opacity-100 group-hover/item:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                >
                  <EllipsisIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem variant="destructive" onSelect={() => onDelete(o)}>
                  <Trash2Icon /> Löschen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TableCell>
        </TableRow>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem variant="destructive" onSelect={() => onDelete(o)}>
          <Trash2Icon /> Löschen
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )

  return (
    <Explorer
      title="Einsätze"
      toolbar={
        <>
          <SearchField value={query} onChange={setQuery} focusKey aria-label="Einsätze durchsuchen" />
          <Button onClick={onNew}>
            <PlusIcon /> Neuer Einsatz
          </Button>
        </>
      }
    >
      {api.operations.length === 0 ? (
        <Empty className="p-6">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SirenIcon />
            </EmptyMedia>
            <EmptyTitle>Noch keine Einsätze</EmptyTitle>
            <EmptyDescription>
              Streifen, Fahrzeuge und Beteiligte während des Einsatzes führen und daraus eine Sammelakte erstellen.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={onNew}>
              <PlusIcon /> Neuer Einsatz
            </Button>
          </EmptyContent>
        </Empty>
      ) : shown.length === 0 ? (
        <NoResults query={query} onReset={() => setQuery("")} />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                <TableHead>Titel</TableHead>
                <TableHead className={GAP}>Ort</TableHead>
                <TableHead className={GAP}>Streifen</TableHead>
                <TableHead className={GAP}>Personen</TableHead>
                <TableHead className={GAP}>Erstellt</TableHead>
                <TableHead className="w-0">
                  <span className="sr-only">Aktionen</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{shown.map(row)}</TableBody>
          </Table>
        </div>
      )}
    </Explorer>
  )
}

/** Asks for the title of a new operation. */
function NewOperationDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (title: string) => void
}) {
  const [title, setTitle] = useState("")
  function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    onCreate(title.trim())
    setTitle("")
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="contents">
          <DialogPanel>
            <DialogHeader>
              <DialogTitle>Neuer Einsatz</DialogTitle>
              <DialogDescription>Der Titel lässt sich später ändern.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="einsatz-titel">Titel</Label>
              <Input id="einsatz-titel" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder="z. B. Banküberfall Pillbox" />
            </div>
          </DialogPanel>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={!title.trim()}>
              Erstellen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
