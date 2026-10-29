import { useRef, useState, type ReactNode } from "react"
import {
  ArrowRightLeftIcon,
  CheckIcon,
  ChevronsUpIcon,
  EllipsisIcon,
  NotebookTextIcon,
  PencilIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@/components/ui/context-menu"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Hint } from "@/components/hint"
import { InlineEdit } from "@/components/inline-edit"
import { formatDateTime } from "@/lib/format-date"
import { removedToast } from "@/lib/undo"
import { useLocked } from "./edit-state"
import { CONTEXT_KIT, DROPDOWN_KIT, type MenuKit } from "./menu-kit"
import { TASK_PRIORITY_BADGE, TASK_PRIORITY_LABEL } from "./priority"
import { TASK_PRIORITIES, type Operation, type Task, type TaskPriority } from "./types"
import { UnitOptions } from "./unit-picker"
import { unitNames, type useOperations } from "./use-operations"

type Api = ReturnType<typeof useOperations>

/**
 * One task: the box ticks it off, double-click or F2 renames, the "⋯" button and right-click
 * open the same menu. `detailed` adds the assigned units and the notes, as in the task list.
 */
export function TaskRow({
  operation,
  task,
  api,
  detailed = false,
}: {
  operation: Operation
  task: Task
  api: Api
  detailed?: boolean
}) {
  const locked = useLocked()
  const [editing, setEditing] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  // Set while "Umbenennen" closes the menu, so the focus stays in the title field.
  const renaming = useRef(false)
  const id = operation.id
  const priority = task.priority ?? "normal"

  const menu = (kit: MenuKit) => (
    <TaskMenuItems
      kit={kit}
      operation={operation}
      task={task}
      api={api}
      onRename={() => {
        renaming.current = true
        setEditing(true)
      }}
    />
  )

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild disabled={locked}>
        <li
          onKeyDown={(e) => {
            if (e.key === "F2" && !locked) {
              e.preventDefault()
              setEditing(true)
            }
          }}
          className={cn(
            "group/task grid rounded-md hover:bg-muted/40",
            detailed && "rounded-lg border bg-card p-1 text-card-foreground",
          )}
        >
          <div className="flex min-h-8 items-center gap-3 px-2 py-1">
            {/* Same box as the personnel icons; empty while open, ticked when done. */}
            <Hint label={task.done ? "Als offen markieren" : "Als erledigt markieren"}>
              <button
                type="button"
                role="checkbox"
                aria-checked={task.done}
                disabled={locked}
                onClick={() => api.toggleTask(id, task)}
                aria-label={task.done ? "Als offen markieren" : "Als erledigt markieren"}
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-md border outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
                  task.done
                    ? "border-transparent bg-muted text-muted-foreground"
                    : "border-muted-foreground/40 enabled:hover:border-foreground/60",
                )}
              >
                {task.done && <CheckIcon className="size-3.5" />}
              </button>
            </Hint>
            <div className="grid min-w-0 flex-1">
              {editing ? (
                <InlineEdit
                  value={task.title}
                  aria-label="Titel der Aufgabe"
                  className="text-sm"
                  onDone={(title) => {
                    if (title) api.renameTask(id, task, title)
                    setEditing(false)
                  }}
                />
              ) : (
                <span
                  onDoubleClick={() => !locked && setEditing(true)}
                  className={cn(
                    "text-sm select-none",
                    detailed ? "break-words" : "truncate",
                    task.done && "text-muted-foreground line-through",
                  )}
                >
                  {task.title}
                </span>
              )}
              {detailed && (
                <span className="truncate text-xs text-muted-foreground">
                  {formatDateTime(task.createdAt)} für{" "}
                  <span className="font-semibold text-foreground/80">
                    {unitNames(operation.units, task.unitIds) || "keine Streife"}
                  </span>
                </span>
              )}
            </div>
            <PriorityBadge priority={priority} />
            {detailed && (
              <Hint label={notesOpen ? "Details ausblenden" : "Details"}>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-expanded={notesOpen}
                  aria-label="Details"
                  onClick={() => setNotesOpen(!notesOpen)}
                  className={cn(!task.note?.trim() && !notesOpen && "text-muted-foreground")}
                >
                  <NotebookTextIcon />
                </Button>
              </Hint>
            )}
            {!locked && (
              <DropdownMenu>
                <Hint label="Weitere Aktionen">
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size={detailed ? "icon-sm" : "icon-xs"}
                      aria-label={`Aktionen für ${task.title}`}
                      className="opacity-0 group-focus-within/task:opacity-100 group-hover/task:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 pointer-coarse:opacity-100"
                    >
                      <EllipsisIcon />
                    </Button>
                  </DropdownMenuTrigger>
                </Hint>
                <DropdownMenuContent align="end" className="w-56" onCloseAutoFocus={(e) => {
                    if (renaming.current) e.preventDefault()
                    renaming.current = false
                  }}>
                  {menu(DROPDOWN_KIT)}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          {detailed && notesOpen && (
            <div className="px-2 pb-2 pl-11 animate-in duration-200 ease-out-quint fade-in-0 slide-in-from-top-1">
              <textarea
                value={task.note ?? ""}
                onChange={(e) => api.setTaskNote(id, task.id, e.target.value)}
                readOnly={locked}
                placeholder="Details zur Aufgabe…"
                aria-label="Details zur Aufgabe"
                className="field-sizing-content min-h-16 w-full resize-none rounded-lg border border-input bg-input/30 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
          )}
        </li>
      </ContextMenuTrigger>
      {/* Not refocusing the row keeps the focus in the title field after "Umbenennen". */}
      <ContextMenuContent className="w-56" onCloseAutoFocus={(e) => e.preventDefault()}>
        {menu(CONTEXT_KIT)}
      </ContextMenuContent>
    </ContextMenu>
  )
}

