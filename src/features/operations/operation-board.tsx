import { useState } from "react"
import { Link, useSearchParams } from "react-router"
import {
  AtSignIcon,
  CheckCheckIcon,
  ChevronLeftIcon,
  ClipboardCheckIcon,
  ClipboardCopyIcon,
  ClockIcon,
  EllipsisIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  ListFilterIcon,
  LockIcon,
  LockOpenIcon,
  MapPinIcon,
  PlusIcon,
  RotateCcwIcon,
  ShieldIcon,
  Trash2Icon,
} from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { copy } from "@/lib/clipboard"
import { formatDate } from "@/lib/format-date"
import { sameText } from "@/lib/text"
import { removedToast } from "@/lib/undo"
import { Hint } from "@/components/hint"
import { InlineEdit } from "@/components/inline-edit"
import { EmptyList, NoResults } from "@/components/no-results"
import { SearchField } from "@/components/search-field"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useTabTitle } from "@/hooks/use-tabs"
import { useOwnIdentity, type Identity } from "@/features/case-files/use-case-files"
import { useCollectiveFile } from "./collective-file"
import { DebriefDialog } from "./debrief"
import { LockedContext, useEditSession, useLocked } from "./edit-state"
import { OperationChat, type ChatView } from "./operation-chat"
import { formatDuration, formatTime, useNow } from "./format"
import { GuideSheet } from "./guide-sheet"
import { LageTab } from "./lage-tab"
import { LeadsTab } from "./leads-tab"
import { OPERATIONS_BASE } from "./paths"
import { TASK_PRIORITY_LABEL } from "./priority"
import { operationReport } from "./report"
import { TaskList } from "./task-list"
import { AddTaskInput, PriorityOptions } from "./task-row"
import { LEAD_ROLES, type Operation, type TaskPriority, type Unit } from "./types"
import { UnitCard } from "./unit-card"
import { UnitPicker } from "./unit-picker"
import { DROPDOWN_KIT } from "./menu-kit"
import {
  duplicateCallsigns,
  leaderName,
  leadMember,
  operationTitle,
  unitNames,
  type OperationField,
  type useOperations,
} from "./use-operations"

type Api = ReturnType<typeof useOperations>

const TABS = ["lage", "leads", "units", "tasks", "notes"] as const
type Tab = (typeof TABS)[number]

/** The open tab, kept in the URL (`?tab=units`) so reloading and going back keep it. */
function useTabParam() {
  const [params, setParams] = useSearchParams()
  const value = params.get("tab")
  const tab: Tab = TABS.find((t) => t === value) ?? "lage"
  const setTab = (next: string) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        if (next === "lage") p.delete("tab")
        else p.set("tab", next)
        return p
      },
      { replace: true },
    )
  return [tab, setTab] as const
}

/**
 * The operation leader's sheet: units and tasks in tabs, the history as a chat on the side.
 * Finished operations are read-only until they're unlocked.
 */
