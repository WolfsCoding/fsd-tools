import { useRef, useState, type KeyboardEvent } from "react"
import {
  ArrowRightLeftIcon,
  EllipsisIcon,
  HistoryIcon,
  ListPlusIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  TriangleAlertIcon,
  UserPlusIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@/components/ui/context-menu"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Hint } from "@/components/hint"
import { InlineEdit } from "@/components/inline-edit"
import { sameText } from "@/lib/text"
import { removedToast } from "@/lib/undo"
import type { Identity } from "@/features/case-files/use-case-files"
import { useLocked } from "./edit-state"
import { formatDuration, formatTime } from "./format"
import { LEAD_LABEL, LEAD_SHORT } from "./guide"
import { MEMBER_STATE_ICON, MEMBER_STATE_LABEL } from "./member-state"
import { CONTEXT_KIT, DROPDOWN_KIT, type MenuKit } from "./menu-kit"
import { STATUS_LABEL } from "./status"
import { StatusOptions, StatusSquare } from "./status-badge"
import { Shortcut, TaskRow } from "./task-row"
import { MEMBER_STATES, type Member, type MemberState, type Operation, type Unit } from "./types"
import { memberRoles, sortTasks, unitName, type useOperations } from "./use-operations"

type Api = ReturnType<typeof useOperations>
type Editing = "callsign" | "description" | undefined

/** Classes of the "⋯" button of a row or card: shown on hover and while focused, always on touch screens. */
const MORE_BUTTON =
  "opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 pointer-coarse:opacity-100"

/**
 * A unit on the sheet: call sign, description, status, personnel and its tasks.
 * Double-click a text or press F2 to edit it in place; the "⋯" button and right-click open the same menu.
 */
export function UnitCard({
  operation,
  unit,
  duplicate,
  me,
  api,
  now,
  onShowLog,
}: {
  operation: Operation
  unit: Unit
  /** Whether another unit has the same call sign. */
  duplicate: boolean
  /** The user, who always leads the operation. */
  me: Identity
  api: Api
  now: Date
  onShowLog: () => void
}) {
  const locked = useLocked()
  const [editing, setEditing] = useState<Editing>()
  const [adding, setAdding] = useState(false)
  const [addingTask, setAddingTask] = useState(false)
  const [showDone, setShowDone] = useState(false)
  // Set while a menu item starts editing, so closing the menu doesn't take the focus back.
  const keepFocus = useRef(false)
  const id = operation.id
  const tasks = sortTasks(operation.tasks.filter((t) => t.unitIds.includes(unit.id)))
  const done = tasks.filter((t) => t.done).length
  const since = `${STATUS_LABEL[unit.status]} seit ${formatTime(unit.statusSince)} (${formatDuration(unit.statusSince, now)})`

  const edit = (what: Editing | "member" | "task") => {
    keepFocus.current = true
    if (what === "member") setAdding(true)
    else if (what === "task") setAddingTask(true)
    else setEditing(what)
  }
  const onCloseAutoFocus = (e: Event) => {
    if (keepFocus.current) e.preventDefault()
    keepFocus.current = false
  }

  function rename(callsign: string) {
    const other = operation.units.find((u) => u.id !== unit.id && sameText(u.callsign, callsign))
    if (other) toast.warning(`Den Rufnamen „${callsign}“ hat schon eine andere Streife`)
    api.updateUnit(id, unit.id, { callsign })
  }

  function addMember(name: string) {
    const holder = operation.units.find((u) => u.members.some((m) => sameText(m.name, name)))
    if (holder) {
      toast.error(`${name} ist schon in ${unitName(holder)}`, {
        description: holder.id === unit.id ? undefined : "Zum Wechseln „Verschieben nach“ im Menü der Person nutzen.",
      })
      return
    }
    api.addMember(id, unit, name)
  }

  const menu = (kit: MenuKit) => (
    <UnitMenuItems kit={kit} operation={operation} unit={unit} api={api} onEdit={edit} onShowLog={onShowLog} />
  )

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild disabled={locked}>
        <article className="flex flex-col rounded-lg border bg-card text-card-foreground">
          <header
            onKeyDown={(e) => {
              if (e.key === "F2" && !locked) {
                e.preventDefault()
                setEditing("callsign")
              }
            }}
            className="group/row flex items-center gap-2 border-b px-4 py-3"
          >
            <div className="grid min-w-0 flex-1">
              {editing === "callsign" ? (
                <InlineEdit
                  value={unit.callsign}
                  aria-label="Rufname"
                  placeholder="Rufname"
                  className="font-semibold"
                  onDone={(callsign) => {
                    if (callsign) rename(callsign)
                    setEditing(undefined)
                  }}
                />
              ) : (
                <h3
                  onDoubleClick={() => !locked && setEditing("callsign")}
                  className="flex min-w-0 items-center gap-1.5 font-semibold select-none"
                >
                  <span className="truncate">{unitName(unit)}</span>
                  <span className="font-normal text-muted-foreground">({unit.members.length})</span>
                  {duplicate && (
                    <Hint label="Diesen Rufnamen hat noch eine andere Streife">
                      <TriangleAlertIcon aria-label="Rufname doppelt vergeben" className="size-3.5 shrink-0 text-amber-400" />
                    </Hint>
                  )}
                </h3>
              )}
              {editing === "description" ? (
                <InlineEdit
                  allowEmpty
                  value={unit.description}
                  aria-label="Kurzbeschreibung"
                  placeholder="Kurzbeschreibung"
                  className="text-sm"
                  onDone={(description) => {
                    if (description !== undefined) api.updateUnit(id, unit.id, { description })
                    setEditing(undefined)
                  }}
                />
              ) : (
                <p
                  onDoubleClick={() => !locked && setEditing("description")}
                  className="truncate text-sm text-muted-foreground select-none"
                >
                  {unit.description.trim() || "N/A"}
                </p>
              )}
            </div>
            {!locked && (
              <DropdownMenu>
                <Hint label="Weitere Aktionen">
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`Aktionen für ${unitName(unit)}`} className={MORE_BUTTON}>
                      <EllipsisIcon />
                    </Button>
                  </DropdownMenuTrigger>
                </Hint>
                <DropdownMenuContent align="end" className="w-56" onCloseAutoFocus={onCloseAutoFocus}>
                  {menu(DROPDOWN_KIT)}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <DropdownMenu>
              <Hint label={since}>
                <DropdownMenuTrigger
                  disabled={locked}
                  className="rounded-[3px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Status von ${unitName(unit)}: ${STATUS_LABEL[unit.status]}`}
                >
                  <StatusSquare status={unit.status} />
                </DropdownMenuTrigger>
              </Hint>
              <DropdownMenuContent align="end" className="w-64">
                <StatusOptions
                  kit={DROPDOWN_KIT}
                  value={unit.status}
                  onChange={(status) => api.updateUnit(id, unit.id, { status })}
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          <ul className="grid grid-cols-1 gap-0.5 p-2">
            {unit.members.map((m) => (
              <MemberRow
                key={m.id}
                operation={operation}
                unit={unit}
                member={m}
                roles={memberRoles(operation, m, me).map((r) => ({ short: LEAD_SHORT[r], label: LEAD_LABEL[r] }))}
                api={api}
              />
            ))}
            {!locked && (
              <AddRow
                label="Person hinzufügen"
                placeholder="z. B. SD - Deputy - Emilia Hartmann"
                open={adding}
                onOpenChange={setAdding}
                onAdd={addMember}
              />
            )}
          </ul>

          {/* Tasks look like the personnel above: one row each, the box ticks them off. */}
          <section className="mt-auto border-t p-2" aria-label="Aufgaben">
            <h4 className="flex items-center justify-between px-2 pt-0.5 pb-1 text-xs font-medium text-muted-foreground">
              Aufgaben
              {done > 0 && (
                <button
                  type="button"
                  onClick={() => setShowDone(!showDone)}
                  className="font-normal hover:text-foreground"
                >
                  {showDone ? "Erledigte ausblenden" : `${done} erledigt`}
                </button>
              )}
            </h4>
            <ul className="grid gap-0.5">
              {tasks
                .filter((t) => showDone || !t.done)
                .map((t) => (
                  <TaskRow key={t.id} operation={operation} task={t} api={api} />
                ))}
              {!locked && (
                <AddRow
                  label="Aufgabe hinzufügen"
                  placeholder="z. B. Zugang Nord absperren"
                  open={addingTask}
                  onOpenChange={setAddingTask}
                  onAdd={(title) => api.addTask(id, title, [unit])}
                />
              )}
            </ul>
          </section>
        </article>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56" onCloseAutoFocus={onCloseAutoFocus}>
        {menu(CONTEXT_KIT)}
      </ContextMenuContent>
    </ContextMenu>
  )
}

/** The actions of a unit, shared by its "⋯" button and its right-click menu. */
function UnitMenuItems({
  kit,
  operation,
  unit,
  api,
  onEdit,
  onShowLog,
}: {
  kit: MenuKit
  operation: Operation
  unit: Unit
  api: Api
  onEdit: (what: "callsign" | "description" | "member" | "task") => void
  onShowLog: () => void
}) {
  const id = operation.id
  function remove() {
    const index = operation.units.findIndex((u) => u.id === unit.id)
    const taskIds = operation.tasks.filter((t) => t.unitIds.includes(unit.id)).map((t) => t.id)
    api.removeUnit(id, unit)
    removedToast(`Streife „${unitName(unit)}“`, () => api.restoreUnit(id, unit, index, taskIds))
  }
  return (
    <>
      <kit.Item onSelect={() => onEdit("callsign")}>
        <PencilIcon /> Rufname bearbeiten <Shortcut>F2</Shortcut>
      </kit.Item>
      <kit.Item onSelect={() => onEdit("description")}>
        <PencilIcon /> Beschreibung bearbeiten
      </kit.Item>
      <kit.Item onSelect={() => onEdit("member")}>
        <UserPlusIcon /> Person hinzufügen
      </kit.Item>
      <kit.Item onSelect={() => onEdit("task")}>
        <ListPlusIcon /> Aufgabe hinzufügen
      </kit.Item>
      <kit.Sub>
        <kit.SubTrigger>
          <StatusSquare status={unit.status} className="size-4 text-[0.6rem]" /> Status
        </kit.SubTrigger>
        <kit.SubContent className="w-64">
          <StatusOptions kit={kit} value={unit.status} onChange={(status) => api.updateUnit(id, unit.id, { status })} />
        </kit.SubContent>
      </kit.Sub>
      <kit.Item onSelect={onShowLog}>
        <HistoryIcon /> Verlauf der Streife
      </kit.Item>
      <kit.Separator />
      <kit.Item variant="destructive" onSelect={remove}>
        <Trash2Icon /> Aus Einsatz entfernen
      </kit.Item>
    </>
  )
}

/** One officer: the icon picks their state, double-click or F2 renames, "⋯" and right-click for more. */
function MemberRow({
  operation,
  unit,
  member,
  roles,
  api,
}: {
  operation: Operation
  unit: Unit
  member: Member
  /** Lead roles the officer holds. */
  roles: { short: string; label: string }[]
  api: Api
}) {
  const locked = useLocked()
  const [editing, setEditing] = useState(false)
  const keepFocus = useRef(false)
  const startEditing = () => {
    keepFocus.current = true
    setEditing(true)
  }
  const onCloseAutoFocus = (e: Event) => {
    if (keepFocus.current) e.preventDefault()
    keepFocus.current = false
  }
  const menu = (kit: MenuKit) => (
    <MemberMenuItems kit={kit} operation={operation} unit={unit} member={member} api={api} onRename={startEditing} />
  )

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild disabled={locked}>
        <li
          onKeyDown={(e: KeyboardEvent) => {
            if (e.key === "F2" && !locked) {
              e.preventDefault()
              setEditing(true)
            }
          }}
          className="group/row flex min-h-8 items-center gap-3 rounded-md px-2 py-1 hover:bg-muted/40"
        >
          <DropdownMenu>
            <Hint label={MEMBER_STATE_LABEL[member.state]}>
              <DropdownMenuTrigger
                disabled={locked}
                aria-label={`${member.name}: ${MEMBER_STATE_LABEL[member.state]}`}
                className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <MemberIcon state={member.state} />
              </DropdownMenuTrigger>
            </Hint>
            <DropdownMenuContent align="start" className="w-48">
              <MemberStateOptions kit={DROPDOWN_KIT} operation={operation} unit={unit} member={member} api={api} />
            </DropdownMenuContent>
          </DropdownMenu>
          {editing ? (
            <InlineEdit
              value={member.name}
              aria-label="Name"
              className="text-sm"
              onDone={(name) => {
                if (name) api.renameMember(operation.id, unit, member, name)
                setEditing(false)
              }}
            />
          ) : (
            <span
              onDoubleClick={() => !locked && setEditing(true)}
              className="min-w-0 flex-1 text-sm break-words select-none"
            >
              {member.name}
            </span>
          )}
          {roles.map((r) => (
            <Hint key={r.short} label={r.label}>
              <span className="shrink-0 rounded-[3px] bg-sky-900/60 px-1.5 py-0.5 text-[0.65rem] font-semibold text-sky-200">
                {r.short}
              </span>
            </Hint>
          ))}
          {!locked && (
            <DropdownMenu>
              <Hint label="Weitere Aktionen">
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-xs" aria-label={`Aktionen für ${member.name}`} className={MORE_BUTTON}>
                    <EllipsisIcon />
                  </Button>
                </DropdownMenuTrigger>
              </Hint>
              <DropdownMenuContent align="end" className="w-56" onCloseAutoFocus={onCloseAutoFocus}>
                {menu(DROPDOWN_KIT)}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </li>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56" onCloseAutoFocus={onCloseAutoFocus}>
        {menu(CONTEXT_KIT)}
      </ContextMenuContent>
    </ContextMenu>
  )
}

/** The actions of an officer, shared by their "⋯" button and their right-click menu. */
function MemberMenuItems({
  kit,
  operation,
  unit,
  member,
  api,
  onRename,
}: {
  kit: MenuKit
  operation: Operation
  unit: Unit
  member: Member
  api: Api
  onRename: () => void
}) {
  const id = operation.id
  const others = operation.units.filter((u) => u.id !== unit.id)
  function remove() {
    const index = unit.members.findIndex((m) => m.id === member.id)
    api.removeMember(id, unit, member)
    removedToast(`„${member.name}“`, () => api.restoreMember(id, unit, member, index))
  }
  return (
    <>
      <kit.Item onSelect={onRename}>
        <PencilIcon /> Umbenennen <Shortcut>F2</Shortcut>
      </kit.Item>
      <kit.Sub>
        <kit.SubTrigger>
          <MemberIcon state={member.state} bare /> {MEMBER_STATE_LABEL[member.state]}
        </kit.SubTrigger>
        <kit.SubContent className="w-48">
          <MemberStateOptions kit={kit} operation={operation} unit={unit} member={member} api={api} />
        </kit.SubContent>
      </kit.Sub>
      <kit.Sub>
        <kit.SubTrigger disabled={others.length === 0}>
          <ArrowRightLeftIcon /> Verschieben nach
        </kit.SubTrigger>
        <kit.SubContent className="w-56">
          {others.map((u) => (
            <kit.Item key={u.id} onSelect={() => api.moveMember(id, unit, u, member)}>
              <StatusSquare status={u.status} className="size-5" />
              <span className="truncate">{unitName(u)}</span>
            </kit.Item>
          ))}
        </kit.SubContent>
      </kit.Sub>
      <kit.Separator />
      <kit.Item variant="destructive" onSelect={remove}>
        <Trash2Icon /> Aus Streife entfernen
      </kit.Item>
    </>
  )
}

/** The states of an officer as radio items. */
function MemberStateOptions({
  kit,
  operation,
  unit,
  member,
  api,
}: {
  kit: MenuKit
  operation: Operation
  unit: Unit
  member: Member
  api: Api
}) {
  return (
    <kit.RadioGroup
      value={member.state}
      onValueChange={(state) => api.setMemberState(operation.id, unit, member, state as MemberState)}
    >
      {MEMBER_STATES.map((s) => {
        const Icon = MEMBER_STATE_ICON[s]
        return (
          <kit.RadioItem key={s} value={s}>
            <Icon /> {MEMBER_STATE_LABEL[s]}
          </kit.RadioItem>
        )
      })}
    </kit.RadioGroup>
  )
}

/** The state icon of an officer; `bare` drops the box, e.g. inside menus. */
function MemberIcon({ state, bare = false }: { state: MemberState; bare?: boolean }) {
  const Icon = MEMBER_STATE_ICON[state]
  if (bare) return <Icon />
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground hover:text-foreground">
      <Icon className="size-3.5" />
    </span>
  )
}

/**
 * The last row of a list: a "+ …" button that turns into a field. Like editing in place,
 * Enter saves (and clears the field for the next entry), leaving the field saves too and
 * Escape cancels.
 */
function AddRow({
  label,
  placeholder,
  open,
  onOpenChange,
  onAdd,
}: {
  label: string
  placeholder: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (text: string) => void
}) {
  const [text, setText] = useState("")
  // Escape unmounts the field, which may still fire a blur with the old text.
  const cancelled = useRef(false)
  const box = (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-dashed">
      <PlusIcon className="size-3.5" />
    </span>
  )
  const close = () => {
    setText("")
    onOpenChange(false)
  }

  if (!open)
    return (
      <li>
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          className="flex min-h-8 w-full items-center gap-3 rounded-md px-2 py-1 text-sm text-muted-foreground outline-none hover:bg-muted/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          {box}
          {label}
        </button>
      </li>
    )

  return (
    <li className="flex min-h-8 items-center gap-3 rounded-md px-2 py-1 text-muted-foreground">
      {box}
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === "Enter" && text.trim()) {
            onAdd(text.trim())
            setText("")
          } else if (e.key === "Escape") {
            e.preventDefault()
            cancelled.current = true
            close()
          }
        }}
        onFocus={() => (cancelled.current = false)}
        onBlur={() => {
          if (text.trim() && !cancelled.current) onAdd(text.trim())
          close()
        }}
        placeholder={placeholder}
        aria-label={label}
        className="-mx-1 w-full min-w-0 rounded-sm bg-background px-1 text-sm text-foreground ring-2 ring-ring/50 outline-none placeholder:text-muted-foreground"
      />
    </li>
  )
}