/** "Hoch" or "Dringend" as a small coloured badge; normal tasks get none. */
export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  if (priority === "normal") return null
  return (
    <span className={cn("shrink-0 rounded-[3px] px-1.5 py-0.5 text-[0.65rem] font-semibold", TASK_PRIORITY_BADGE[priority])}>
      {TASK_PRIORITY_LABEL[priority]}
    </span>
  )
}

/** The priorities as radio items, for a dropdown or a right-click menu. */
export function PriorityOptions({
  kit,
  value,
  onChange,
}: {
  kit: MenuKit
  value: TaskPriority
  onChange: (priority: TaskPriority) => void
}) {
  return (
    <kit.RadioGroup value={value} onValueChange={(p) => onChange(p as TaskPriority)}>
      {TASK_PRIORITIES.map((p) => (
        <kit.RadioItem key={p} value={p}>
          {TASK_PRIORITY_LABEL[p]}
        </kit.RadioItem>
      ))}
    </kit.RadioGroup>
  )
}

/** The actions of a task, shared by its "⋯" button and its right-click menu. */
function TaskMenuItems({
  kit,
  operation,
  task,
  api,
  onRename,
}: {
  kit: MenuKit
  operation: Operation
  task: Task
  api: Api
  onRename: () => void
}) {
  const id = operation.id
  function remove() {
    const index = operation.tasks.findIndex((t) => t.id === task.id)
    api.removeTask(id, task)
    removedToast(`Aufgabe „${task.title}“`, () => api.restoreTask(id, task, index))
  }
  return (
    <>
      <kit.Item onSelect={() => api.toggleTask(id, task)}>
        {task.done ? <RotateCcwIcon /> : <CheckIcon />}
        {task.done ? "Wieder öffnen" : "Erledigt"}
      </kit.Item>
      <kit.Item onSelect={onRename}>
        <PencilIcon /> Umbenennen <Shortcut>F2</Shortcut>
      </kit.Item>
      <kit.Sub>
        <kit.SubTrigger>
          <ChevronsUpIcon /> Priorität
        </kit.SubTrigger>
        <kit.SubContent className="w-40">
          <PriorityOptions
            kit={kit}
            value={task.priority ?? "normal"}
            onChange={(p) => api.setTaskPriority(id, task, p)}
          />
        </kit.SubContent>
      </kit.Sub>
      <kit.Sub>
        <kit.SubTrigger>
          <ArrowRightLeftIcon /> Streifen zuordnen
        </kit.SubTrigger>
        <kit.SubContent className="w-56">
          <UnitOptions
            kit={kit}
            units={operation.units}
            value={task.unitIds}
            onChange={(unitIds) => api.setTaskUnits(id, task, unitIds)}
          />
        </kit.SubContent>
      </kit.Sub>
      <kit.Separator />
      <kit.Item variant="destructive" onSelect={remove}>
        <Trash2Icon /> Löschen
      </kit.Item>
    </>
  )
}

/** A key hint at the end of a menu item. */
export function Shortcut({ children }: { children: ReactNode }) {
  return <span className="ml-auto text-xs tracking-widest text-muted-foreground">{children}</span>
}

/** A field that adds a task on Enter; Escape clears it. */
export function AddTaskInput({
  onAdd,
  placeholder = "Aufgabe hinzufügen…",
}: {
  onAdd: (title: string) => void
  placeholder?: string
}) {
  const [title, setTitle] = useState("")
  return (
    <input
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      onKeyDown={(e) => {
        if (e.key === "Escape" && title) {
          e.preventDefault()
          setTitle("")
        } else if (e.key === "Enter" && title.trim()) {
          onAdd(title.trim())
          setTitle("")
        }
      }}
      className="h-7 w-full rounded-md bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground/70 focus:bg-muted/50"
    />
  )
}