export function OperationBoard({
  operation,
  api,
  onDelete,
}: {
  operation: Operation
  api: Api
  onDelete: (operation: Operation) => void
}) {
  const now = useNow()
  const [tab, setTab] = useTabParam()
  const [chatView, setChatView] = useState<ChatView>("notes")
  const [unitFilterId, setUnitFilterId] = useState<string | undefined>()
  const [unlocked, setUnlocked] = useState(false)
  const [debriefing, setDebriefing] = useState(false)
  useTabTitle(operationTitle(operation))
  const me = useOwnIdentity().identity
  const leader = leaderName(operation, me)
  const coel = leadMember(operation, "coel")
  const locked = !!operation.endedAt && !unlocked

  // Wide screens show the notes next to the sheet, narrow ones in their own tab.
  const wide = useMediaQuery("(min-width: 1024px)")
  const activeTab = wide && tab === "notes" ? "units" : tab

  const id = operation.id
  const openTasks = operation.tasks.filter((t) => !t.done).length
  const notes = operation.log.filter((l) => l.kind === "notiz").length
  const leads = LEAD_ROLES.filter((r) => leadMember(operation, r)).length
  const copyReport = () => copy(operationReport(operation, me), "Bericht")
  const collectiveFile = useCollectiveFile(operation, api)

  function finish() {
    api.finish(id)
    setUnlocked(false)
    setDebriefing(true)
  }

  const chat = (
    <OperationChat
      log={operation.log}
      units={operation.units}
      view={chatView}
      onViewChange={setChatView}
      unitFilter={operation.units.find((u) => u.id === unitFilterId)}
      onUnitFilterChange={(u) => setUnitFilterId(u?.id)}
      onSend={(text, unitIds) => api.addNote(id, text, unitIds)}
      onEdit={(entry, text) => api.editNote(id, entry.id, text)}
      onDelete={(entry) => {
        api.deleteNote(id, entry.id)
        removedToast("Notiz", () => api.restoreNote(id, entry))
      }}
    />
  )

  return (
    <LockedContext value={locked}>
      <div className="flex min-h-0 flex-1">
        <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <section className="grid gap-1">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon-sm" asChild className="md:hidden">
                <Link to={OPERATIONS_BASE} aria-label="Alle Einsätze">
                  <ChevronLeftIcon />
                </Link>
              </Button>
              <HeaderField
                operation={operation}
                api={api}
                field="title"
                placeholder="Unbenannter Einsatz"
                className="min-w-0 flex-1 text-xl font-semibold"
              />
              <span className="flex shrink-0 items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {locked && <LockIcon className="size-3" />}
                {operation.endedAt ? "Beendet" : "Läuft"}
              </span>
              <div className="ml-2 flex shrink-0 items-center gap-2">
                <GuideSheet />
                {operation.endedAt && (
                  <Hint label={locked ? "Beendeten Einsatz wieder bearbeiten" : "Wieder schreibschützen"}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUnlocked(locked)}
                      aria-label={locked ? "Bearbeiten entsperren" : "Sperren"}
                    >
                      {locked ? <LockOpenIcon /> : <LockIcon />}
                      <span className="hidden lg:inline">{locked ? "Bearbeiten entsperren" : "Sperren"}</span>
                    </Button>
                  </Hint>
                )}
                {operation.endedAt ? (
                  <Hint label="Wieder aufnehmen">
                    <Button variant="outline" size="sm" onClick={() => api.reopen(id)} aria-label="Wieder aufnehmen">
                      <RotateCcwIcon /> <span className="hidden lg:inline">Wieder aufnehmen</span>
                    </Button>
                  </Hint>
                ) : (
                  <Hint label="Einsatz beenden">
                    <Button size="sm" onClick={finish} aria-label="Einsatz beenden">
                      <CheckCheckIcon /> <span className="hidden lg:inline">Einsatz beenden</span>
                    </Button>
                  </Hint>
                )}
                <DropdownMenu>
                  <Hint label="Weitere Aktionen">
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label="Weitere Aktionen">
                        <EllipsisIcon />
                      </Button>
                    </DropdownMenuTrigger>
                  </Hint>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem onSelect={copyReport}>
                      <ClipboardCopyIcon /> Bericht kopieren
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setDebriefing(true)}>
                      <ClipboardCheckIcon /> Nachbesprechung
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={collectiveFile.open}>
                      {collectiveFile.exists ? (
                        <>
                          <FolderOpenIcon /> Sammelakte öffnen
                        </>
                      ) : (
                        <>
                          <FolderPlusIcon /> Sammelakte anlegen
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => onDelete(operation)}>
                      <Trash2Icon /> Einsatz löschen
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <label className="flex min-w-48 flex-1 items-center gap-2">
                <MapPinIcon className="size-4 shrink-0" />
                <span className="sr-only">Einsatzort</span>
                <HeaderField
                  operation={operation}
                  api={api}
                  field="location"
                  placeholder="Einsatzort"
                  className="flex-1 text-foreground"
                />
              </label>
              <p className="flex items-center gap-2 tabular-nums">
                <ClockIcon className="size-4 shrink-0" />
                {formatDate(operation.createdAt)}, {formatTime(operation.createdAt)}
                {operation.endedAt
                  ? ` – ${formatTime(operation.endedAt)} (${formatDuration(operation.createdAt, operation.endedAt)})`
                  : ` · seit ${formatDuration(operation.createdAt, now)}`}
              </p>
              <button
                type="button"
                onClick={() => setTab("leads")}
                className={cn("flex items-center gap-2 hover:text-foreground", !leader && "text-amber-400")}
              >
                <ShieldIcon className="size-4 shrink-0" />
                {leader ? `EL ${leader}` : "Keine EL"}
                {coel && ` · Co-EL ${coel.member.name}`}
              </button>
            </div>
          </section>

          <Tabs value={activeTab} onValueChange={setTab} className="min-h-0 flex-1 gap-4">
            <TabsList className="max-w-full justify-start overflow-x-auto">
              <TabsTrigger value="lage" className="px-3">
                Lage
              </TabsTrigger>
              <TabsTrigger value="leads" className="px-3">
                Führung <span className="text-muted-foreground tabular-nums">{leads}</span>
              </TabsTrigger>
              <TabsTrigger value="units" className="px-3">
                Streifen <span className="text-muted-foreground tabular-nums">{operation.units.length}</span>
              </TabsTrigger>
              <TabsTrigger value="tasks" className="px-3">
                Aufgaben <span className="text-muted-foreground tabular-nums">{openTasks}</span>
              </TabsTrigger>
              {!wide && (
                <TabsTrigger value="notes" className="px-3">
                  Notizen <span className="text-muted-foreground tabular-nums">{notes}</span>
                </TabsTrigger>
              )}
            </TabsList>
            <TabsContent value="lage">
              <LageTab operation={operation} api={api} />
            </TabsContent>
            <TabsContent value="leads">
              <LeadsTab operation={operation} api={api} me={me} />
            </TabsContent>
            <TabsContent value="units">
              <UnitsTab
                me={me}
                operation={operation}
                api={api}
                now={now}
                onShowLog={(unit) => {
                  setUnitFilterId(unit.id)
                  setChatView("changes")
                  if (!wide) setTab("notes")
                }}
              />
            </TabsContent>
            <TabsContent value="tasks">
              <TasksTab operation={operation} api={api} />
            </TabsContent>
            {!wide && (
              <TabsContent value="notes" className="flex min-h-[28rem] flex-1 flex-col overflow-hidden rounded-lg border">
                {chat}
              </TabsContent>
            )}
          </Tabs>
        </main>

        {wide && <aside className="flex w-96 shrink-0 flex-col border-l">{chat}</aside>}
      </div>

      <DebriefDialog
        operation={operation}
        api={api}
        open={debriefing}
        onOpenChange={setDebriefing}
        onCopyReport={copyReport}
        collectiveFile={collectiveFile}
      />
    </LockedContext>
  )
}

