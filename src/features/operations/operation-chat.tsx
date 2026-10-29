import { Fragment, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react"
import {
  AtSignIcon,
  CopyIcon,
  EllipsisIcon,
  ListFilterIcon,
  PencilIcon,
  ScaleIcon,
  SendIcon,
  SirenIcon,
  Trash2Icon,
} from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@/components/ui/context-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmptyList } from "@/components/no-results"
import { copy } from "@/lib/clipboard"
import { formatDate } from "@/lib/format-date"
import { matchesWord } from "@/lib/text"
import { ChangeTimeline } from "./change-log"
import { entryGroup, LOG_GROUP_LABEL, LOG_GROUPS, type LogGroup } from "./log-entries"
import { useLocked } from "./edit-state"
import { formatTime } from "./format"
import { DECISION_QUESTIONS, TYPICAL_DECISIONS, URGENT_REPORTS } from "./guide"
import { Hint } from "@/components/hint"
import { InlineEdit } from "@/components/inline-edit"
import { CONTEXT_KIT, DROPDOWN_KIT, type MenuKit } from "./menu-kit"
import { StatusSquare } from "./status-badge"
import { Shortcut } from "./task-row"
import type { LogEntry, Unit } from "./types"
import { logUnitIds, unitName, unitNames } from "./use-operations"
import { UnitPicker } from "./unit-picker"

export type ChatView = "notes" | "changes"

/** Whether an entry is about `unit`, by the units stored on it. */
function aboutUnit(entry: LogEntry, unit: Unit) {
  if (logUnitIds(entry).includes(unit.id)) return true
  // Moves of earlier versions only stored the unit they went to; the one they came from is
  // named in the text. Whole call signs only, so "SANDY - 1" doesn't find "SANDY - 10".
  return entry.kind === "system" && !entry.type && matchesWord(entry.text, unitName(unit))
}

/**
 * The operation's history as a chat: notes written by hand appear as messages,
 * automatic change entries as a timeline in their own tab. Both can be filtered by unit,
 * the changes also by kind.
 */