function UnitsTab({
  operation,
  api,
  now,
  me,
  onShowLog,
}: {
  operation: Operation
  api: Api
  now: Date
  me: Identity
  onShowLog: (unit: Unit) => void
}) {
  const locked = useLocked()
  const [query, setQuery] = useState("")
  const [hideEmpty, setHideEmpty] = useState(false)
  const [hideWithdrawn, setHideWithdrawn] = useState(false)
  const [adding, setAdding] = useState(false)
  const filtered = hideEmpty || hideWithdrawn
  const duplicates = duplicateCallsigns(operation.units)

  const q = query.trim().toLowerCase()
  const shown = operation.units.filter(
    (u) =>
      (!hideEmpty || u.members.length > 0) &&
      (!hideWithdrawn || u.status !== "abgezogen") &&
      (!q || [u.callsign, u.description, ...u.members.map((m) => m.name)].some((s) => s.toLowerCase().includes(q))),
  )

  return (
    <div className="@container grid gap-4">
      <div className="flex items-center gap-2">
        <SearchField
          value={query}
          onChange={setQuery}
          focusKey
          placeholder="Suche nach Streife, Beschreibung oder Person…"
          aria-label="Streifen durchsuchen"
          className="min-w-0"
        />
        <DropdownMenu>
          <Hint label="Filter">
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="relative" aria-label="Filter">
                <ListFilterIcon />
                {filtered && <span aria-hidden className="absolute top-1 right-1 size-1.5 rounded-full bg-foreground" />}
              </Button>
            </DropdownMenuTrigger>
          </Hint>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Filter</DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              checked={hideEmpty}
              onCheckedChange={setHideEmpty}
              onSelect={(e) => e.preventDefault()}
            >
              Leere ausblenden
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={hideWithdrawn}
              onCheckedChange={setHideWithdrawn}
              onSelect={(e) => e.preventDefault()}
            >
              Abgezogene ausblenden
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {!locked && (
          <Hint label="Streife hinzufügen">
            <Button size="icon" onClick={() => setAdding(true)} aria-label="Streife hinzufügen">
              <PlusIcon />
            </Button>
          </Hint>
        )}
      </div>

      {operation.units.length === 0 && !adding ? (
        locked ? (
          <EmptyList>Keine Streifen im Einsatz.</EmptyList>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground hover:bg-muted/40"
          >
            Noch keine Streifen. Füge die erste Streife hinzu, um ihr Personal, ihren Status und ihre Aufgaben zu
            verfolgen.
          </button>
        )
      ) : shown.length === 0 && !adding ? (
        q ? (
          <NoResults query={query} onReset={() => setQuery("")} />
        ) : (
          <EmptyList>Keine Streife passt zu den Filtern.</EmptyList>
        )
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 @xl:grid-cols-2 @3xl:grid-cols-3">
          {shown.map((u) => (
            <UnitCard
              key={u.id}
              operation={operation}
              unit={u}
              duplicate={duplicates.has(u.id)}
              me={me}
              api={api}
              now={now}
              onShowLog={() => onShowLog(u)}
            />
          ))}
          {adding && (
            <NewUnitCard
              units={operation.units}
              onDone={(callsign) => {
                if (callsign)
                  api.addUnit(operation.id, { callsign, description: "", status: "verfuegbar", memberNames: [] })
                setAdding(false)
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}

/** Placeholder card while naming a new unit; Enter or leaving the field creates it, Escape or an empty field cancels. */
function NewUnitCard({ units, onDone }: { units: Unit[]; onDone: (callsign: string | undefined) => void }) {
  const [callsign, setCallsign] = useState("")
  const taken = !!callsign.trim() && units.some((u) => sameText(u.callsign, callsign))
  return (
    <article className="rounded-lg border border-dashed bg-card px-4 py-3 text-card-foreground">
      {/* InlineEdit keeps its draft to itself; the input events tell the warning what's typed. */}
      <div onInput={(e) => setCallsign((e.target as HTMLInputElement).value)}>
        <InlineEdit
          value=""
          aria-label="Rufname der neuen Streife"
          placeholder="Rufname, z. B. SANDY - 10"
          className="font-semibold"
          onDone={onDone}
        />
      </div>
      <p className={cn("mt-1 text-xs", taken ? "text-amber-400" : "text-muted-foreground")}>
        {taken ? "Diesen Rufnamen gibt es schon im Einsatz" : "Enter zum Anlegen · Esc zum Abbrechen"}
      </p>
    </article>
  )
}

function TasksTab({ operation, api }: { operation: Operation; api: Api }) {
  const locked = useLocked()
  const [unitIds, setUnitIds] = useState<string[]>([])
  const [priority, setPriority] = useState<TaskPriority>("normal")
  const selected = operation.units.filter((u) => unitIds.includes(u.id))
  const open = operation.tasks.filter((t) => !t.done)
  const done = operation.tasks.filter((t) => t.done)

  return (
    <div className="grid gap-4">
      {!locked && (
        <div className="flex items-center gap-2 rounded-lg border px-2 py-1">
          <AddTaskInput
            placeholder="Neue Aufgabe – Enter zum Anlegen"
            onAdd={(title) => {
              api.addTask(operation.id, title, selected, priority)
              setPriority("normal")
            }}
          />
          <DropdownMenu>
            <Hint label="Priorität">
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("shrink-0", priority === "normal" && "text-muted-foreground")}
                >
                  {TASK_PRIORITY_LABEL[priority]}
                </Button>
              </DropdownMenuTrigger>
            </Hint>
            <DropdownMenuContent align="end" className="w-40">
              <PriorityOptions kit={DROPDOWN_KIT} value={priority} onChange={setPriority} />
            </DropdownMenuContent>
          </DropdownMenu>
          <UnitPicker units={operation.units} value={unitIds} onChange={setUnitIds}>
            <Button
              variant="ghost"
              size="sm"
              className={cn("max-w-56 shrink-0", selected.length === 0 && "text-muted-foreground")}
            >
              <AtSignIcon />
              <span className="truncate">{selected.length ? unitNames(operation.units, unitIds) : "Keine Streife"}</span>
            </Button>
          </UnitPicker>
        </div>
      )}

      <section className="grid gap-2">
        <h3 className="text-sm font-medium text-muted-foreground">Offen ({open.length})</h3>
        {open.length > 0 ? (
          <TaskList operation={operation} tasks={open} api={api} />
        ) : (
          <div className="rounded-lg border border-dashed">
            <EmptyList>Keine offenen Aufgaben.</EmptyList>
          </div>
        )}
      </section>
      {done.length > 0 && (
        <section className="grid gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">Erledigt ({done.length})</h3>
          <TaskList operation={operation} tasks={done} api={api} />
        </section>
      )}
    </div>
  )
}

/**
 * A header field that saves while typing and writes one history entry
 * per edit, once the field loses focus.
 */
function HeaderField({
  operation,
  api,
  field,
  placeholder,
  className,
}: {
  operation: Operation
  api: Api
  field: OperationField
  placeholder: string
  className?: string
}) {
  const locked = useLocked()
  const session = useEditSession(operation[field], (before, after) =>
    api.commitField(operation.id, field, before, after),
  )
  return (
    <input
      value={operation[field]}
      {...session}
      readOnly={locked}
      onChange={(e) => api.setField(operation.id, field, e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      placeholder={placeholder}
      aria-label={placeholder}
      className={cn(
        "-mx-1 h-8 min-w-0 rounded-md bg-transparent px-1 outline-none placeholder:text-muted-foreground/70 read-only:hover:bg-transparent hover:bg-muted/40 focus:bg-muted/50 read-only:focus:bg-transparent",
        className,
      )}
    />
  )
}