export function OperationChat({
  log,
  units,
  view,
  onViewChange,
  unitFilter,
  onUnitFilterChange,
  onSend,
  onEdit,
  onDelete,
}: {
  log: LogEntry[]
  units: Unit[]
  view: ChatView
  onViewChange: (view: ChatView) => void
  /** Shows only entries about this unit. */
  unitFilter: Unit | undefined
  onUnitFilterChange: (unit: Unit | undefined) => void
  onSend: (text: string, unitIds: string[]) => void
  onEdit: (entry: LogEntry, text: string) => void
  onDelete: (entry: LogEntry) => void
}) {
  const locked = useLocked()
  const scrollRef = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  const [group, setGroup] = useState<LogGroup | undefined>()

  const changes = view === "changes"
  const groupFilter = changes ? group : undefined
  const filtered = log.filter(
    (l) =>
      changes !== (l.kind === "notiz") &&
      (!unitFilter || aboutUnit(l, unitFilter)) &&
      (!groupFilter || entryGroup(l, units) === groupFilter),
  )
  // Notes read like a chat (newest at the bottom), the history newest first.
  const shown = changes ? filtered.toReversed() : filtered
  const notes = log.filter((l) => l.kind === "notiz").length
  const isFiltered = !!unitFilter || !!groupFilter

  // Stays at the newest entry unless the user scrolled away to read.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el && stick.current) el.scrollTop = changes ? 0 : el.scrollHeight
  }, [shown.length, changes, unitFilter])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid gap-2 border-b p-2">
        <Tabs value={view} onValueChange={(v) => onViewChange(v as ChatView)}>
          <TabsList className="w-full">
            <TabsTrigger value="notes">
              Notizen <span className="text-muted-foreground tabular-nums">{notes}</span>
            </TabsTrigger>
            <TabsTrigger value="changes">Änderungen</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={units.length === 0 && !unitFilter}
                className={cn("max-w-48 min-w-0", !unitFilter && "text-muted-foreground")}
              >
                <AtSignIcon />
                <span className="truncate">{unitFilter ? unitName(unitFilter) : "Alle Streifen"}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuRadioGroup
                value={unitFilter?.id ?? ""}
                onValueChange={(id) => onUnitFilterChange(units.find((u) => u.id === id))}
              >
                <DropdownMenuRadioItem value="">Alle Streifen</DropdownMenuRadioItem>
                <DropdownMenuSeparator />
                {units.map((u) => (
                  <DropdownMenuRadioItem key={u.id} value={u.id}>
                    <StatusSquare status={u.status} className="size-5" />
                    <span className="truncate">{unitName(u)}</span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          {changes && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className={cn(!group && "text-muted-foreground")}>
                  <ListFilterIcon />
                  {group ? LOG_GROUP_LABEL[group] : "Alle Arten"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuRadioGroup
                  value={group ?? ""}
                  onValueChange={(g) => setGroup((g || undefined) as LogGroup | undefined)}
                >
                  <DropdownMenuRadioItem value="">Alle Arten</DropdownMenuRadioItem>
                  <DropdownMenuSeparator />
                  {LOG_GROUPS.map((g) => (
                    <DropdownMenuRadioItem key={g} value={g}>
                      {LOG_GROUP_LABEL[g]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto text-muted-foreground"
              onClick={() => {
                onUnitFilterChange(undefined)
                setGroup(undefined)
              }}
            >
              Filter aufheben
            </Button>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget
          stick.current = changes ? el.scrollTop < 40 : el.scrollHeight - el.scrollTop - el.clientHeight < 40
        }}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-2"
      >
        {changes ? (
          <ChangeTimeline entries={shown} units={units} />
        ) : (
          <ol className="grid gap-1.5 *:animate-item-in">
            {shown.map((l, i) => {
              const day = formatDate(l.at)
              const newDay = i === 0 || formatDate(shown[i - 1].at) !== day
              const noteUnits = units.filter((u) => logUnitIds(l).includes(u.id))
              return (
                <Fragment key={l.id}>
                  {newDay && (
                    <li className="my-1 text-center text-xs font-medium text-muted-foreground">{day}</li>
                  )}
                  <Note
                    entry={l}
                    noteUnits={noteUnits}
                    onEdit={(text) => onEdit(l, text)}
                    onDelete={() => onDelete(l)}
                  />
                </Fragment>
              )
            })}
          </ol>
        )}
        {shown.length === 0 && (
          <EmptyList>
            {isFiltered
              ? "Keine Einträge zu diesem Filter"
              : changes
                ? "Keine Einträge"
                : locked
                  ? "Keine Notizen"
                  : "Noch keine Notizen. Schreib unten die erste."}
          </EmptyList>
        )}
      </div>

      {/* Notes are written only in their own tab; the history just lists what happened. */}
      {!changes && !locked && (
        <Composer
          units={units}
          onSend={(text, unitIds) => {
            stick.current = true
            onSend(text, unitIds)
          }}
        />
      )}
    </div>
  )
}

/** A note as a chat bubble. Double-click or F2 edits; the "⋯" button and right-click open its menu. */
function Note({
  entry,
  noteUnits,
  onEdit,
  onDelete,
}: {
  entry: LogEntry
  noteUnits: Unit[]
  onEdit: (text: string) => void
  onDelete: () => void
}) {
  const locked = useLocked()
  const [editing, setEditing] = useState(false)
  // Set while "Bearbeiten" closes the menu, so the focus stays in the field.
  const keepFocus = useRef(false)
  const onCloseAutoFocus = (e: Event) => {
    if (keepFocus.current) e.preventDefault()
    keepFocus.current = false
  }
  const menu = (kit: MenuKit) => (
    <NoteMenuItems
      kit={kit}
      entry={entry}
      onEdit={() => {
        keepFocus.current = true
        setEditing(true)
      }}
      onDelete={onDelete}
    />
  )
  return (
    <li
      onKeyDown={(e) => {
        if (e.key === "F2" && !locked) {
          e.preventDefault()
          setEditing(true)
        }
      }}
    >
      <ContextMenu>
        <ContextMenuTrigger asChild disabled={locked}>
          <div
            onDoubleClick={() => !locked && setEditing(true)}
            className="group/note rounded-xl bg-muted px-3 py-2 data-[state=open]:ring-1 data-[state=open]:ring-ring"
          >
            {noteUnits.length > 0 && (
              <p className="mb-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-medium text-muted-foreground">
                {noteUnits.map((u) => (
                  <span key={u.id} className="flex items-center gap-1">
                    <AtSignIcon className="size-3" />
                    {unitName(u)}
                  </span>
                ))}
              </p>
            )}
            {editing ? (
              <InlineEdit
                multiline
                value={entry.text}
                aria-label="Notiz bearbeiten"
                className="min-w-48 text-sm"
                onDone={(text) => {
                  if (text) onEdit(text)
                  setEditing(false)
                }}
              />
            ) : (
              <p className="text-sm break-words whitespace-pre-wrap">{entry.text}</p>
            )}
            <div className="mt-0.5 flex items-center justify-end gap-1">
              {!locked && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Aktionen für die Notiz"
                      className="size-5 opacity-0 group-focus-within/note:opacity-100 group-hover/note:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                    >
                      <EllipsisIcon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48" onCloseAutoFocus={onCloseAutoFocus}>
                    {menu(DROPDOWN_KIT)}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <time dateTime={entry.at} className="text-[0.7rem] text-muted-foreground tabular-nums">
                {entry.editedAt && "bearbeitet · "}
                {formatTime(entry.at)}
              </time>
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent onCloseAutoFocus={onCloseAutoFocus}>{menu(CONTEXT_KIT)}</ContextMenuContent>
      </ContextMenu>
    </li>
  )
}

function NoteMenuItems({
  kit,
  entry,
  onEdit,
  onDelete,
}: {
  kit: MenuKit
  entry: LogEntry
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <>
      <kit.Item onSelect={onEdit}>
        <PencilIcon /> Bearbeiten <Shortcut>F2</Shortcut>
      </kit.Item>
      <kit.Item onSelect={() => copy(entry.text, "Notiz")}>
        <CopyIcon /> Kopieren
      </kit.Item>
      <kit.Separator />
      <kit.Item variant="destructive" onSelect={onDelete}>
        <Trash2Icon /> Löschen
      </kit.Item>
    </>
  )
}

/** Template for a decision and its reasons; the guide's questions are checked before writing it down. */
const decisionTemplate = (decision?: string) => `Entscheidung: ${decision ? `${decision} → ` : ""}\nBegründung: `

/**
 * Writes a note. Enter sends, Shift+Enter starts a new line; @ links the note to one or more units.
 * The chips above insert templates for urgent reports and decisions.
 */
function Composer({ units, onSend }: { units: Unit[]; onSend: (text: string, unitIds: string[]) => void }) {
  const [text, setText] = useState("")
  const [unitIds, setUnitIds] = useState<string[]>([])
  const inputRef = useRef<HTMLTextAreaElement>(null)
  // Units removed from the operation drop out of the selection.
  const selected = units.filter((u) => unitIds.includes(u.id))

  function send() {
    if (!text.trim()) return
    onSend(
      text.trim(),
      selected.map((u) => u.id),
    )
    setText("")
    setUnitIds([])
  }

  /** Adds `template` on a new line and puts the cursor at its end. */
  function insert(template: string) {
    const next = text.trim() ? `${text.trimEnd()}\n${template}` : template
    setText(next)
    requestAnimationFrame(() => {
      const el = inputRef.current
      el?.focus()
      el?.setSelectionRange(next.length, next.length)
    })
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="grid gap-2 border-t p-2">
      <div className="flex flex-wrap gap-1" role="group" aria-label="Vorlagen">
        {URGENT_REPORTS.map((r) => (
          <Hint key={r} label="Sofort melden">
            <button
              type="button"
              onClick={() => insert(`SOFORTMELDUNG ${r}: `)}
              className="flex h-6 shrink-0 items-center gap-1 rounded-full border border-red-500/30 px-2 text-xs text-red-300 outline-none hover:bg-red-500/10 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <SirenIcon className="size-3" /> {r}
            </button>
          </Hint>
        ))}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-6 shrink-0 items-center gap-1 rounded-full border px-2 text-xs text-muted-foreground outline-none hover:bg-muted/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-muted/50"
            >
              <ScaleIcon className="size-3" /> Entscheidung
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-72">
            <DropdownMenuLabel>Entscheidung mit Begründung</DropdownMenuLabel>
            {TYPICAL_DECISIONS.map((d) => (
              <DropdownMenuItem key={d} onSelect={() => insert(decisionTemplate(d))}>
                {d}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onSelect={() => insert(decisionTemplate())}>Andere Entscheidung…</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Vorher prüfen</DropdownMenuLabel>
            <ul className="grid gap-0.5 px-1.5 pb-1 text-xs text-muted-foreground">
              {DECISION_QUESTIONS.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="rounded-xl border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Notiz, Funkspruch, Meldung…"
          aria-label="Notiz schreiben"
          className="field-sizing-content block max-h-40 min-h-10 w-full resize-none bg-transparent px-3 pt-2.5 text-sm outline-none placeholder:text-muted-foreground"
        />
        <div className="flex items-center gap-1 p-1.5">
          {/* The span keeps the tooltip working while the button is disabled. */}
          <Hint label="Notiz Streifen zuordnen">
            <span className="flex min-w-0">
              <UnitPicker units={units} value={unitIds} onChange={setUnitIds} align="start" side="top">
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("max-w-56", selected.length === 0 && "text-muted-foreground")}
                  disabled={units.length === 0}
                >
                  <AtSignIcon />
                  <span className="truncate">{selected.length === 0 ? "Streifen" : unitNames(units, unitIds)}</span>
                </Button>
              </UnitPicker>
            </span>
          </Hint>
          {text && (
            <span className="ml-auto truncate pl-2 text-xs text-muted-foreground">Umschalt+Enter für neue Zeile</span>
          )}
          <Button size="icon-sm" className={cn(!text && "ml-auto")} onClick={send} disabled={!text.trim()} aria-label="Senden">
            <SendIcon />
          </Button>
        </div>
      </div>
    </div>
  )
}
