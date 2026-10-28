import { Fragment, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import {
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  DicesIcon,
  EyeIcon,
  GripVerticalIcon,
  MinusIcon,
  PlayIcon,
  PlusIcon,
  ScaleIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react"
import { cn } from "cn"
import { Hint } from "@/components/hint"
import { move, useReorder } from "@/components/use-reorder"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { useSettingsDialog } from "@/hooks/use-settings"
import type { DnaEntry } from "@/features/dna-db/types"
import { formatDate } from "@/lib/format-date"
import { sameText, textKey } from "@/lib/text"
import { removedToast } from "@/lib/undo"
import { Combobox, type ComboboxOption } from "@/components/combobox"
import { DnaPicker } from "./dna-picker"
import { SnippetMenu } from "./snippet-menu"
import { localNow, ME } from "./markdown"
import { rangeLabel, roll, type Range } from "./range"
import { TracesCell } from "./traces-cell"
import { dbValue, rowLookup, rowTraces, storeTraces, type DbField, type TraceKind } from "./traces"
import {
  checkedOptions,
  checkOptions,
  customKey,
  GROUP_OFFERS,
  hiddenKey,
  insertAt,
  isFilled,
  listItems,
  orderKey,
  tableRows,
  type ChecksField,
  type Choice,
  type Column,
  type ChoiceField,
  type DateTimeField,
  type Field,
  type ListField,
  type Lookup,
  type Reader,
  type TableField,
  type Template,
  type TextField,
  type UpdateValue,
} from "./templates"
import type { Row, Value, Values } from "./types"
import { offered, offeredFrom, sourceId, type Suggestions } from "./use-case-files"
import { useOpenPanels } from "./use-open-panels"

/** The first section starts open; foldable fields start folded. */
const INITIALLY_OPEN = ["0"]

interface FieldProps<F extends Field> {
  field: F
  values: Values
  reader: Reader
  onChange: (key: string, value: Value) => void
  onUpdate: UpdateValue
  /** Values entered elsewhere, offered in fields of the same group. */
  suggestions: Suggestions
  /** The document the form edits; identifies its own values among the suggestions. */
  docId: string
  /** The field is alone in its section, whose title already names it. */
  bare?: boolean
}

/** Bordered panel shared by lists, tables, checklists and choices. */
export const BOX = "overflow-hidden rounded-lg border bg-background/50"
/** Short fields share a row and grow to fill it; long ones take a row of their own. */
export const SHORT = "min-w-0 flex-[1_1_13rem]"
export const FULL = "basis-full"

/** The sections of the template as rows of one panel. The first one starts open; which are open is kept per document. */
export function DocForm({
  template,
  values,
  reader,
  onChange,
  onUpdate,
  suggestions,
  docId,
}: {
  template: Template<string>
  values: Values
  reader: Reader
  onChange: (key: string, value: Value) => void
  onUpdate: UpdateValue
  suggestions: Suggestions
  docId: string
}) {
  const [open, setOpen] = useOpenPanels(docId, INITIALLY_OPEN)
  // Only the headers are cards; the opened content has no background of its own.
  return (
    <Accordion type="multiple" value={open} onValueChange={setOpen} className="overflow-hidden rounded-lg border">
      {template.sections.map((s, i) => (
        <AccordionItem key={i} value={String(i)}>
          {/* The caret replaces the component's chevron on the right. */}
          <AccordionTrigger className="items-center justify-start gap-3 rounded-none bg-card py-3.5 pr-5 pl-4 hover:bg-accent/30 hover:no-underline **:data-[slot=accordion-trigger-icon]:hidden">
            <PlayIcon className="size-2.5 shrink-0 fill-current text-foreground transition-transform group-aria-expanded/accordion-trigger:rotate-90" />
            <span className="grid min-w-0 flex-1 gap-0.5">
              <span className="truncate text-base font-semibold">{s.title}</span>
              <span className="truncate text-xs font-normal text-muted-foreground">{s.description}</span>
            </span>
            <Progress fields={s.fields} reader={reader} />
          </AccordionTrigger>
          <AccordionContent className="flex flex-wrap gap-x-3 gap-y-4 border-t p-4">
            <Notice text={s.notice} />
            {s.fields.map((f) => (
              <FieldInput
                key={f.key}
                field={f}
                values={values}
                reader={reader}
                onChange={onChange}
                onUpdate={onUpdate}
                suggestions={suggestions}
                docId={docId}
                bare={s.fields.length === 1}
              />
            ))}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

/** How many fields of a section are filled in, e.g. "3/5 ausgefüllt"; amber while a required one is empty. */
function Progress({ fields, reader }: { fields: Field[]; reader: Reader }) {
  const counted = fields.flatMap((f) => {
    const filled = isFilled(f, reader)
    return filled === undefined ? [] : [{ filled, required: !!f.required }]
  })
  if (!counted.length) return null
  const filled = counted.filter((c) => c.filled).length
  const missing = counted.some((c) => c.required && !c.filled)
  return (
    <span
      className={cn(
        "shrink-0 text-xs font-normal tabular-nums",
        missing ? "text-amber-400" : filled === counted.length ? "text-emerald-400" : "text-muted-foreground",
      )}
    >
      {filled}/{counted.length} ausgefüllt
      {missing && <span className="sr-only">, Pflichtfeld leer</span>}
    </span>
  )
}

const str = (v: Value | undefined) => (typeof v === "string" ? v : "")

/** What an autocompleted text field offers from its groups, without its own value. */
function groupOptions(field: TextField, suggestions: Suggestions, docId: string) {
  if (!field.autocomplete) return []
  const groups = field.offers ?? (field.group ? GROUP_OFFERS[field.group] : [])
  return offeredFrom(suggestions, groups, sourceId(docId, field.key))
}

/** The IDs a lookup stores: its own kind, or the kinds a name may be replaced by. */
function lookupKinds(lookup: Lookup): TraceKind[] {
  return lookup.field === "name" ? (lookup.or ?? []) : [lookup.field]
}

/** `options` without repeats, ignoring case; the first one wins. */
function unique<T extends ComboboxOption>(options: T[]) {
  const seen = new Set<string>()
  return options.filter((o) => {
    const k = textKey(typeof o === "string" ? o : o.value)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

function FieldInput(props: FieldProps<Field>) {
  const { field } = props
  switch (field.type) {
    case "text":
      return <TextInput {...props} field={field} />
    case "list":
      return <ListInput {...props} field={field} />
    case "datetime":
      return <DateTimeInput {...props} field={field} />
    case "checks":
      return <ChecksInput {...props} field={field} />
    case "choice":
      return <ChoiceInput {...props} field={field} />
    case "table":
      return field.layout === "cards" ? <TableInput {...props} field={field} cards /> : <TableInput {...props} field={field} />
    case "custom": {
      const Component = field.component
      return (
        <Component
          field={field}
          values={props.values}
          reader={props.reader}
          onChange={props.onChange}
          onUpdate={props.onUpdate}
          docId={props.docId}
        />
      )
    }
  }
}

export function Labeled({
  id,
  label,
  hint,
  bare,
  required,
  className,
  children,
}: {
  id?: string
  label: string
  hint?: ReactNode
  bare?: boolean
  /** Marks the field as one that should be filled in. */
  required?: boolean
  className: string
  children: ReactNode
}) {
  return (
    <div className={cn("grid content-start gap-1.5", className)}>
      <label htmlFor={id} className={cn("text-xs font-medium text-muted-foreground", bare && "sr-only")}>
        {label}
        {required && (
          <Hint label="Pflichtfeld">
            <span className="ml-0.5 text-amber-400">
              *<span className="sr-only"> (Pflichtfeld)</span>
            </span>
          </Hint>
        )}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground/70">{hint}</p>}
    </div>
  )
}

function TextInput({ field, values, reader, onChange, suggestions, docId }: FieldProps<TextField>) {
  const id = useId()
  const ownName = reader.me === ME ? "" : reader.me
  // Own-name fields show the name until they're edited; clearing one still writes the name.
  const value = field.me && values[field.key] === undefined ? ownName : str(values[field.key])
  const placeholder = field.me ? reader.me : (field.fallback ?? "N/A")
  const options = unique<ComboboxOption>([...(field.suggestions ?? []), ...groupOptions(field, suggestions, docId)])
  return (
    <Labeled id={id} label={field.label} hint={field.hint} required={field.required} className={SHORT}>
      {field.lookup ? (
        // A person picked from the DNA database, or added to it.
        <DnaPicker
          id={id}
          value={value}
          kinds={lookupKinds(field.lookup)}
          names={field.lookup.field === "name"}
          show={field.lookup.nameOnly ? "name" : undefined}
          extra={groupOptions(field, suggestions, docId)}
          onChange={(v) => onChange(field.key, v)}
          placeholder={placeholder}
        />
      ) : field.suggestions || field.autocomplete ? (
        <Combobox id={id} value={value} onChange={(v) => onChange(field.key, v)} options={options} placeholder={placeholder} />
      ) : field.today ? (
        <div className="relative">
          <Input
            id={id}
            value={value}
            onChange={(e) => onChange(field.key, e.target.value)}
            placeholder={placeholder}
            className="pr-20"
          />
          <button
            type="button"
            onClick={() => onChange(field.key, formatDate(new Date()))}
            className="absolute inset-y-1 right-1 flex items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <CalendarIcon className="size-3.5" /> Heute
          </button>
        </div>
      ) : (
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(field.key, e.target.value)}
          placeholder={placeholder}
          inputMode={field.numeric ? "numeric" : undefined}
        />
      )}
    </Labeled>
  )
}

/** Highlighted first cell of a panel row: drag handle, checkbox, radio or plus. */
export const LEAD = "flex w-10 shrink-0 items-center justify-center border-r border-border/60 bg-muted/50"
/** Last cell of a panel row, holding its remove button. */
export const END = "flex w-10 shrink-0 items-center justify-center border-l border-border/60"
/** A combobox that fills its cell, without a border of its own. */
const CELL_COMBOBOX =
  "h-10 rounded-none border-0 bg-transparent px-3 shadow-none placeholder:text-muted-foreground/60 focus-visible:bg-accent/30 focus-visible:ring-0 dark:bg-transparent"

/** Header row of a panel, like a table's: the title, and the remove column if rows can be removed. */
function PanelHeader({ label, removable, action }: { label: string; removable?: boolean; action?: ReactNode }) {
  return (
    <div className="flex h-9 items-stretch bg-muted/50 text-xs font-medium text-muted-foreground">
      <span className="w-10 shrink-0 border-r border-border/60" />
      <span className="flex flex-1 items-center px-3">{label}</span>
      {action}
      {removable && (
        <span className={END}>
          <span className="sr-only">Entfernen</span>
        </span>
      )}
    </div>
  )
}

/** The remove column of a row; empty when the row can't be removed. */
export function RemoveCell({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <span className={END}>
      {onRemove && (
        <Hint label="Entfernen">
          <button
            type="button"
            onClick={onRemove}
            aria-label={label}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground/70 hover:bg-accent hover:text-foreground"
          >
            <XIcon className="size-3.5" />
          </button>
        </Hint>
      )}
    </span>
  )
}

/**
 * The button under a panel that adds a row, laid out like one: the plus in the highlighted
 * first cell, the label where the text goes. `end` keeps the cell of the remove buttons free.
 */
export function AddRow({
  label,
  onClick,
  end,
  className,
}: {
  label: string
  onClick: () => void
  end?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group/add flex h-10 w-full items-stretch text-left text-sm text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      <span className={cn(LEAD, "group-hover/add:bg-accent/60")}>
        <PlusIcon className="size-3.5" />
      </span>
      <span className="flex flex-1 items-center px-3">{label}</span>
      {end && <span className={END} />}
    </button>
  )
}

/**
 * The highlighted first cell of a row that can be checked: its checkbox is also the drag handle,
 * so a click checks the row and dragging moves it. Used by the checklists and the to-do tables.
 */
function CheckHandle({
  id,
  handle,
  checked,
  onCheckedChange,
  label,
  cell,
  disabled,
}: {
  id?: string
  handle: ReturnType<ReturnType<typeof useReorder>["handle"]>
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label?: string
  /** Rendered as the first cell of a table row instead of a panel row. */
  cell?: boolean
  /** Decided by the other fields: shown, but can't be changed. */
  disabled?: boolean
}) {
  const box = (
    <Checkbox
      id={id}
      checked={checked}
      onCheckedChange={(v) => onCheckedChange(v === true)}
      aria-label={label}
      disabled={disabled}
      className="cursor-grab active:cursor-grabbing"
    />
  )
  return (
    <Hint label={disabled ? "Ergibt sich aus den Eingaben, ziehen zum Verschieben" : "Klicken zum Abhaken, ziehen zum Verschieben"}>
      {cell ? (
        <td
          {...handle}
          className="w-10 min-w-10 cursor-grab border-r border-border/60 bg-muted/50 group-focus-within:bg-accent/60 group-hover:bg-accent/60 active:cursor-grabbing"
        >
          <span className="flex items-center justify-center">{box}</span>
        </td>
      ) : (
        <span {...handle} className={cn(LEAD, "cursor-grab group-hover:bg-accent/60 active:cursor-grabbing")}>
          {box}
        </span>
      )}
    </Hint>
  )
}

/** A text field of a checklist option, filling its cell (with suggestions if it has any). */
function InlineTextInput({ field, values, onChange, suggestions, docId }: FieldProps<TextField>) {
  const value = str(values[field.key])
  const className = cn(CELL_COMBOBOX, "text-sm")
  return field.autocomplete ? (
    <Combobox
      value={value}
      onChange={(v) => onChange(field.key, v)}
      options={groupOptions(field, suggestions, docId)}
      placeholder={field.label}
      aria-label={field.label}
      className={className}
    />
  ) : (
    <Input
      value={value}
      onChange={(e) => onChange(field.key, e.target.value)}
      placeholder={field.label}
      aria-label={field.label}
      className={className}
    />
  )
}

/**
 * Bullet points as rows of one panel, one input per point. Enter starts the next point
 * (splitting at the cursor), Backspace in an empty one removes it, arrows move between them.
 * Points are reordered by dragging their handle.
 */
function ListInput({ field, values, onChange, onUpdate, bare }: FieldProps<ListField>) {
  const stored = listItems(values[field.key])
  // Without a fallback nothing stands in for missing points, so the list may have none at all.
  const canBeEmpty = !field.fallback
  const items = stored.length || canBeEmpty ? stored : [""]
  const refs = useRef<(HTMLInputElement | null)[]>([])
  /** Where the cursor goes after the next change: the start, the end or a position of a point. */
  const focusNext = useRef<{ index: number; at: "start" | "end" | number } | null>(null)
  /** The point and selection the cursor was last in, where a snippet goes. */
  const caret = useRef<{ index: number; start: number; end: number } | null>(null)

  useLayoutEffect(() => {
    const next = focusNext.current
    if (!next) return
    focusNext.current = null
    const el = refs.current[next.index]
    el?.focus()
    const pos = typeof next.at === "number" ? next.at : next.at === "end" ? (el?.value.length ?? 0) : 0
    el?.setSelectionRange(pos, pos)
  })

  const set = (next: string[]) => onChange(field.key, next)
  const reorder = useReorder((from, to) => set(move(items, from, to)))

  /** Removes point `i`; one with text can be put back from the toast. */
  function remove(i: number) {
    const item = items[i]
    if (items.length > 1) splice(i, [])
    else set([])
    if (item.trim())
      removedToast(`Punkt ${i + 1}`, () => onUpdate(field.key, (v) => insertAt(listItems(v), i, item)))
  }

  /** Replaces point `i` with `lines` and puts the cursor at the end of the last one. */
  function splice(i: number, lines: string[], remove = 1) {
    focusNext.current = { index: Math.max(0, i + lines.length - 1), at: "end" }
    set([...items.slice(0, i), ...lines, ...items.slice(i + remove)])
  }

  /**
   * Puts a snippet where the cursor was last, replacing the selected text; each further line
   * becomes a point of its own. Without a cursor in the field it's added as new points.
   */
  function insertSnippet(text: string) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim())
    if (!lines.length) return
    const at = caret.current && caret.current.index < items.length ? caret.current : null
    if (!at) {
      const filled = items.filter((x) => x.trim())
      focusNext.current = { index: filled.length + lines.length - 1, at: "end" }
      set([...filled, ...lines])
      return
    }
    const item = items[at.index]
    const before = item.slice(0, at.start)
    const after = item.slice(at.end)
    const last = lines.length - 1
    const next = lines.map((l, j) => (j === 0 ? before : "") + l + (j === last ? after : ""))
    const pos = (last === 0 ? before.length : 0) + lines[last].length
    caret.current = { index: at.index + last, start: pos, end: pos }
    focusNext.current = { index: at.index + last, at: pos }
    set([...items.slice(0, at.index), ...next, ...items.slice(at.index + 1)])
  }

  /** Remembers where the cursor is in point `i`, for `insertSnippet`. */
  function trackCaret(el: HTMLInputElement, i: number) {
    caret.current = { index: i, start: el.selectionStart ?? el.value.length, end: el.selectionEnd ?? el.value.length }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>, i: number) {
    const el = e.currentTarget
    if (e.key === "Enter") {
      e.preventDefault()
      const pos = el.selectionStart ?? el.value.length
      splice(i, [el.value.slice(0, pos), el.value.slice(pos)])
      focusNext.current = { index: i + 1, at: "start" }
    } else if (e.key === "Backspace" && el.value === "" && (items.length > 1 || canBeEmpty)) {
      e.preventDefault()
      splice(i, [])
      focusNext.current = { index: Math.max(0, i - 1), at: "end" }
    } else if (e.key === "ArrowUp" && i > 0) {
      e.preventDefault()
      refs.current[i - 1]?.focus()
    } else if (e.key === "ArrowDown" && i < items.length - 1) {
      e.preventDefault()
      refs.current[i + 1]?.focus()
    }
  }

  return (
    <Labeled label={field.label} bare={bare} required={field.required} className={FULL}>
      {/* One panel like the tables: a highlighted drag handle, then the text of the point. */}
      <div className={cn(BOX, "divide-y divide-border/60")}>
        <PanelHeader label={field.label} removable action={<SnippetMenu onInsert={insertSnippet} />} />
        <ul className="divide-y divide-border/60">
          {items.map((item, i) => (
            <li key={i} {...reorder.row(i)} className={cn("group flex items-stretch focus-within:bg-accent/20", reorder.rowClass(i))}>
              {/* Drag handle, like the rows of the tables. */}
              <Hint label="Ziehen zum Verschieben">
                <span
                  {...reorder.handle(i)}
                  className={cn(LEAD, "cursor-grab text-muted-foreground group-focus-within:bg-accent/60 active:cursor-grabbing")}
                >
                  <GripVerticalIcon className="size-3.5 group-focus-within:text-foreground" />
                </span>
              </Hint>
              <input
                ref={(el) => {
                  refs.current[i] = el
                }}
                value={item}
                onChange={(e) => set(items.map((x, j) => (j === i ? e.target.value : x)))}
                onKeyDown={(e) => handleKeyDown(e, i)}
                onSelect={(e) => trackCaret(e.currentTarget, i)}
                onFocus={(e) => trackCaret(e.currentTarget, i)}
                onPaste={(e) => {
                  const lines = e.clipboardData.getData("text").split(/\r?\n/).filter((l) => l.trim())
                  if (lines.length < 2) return
                  e.preventDefault()
                  splice(i, item.trim() ? [item, ...lines] : lines)
                }}
                placeholder={i === 0 ? field.fallback || undefined : undefined}
                aria-label={`${field.label}, Punkt ${i + 1}`}
                className="h-10 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
              />
              <RemoveCell label={`Punkt ${i + 1} entfernen`} onRemove={() => remove(i)} />
            </li>
          ))}
        </ul>
        <AddRow label="Punkt hinzufügen" onClick={() => splice(items.length, [""], 0)} end />
      </div>
    </Labeled>
  )
}

function DateTimeInput({ field, values, onChange }: FieldProps<DateTimeField>) {
  const id = useId()
  const value = str(values[field.key])
  return (
    <Labeled id={id} label={field.label} className={SHORT}>
      {value ? (
        <div className="relative">
          <Input
            id={id}
            type="datetime-local"
            value={value}
            onChange={(e) => onChange(field.key, e.target.value)}
            className="pr-9 scheme-dark"
          />
          <Hint label="Zurück auf automatisch">
            <button
              type="button"
              onClick={() => onChange(field.key, "")}
              aria-label="Zeit leeren"
              className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <XIcon className="size-3.5" />
            </button>
          </Hint>
        </div>
      ) : (
        <div className="flex h-9 items-center rounded-lg border border-dashed pr-1 pl-2.5">
          <Hint label="Beim Kopieren werden Datum und Uhrzeit des Kopierens eingesetzt">
            <span className="flex-1 truncate text-sm text-muted-foreground">Automatisch</span>
          </Hint>
          <button
            id={id}
            type="button"
            onClick={() => onChange(field.key, localNow())}
            className="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ClockIcon className="size-3.5" /> Jetzt
          </button>
        </div>
      )}
    </Labeled>
  )
}

/** Shows `{key}` references as plain text instead of inline code. */
const plain = (label: string) => label.replace(/`/g, "")

/** `text` with its `inline code` shown as code, like in the rendered Markdown. */
function withCode(text: string) {
  return text.split("`").map((part, i) =>
    i % 2 ? (
      <code key={i} className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
        {part}
      </code>
    ) : (
      part
    ),
  )
}

function ChecksInput(props: FieldProps<ChecksField>) {
  const { field, values, reader, onChange, onUpdate, bare, docId } = props
  const checked = checkedOptions(values[field.key])
  const own = listItems(values[customKey(field.key)]).filter((o) => o.trim())
  const hidden = listItems(values[hiddenKey(field.key)])
  // Hidden standard options the template still has; only those can come back.
  const restorable = field.options.filter((o) => hidden.includes(o))
  const options = checkOptions(field, values)
  // Same order as `options`, with `{key}` references filled in.
  const items = reader.checks(field.key)
  const [draft, setDraft] = useState("")
  const id = useId()
  const setChecked = (next: string[]) => onChange(field.key, next)
  const reorder = useReorder((from, to) => onChange(orderKey(field.key), move(options, from, to)))
  const decided = field.auto?.(reader) ?? {}
  const [open, setOpen] = useOpenPanels(docId, INITIALLY_OPEN)
  const panel = `field:${field.key}`
  const folded = !!field.collapsible && !open.includes(panel)

  /** Adds an own option and checks it; an existing one is just checked. */
  function addOwn() {
    const option = draft.trim()
    if (!option) return
    if (hidden.includes(option)) restore([option])
    else if (!field.options.includes(option) && !own.includes(option)) onChange(customKey(field.key), [...own, option])
    if (!checked.includes(option)) setChecked([...checked, option])
    setDraft("")
  }

  /** Own options are deleted (the toast puts them back); standard ones are hidden for this document. */
  function remove(option: string) {
    const wasChecked = checked.includes(option)
    if (own.includes(option)) {
      const index = own.indexOf(option)
      onChange(customKey(field.key), own.filter((o) => o !== option))
      removedToast(`„${plain(option)}"`, () => {
        onUpdate(customKey(field.key), (v) => {
          const now = listItems(v)
          return now.includes(option) ? now : insertAt(now, index, option)
        })
        if (wasChecked) onUpdate(field.key, (v) => [...new Set([...checkedOptions(v), option])])
      })
    } else onChange(hiddenKey(field.key), [...hidden, option])
    setChecked(checked.filter((c) => c !== option))
  }

  /** Shows hidden standard options again. */
  function restore(options: string[]) {
    onChange(hiddenKey(field.key), hidden.filter((o) => !options.includes(o)))
  }

  /** The inline fields an option refers to with `{key}`. */
  const inlineFields = (option: string) =>
    [...option.matchAll(/\{(\w+)\}/g)].flatMap(([, key]) => field.inline?.find((f) => f.key === key) ?? [])

  /** An option's text; where it refers to an inline field, the entered value (or the field's name, dimmed). */
  function optionText(option: string, i: number) {
    if (!inlineFields(option).length) return withCode(items[i]?.label ?? option)
    return option.split(/`?\{(\w+)\}`?/).map((part, j) => {
      if (j % 2 === 0) return part
      const inline = field.inline?.find((f) => f.key === part)
      const value = str(values[part]).trim()
      return (
        <span key={j} className={cn("mx-1", value ? "font-medium" : "text-muted-foreground/60")}>
          {value || `[${inline?.label ?? part}]`}
        </span>
      )
    })
  }

  return (
    <Labeled label={field.label} hint={field.hint} bare={bare} required={field.required} className={FULL}>
      {/* Rows like the bullet lists: the checkbox (also the drag handle) in the highlighted cell, then the text. */}
      <div className={cn(BOX, "divide-y divide-border/60")}>
        {field.collapsible ? (
          <button
            type="button"
            onClick={() => setOpen(folded ? [...open, panel] : open.filter((p) => p !== panel))}
            aria-expanded={!folded}
            className="flex min-h-9 w-full items-stretch bg-muted/50 text-left text-xs font-medium text-muted-foreground hover:bg-accent/40 hover:text-foreground"
          >
            <span className={cn(LEAD, "bg-transparent")}>
              <ChevronDownIcon className={cn("size-3.5 transition-transform", folded && "-rotate-90")} />
            </span>
            <span className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2">
              <span className="shrink-0">{field.label}</span>
              {folded && (
                <span className="truncate font-normal text-foreground">
                  {items.filter((c) => c.checked).map((c) => plain(c.label)).join(", ") || "Keine"}
                </span>
              )}
            </span>
          </button>
        ) : (
          <PanelHeader label={field.label} removable={!!field.custom} />
        )}
        {!folded && options.map((option, i) => {
          const auto = option in decided
          const on = items[i]?.checked ?? checked.includes(option)
          return (
            <div
              key={option}
              {...reorder.row(i)}
              className={cn("group flex items-stretch animate-in duration-200 fade-in-0 hover:bg-accent/20", reorder.rowClass(i))}
            >
              <CheckHandle
                id={`${id}-${i}`}
                handle={reorder.handle(i)}
                checked={on}
                disabled={auto}
                onCheckedChange={(v) => setChecked(v ? [...checked, option] : checked.filter((c) => c !== option))}
              />
              <label
                htmlFor={`${id}-${i}`}
                className={cn(
                  "flex min-h-10 flex-1 items-center gap-2 px-3 py-2 text-sm text-muted-foreground",
                  !auto && "cursor-pointer",
                  on && "text-foreground",
                )}
              >
                <span className="block">{optionText(option, i)}</span>
                {auto && (
                  <span className="flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">
                    <SparklesIcon className="size-3" /> automatisch
                  </span>
                )}
              </label>
              {/* Inline fields get a column of their own, only in the rows that have them. */}
              {inlineFields(option).map((inline) => (
                <span key={inline.key} className="w-56 shrink-0 border-l border-border/60">
                  <InlineTextInput
                    {...props}
                    field={inline}
                    onChange={(key, value) => {
                      onChange(key, value)
                      if (typeof value === "string" && value.trim() && !checked.includes(option)) setChecked([...checked, option])
                    }}
                  />
                </span>
              ))}
              {field.custom && <RemoveCell label={`„${plain(option)}" entfernen`} onRemove={() => remove(option)} />}
            </div>
          )
        })}
        {restorable.length > 0 && !folded && (
          <DropdownMenu>
            <DropdownMenuTrigger className="group/add flex h-10 w-full items-stretch text-left text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:bg-accent/30 data-[state=open]:text-foreground">
              <span className={cn(LEAD, "group-hover/add:bg-accent/60")}>
                <EyeIcon className="size-3.5" />
              </span>
              <span className="flex flex-1 items-center px-3">Ausgeblendete wiederherstellen ({restorable.length})</span>
              <span className={END} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-w-md">
              <DropdownMenuLabel>Ausgeblendet</DropdownMenuLabel>
              {restorable.map((o) => (
                <DropdownMenuItem key={o} onSelect={() => restore([o])}>
                  <span className="truncate">{plain(o)}</span>
                </DropdownMenuItem>
              ))}
              {restorable.length > 1 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => restore(restorable)}>Alle wiederherstellen</DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {field.custom && !folded && (
          <div className="group/add flex items-stretch text-sm text-muted-foreground focus-within:text-foreground">
            <span className={cn(LEAD, "group-focus-within/add:bg-accent/60")}>
              <PlusIcon className="size-3.5" />
            </span>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  addOwn()
                } else if (e.key === "Escape" && draft) {
                  e.preventDefault()
                  e.stopPropagation()
                  setDraft("")
                }
              }}
              onBlur={addOwn}
              placeholder={field.custom}
              aria-label={`${field.label}: eigener Eintrag`}
              className="h-10 min-w-0 flex-1 bg-transparent px-3 outline-none placeholder:text-muted-foreground"
            />
            <span className={END} />
          </div>
        )}
      </div>
    </Labeled>
  )
}

/** Shows which option the other fields lead to; it can't be picked by hand. */
function ChoiceInput({ field, reader, bare }: FieldProps<ChoiceField>) {
  const auto = field.auto(reader)
  return (
    <Labeled label={field.label} hint={field.hint} bare={bare} className={FULL}>
      <div role="radiogroup" aria-readonly className={cn(BOX, "divide-y divide-border/60")}>
        <PanelHeader label={field.label} />
        {field.options.map((option) => {
          const active = option === auto
          return (
            <div
              key={option}
              role="radio"
              aria-checked={active}
              className={cn("flex min-h-10 items-stretch text-sm text-muted-foreground", active && "bg-accent/30 text-foreground")}
            >
              <span className={cn(LEAD, active && "bg-accent/60")}>
                <span
                  aria-hidden
                  className={cn("size-4 rounded-full border border-input", active && "border-[5px] border-primary")}
                />
              </span>
              <span className="flex flex-1 items-center gap-3 px-3 py-2">
                <span className="flex-1">{withCode(option.replace(/[,.]$/, ""))}</span>
                {active && (
                  <span className="flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">
                    <SparklesIcon className="size-3" /> automatisch
                  </span>
                )}
              </span>
            </div>
          )
        })}
      </div>
      {!auto && (
        <p className="text-xs text-muted-foreground/70">Wird aus gemessener und erlaubter Geschwindigkeit bestimmt.</p>
      )}
    </Labeled>
  )
}

/** A plain input that fills its table cell. */
export const CELL_INPUT =
  "h-10 w-full min-w-0 bg-transparent px-3 outline-none placeholder:text-muted-foreground/60 focus:bg-accent/30"

/**
 * Rows as an editable table, or as cards with `cards`. Rows are reordered by dragging their
 * handle, which changes the order in the case file.
 */
function TableInput({
  field,
  values,
  reader,
  onChange,
  onUpdate,
  bare,
  suggestions,
  docId,
  cards,
}: FieldProps<TableField> & { cards?: boolean }) {
  const rows = tableRows(values[field.key])
  const setRows = (next: Row[]) => onChange(field.key, next)
  /** Changes the rows as they are stored by then, e.g. from a toast. */
  const updateRows = (fn: (rows: Row[]) => Row[]) => onUpdate(field.key, (v) => fn(tableRows(v)))
  const reorder = useReorder((from, to) => setRows(move(rows, from, to)))
  const setCell = (i: number, key: string, value: string) =>
    setRows(rows.map((row, j) => (j === i ? { ...row, [key]: value } : row)))

  const rowSource = (row: Row, i: number, column?: string) => sourceId(docId, field.key, row.id ?? String(i), column)
  /** Earlier rows of this table, without the row itself. */
  const knownFor = (row: Row, i: number) => offered(suggestions.rows[field.key] ?? [], rowSource(row, i))

  /**
   * What a cell offers: fixed suggestions, values from the same document or the DNA database,
   * then the values of its group, or (for columns without one) what the column had in earlier rows.
   */
  function cellOptions(row: Row, i: number, c: Column): ComboboxOption[] {
    const cell = rowSource(row, i, c.key)
    const group = typeof c.group === "function" ? c.group(row) : c.group
    const earlierRows = field.remember ? knownFor(row, i).map((k) => k.row[c.key]?.trim() ?? "") : []
    const earlier = !c.autocomplete
      ? []
      : group
        ? offeredFrom(suggestions, GROUP_OFFERS[group], cell)
        : offered(suggestions.columns[`${field.key}.${c.key}`] ?? [], cell).map((s) => s.value)
    return unique<ComboboxOption>([
      ...[...(c.suggestions ?? []), ...(c.options?.(values) ?? [])].filter((v) => v.trim()),
      ...[...earlierRows, ...earlier].filter((v) => v && v !== c.initial),
    ])
  }

  /** Sets a cell picked from the DNA database; its entry fills the row's linked cells still empty. */
  function setLookup(i: number, lookup: Lookup, key: string, value: string, entry: DnaEntry | undefined) {
    const next = { ...rows[i], [key]: value }
    if (entry)
      for (const [from, key] of Object.entries(lookup.fill ?? {}) as [DbField, string][]) {
        const known = dbValue(entry, from)
        if (known && !next[key]?.trim()) next[key] = known
      }
    setRows(rows.map((row, j) => (j === i ? next : row)))
  }

  /** Sets the identifying cell; a known value fills the cells still empty (or at their default). */
  function setIdentity(i: number, value: string) {
    const known = knownFor(rows[i], i).find((k) => sameText(k.row[field.remember!] ?? "", value))
    setRows(
      rows.map((row, j) => {
        if (j !== i) return row
        const next = { ...row, [field.remember!]: value }
        if (!known) return next
        for (const c of field.columns) {
          const current = next[c.key]?.trim() ?? ""
          if (c.key !== field.remember && known.row[c.key]?.trim() && (!current || current === c.initial || current === c.formerInitial)) next[c.key] = known.row[c.key]
        }
        return next
      }),
    )
  }

  /** The input of a cell: filling its cell in the table, or a normal field on a card. */
  function cellInput(row: Row, i: number, c: Column) {
    const value = row[c.key] ?? ""
    const label = `${c.label} (${cards ? field.addLabel : "Zeile"} ${i + 1})`
    // The generic "N/A" isn't worth showing as a hint.
    const placeholder = c.fallback === "N/A" ? undefined : reader.fill(c.fallback)
    const set = (v: string) => setCell(i, c.key, v)
    const choices = c.mark ? MARKS : c.choices
    if (c.counter)
      return (
        <div
          className={cn(
            "flex w-full items-center text-sm focus-within:bg-accent/30",
            cards ? "h-9 rounded-lg border border-input px-1.5" : "h-10 px-1.5",
          )}
        >
          <Counter label={label} value={value} onChange={set} />
        </div>
      )
    if (c.parts)
      return (
        <div
          className={cn(
            "flex w-full items-center gap-1.5 text-sm focus-within:bg-accent/30",
            cards ? "h-9 rounded-lg border border-input px-2.5" : "h-10 px-3",
          )}
        >
          {c.parts.map((p, j) => (
            <Fragment key={p.key}>
              {j > 0 && <span className="text-muted-foreground">+</span>}
              <input
                value={row[p.key] ?? ""}
                onChange={(e) => setCell(i, p.key, e.target.value)}
                placeholder="0"
                aria-label={`${c.label}: ${p.label} (${cards ? field.addLabel : "Zeile"} ${i + 1})`}
                inputMode="numeric"
                autoComplete="off"
                className="w-8 min-w-0 bg-transparent text-right outline-none placeholder:text-muted-foreground/60"
              />
              <span className="text-muted-foreground">{p.label}</span>
            </Fragment>
          ))}
        </div>
      )
    if (c.traces)
      return (
        <TracesCell
          label={label}
          title={field.cardTitle?.(row, i) ?? `${field.addLabel} ${i + 1}`}
          traces={rowTraces(row, c.key, c.traces.kinds)}
          kinds={Object.keys(c.traces.kinds) as TraceKind[]}
          spots={c.traces.spots}
          onChange={set}
          onUpdate={(fn) =>
            updateRows((now) =>
              now.map((r, j) =>
                (row.id ? r.id === row.id : j === i) ? { ...r, [c.key]: storeTraces(fn(rowTraces(r, c.key, c.traces!.kinds))) } : r,
              ),
            )
          }
          boxed={cards}
        />
      )
    if (choices) return <ChoiceCell label={label} value={value} choices={choices} onChange={set} boxed={cards} />
    if (c.range)
      return <RangeInput label={label} value={value} range={c.range} onChange={set} className={cards ? undefined : CELL_INPUT} />
    // People and IDs are picked from the DNA database (or added to it), never left half typed.
    const lookup = rowLookup(c, row)
    if (lookup)
      return (
        <DnaPicker
          value={value}
          kinds={lookupKinds(lookup)}
          names={lookup.field === "name"}
          show={lookup.nameOnly ? "name" : undefined}
          extra={cellOptions(row, i, c).map((o) => (typeof o === "string" ? o : o.value))}
          onChange={(v, entry) => setLookup(i, lookup, c.key, v, entry)}
          placeholder={placeholder}
          aria-label={label}
          className={cards ? undefined : CELL_COMBOBOX}
        />
      )
    if (field.remember || c.autocomplete || c.suggestions || c.options)
      return (
        <Combobox
          value={value}
          onChange={(v) => (c.key === field.remember ? setIdentity(i, v) : set(v))}
          options={cellOptions(row, i, c)}
          placeholder={placeholder}
          aria-label={label}
          className={cards ? undefined : CELL_COMBOBOX}
        />
      )
    return cards ? (
      <Input value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder} aria-label={label} />
    ) : (
      <input
        value={value}
        onChange={(e) => set(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className={CELL_INPUT}
      />
    )
  }

  const panel = useRef<HTMLDivElement>(null)
  /** The index of the row just added; its first input takes the focus once it is shown. */
  const focusRow = useRef<number>(undefined)
  useLayoutEffect(() => {
    const shown = panel.current?.querySelectorAll("[data-row]")
    if (focusRow.current === undefined || !shown || shown.length <= focusRow.current) return
    shown[focusRow.current].querySelector("input")?.focus()
    focusRow.current = undefined
  })

  function add() {
    focusRow.current = rows.length
    setRows([...rows, { id: crypto.randomUUID(), ...Object.fromEntries(field.columns.map((c) => [c.key, c.initial ?? ""])) }])
  }

  /** Removes row `i`; the toast puts it back where it was, among the rows as they are by then. */
  function remove(i: number) {
    const row = rows[i]
    setRows(rows.filter((_, j) => j !== i))
    removedToast(`${field.addLabel} ${i + 1}`, () =>
      updateRows((now) => (row.id && now.some((r) => r.id === row.id) ? now : insertAt(now, i, row))),
    )
  }

  /** A check column takes the place of the drag handle, like the checkboxes of the checklists. */
  const check = field.columns.find((c) => c.check)
  const columns = field.columns.filter((c) => c !== check)

  /** The drag handle of a row; with a check column, its checkbox. */
  function handle(row: Row, i: number, cell?: boolean) {
    if (check)
      return (
        <CheckHandle
          cell={cell}
          handle={reorder.handle(i)}
          checked={row[check.key] === "✓"}
          onCheckedChange={(v) => setCell(i, check.key, v ? "✓" : "")}
          label={`${check.label} (${cards ? field.addLabel : "Zeile"} ${i + 1})`}
        />
      )
    return cell ? (
      <Hint label="Ziehen zum Verschieben">
        <td
          {...reorder.handle(i)}
          className="w-10 min-w-10 cursor-grab border-r border-border/60 bg-muted/50 text-muted-foreground group-focus-within:bg-accent/60 active:cursor-grabbing"
        >
          <GripVerticalIcon className="mx-auto size-3.5" />
        </td>
      </Hint>
    ) : (
      <Hint label="Ziehen zum Verschieben">
        <span
          {...reorder.handle(i)}
          className={cn(LEAD, "cursor-grab text-muted-foreground group-focus-within:bg-accent/60 active:cursor-grabbing")}
        >
          <GripVerticalIcon className="size-3.5" />
        </span>
      </Hint>
    )
  }

  if (cards)
    return (
      <Labeled label={field.label} bare={bare} required={field.required} className={FULL}>
        <div ref={panel} className="grid gap-3">
          {rows.map((row, i) => (
            <div key={row.id ?? i} data-row {...reorder.row(i)} className={cn(BOX, "group", reorder.rowClass(i))}>
              {/* Header like a panel row: the drag handle, the card's title, its remove button. */}
              <div className="flex h-10 items-stretch border-b border-border/60 bg-muted/50">
                {handle(row, i)}
                <span className="flex min-w-0 flex-1 items-center truncate px-3 text-sm font-medium">
                  {field.cardTitle?.(row, i) ?? `${field.addLabel} ${i + 1}`}
                </span>
                <RemoveCell label={`${field.addLabel} ${i + 1} entfernen`} onRemove={() => remove(i)} />
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-4 p-4">
                {columns.map((c, j) => (
                  <Fragment key={c.key}>
                    {c.heading && (
                      <span className={cn(FULL, "text-sm font-medium", j > 0 && "mt-2 border-t border-border/60 pt-4")}>
                        {c.heading}
                      </span>
                    )}
                    <div className={cn("grid content-start gap-1.5", c.wide ? FULL : SHORT)}>
                      <span className="text-xs font-medium text-muted-foreground">{c.label}</span>
                      {cellInput(row, i, c)}
                    </div>
                  </Fragment>
                ))}
              </div>
            </div>
          ))}
          <AddRow label={`${field.addLabel} hinzufügen`} onClick={add} className="overflow-hidden rounded-lg border border-dashed" />
        </div>
      </Labeled>
    )

  return (
    <Labeled label={field.label} bare={bare} required={field.required} className={FULL}>
      <div ref={panel} className={cn(BOX, "overflow-x-auto")}>
        {/* Separate borders, so each cell draws its border inside its own width like the panel rows:
            the handle column then lines up exactly with the add button below. */}
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="bg-muted/50 text-xs text-muted-foreground *:border-b">
              <th className="w-10 min-w-10 border-r border-border/60">
                <span className="sr-only">{check ? `${check.label}, Verschieben` : "Verschieben"}</span>
              </th>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "h-9 border-r border-border/60 px-3 text-left font-medium whitespace-nowrap",
                    c.mark || c.choices ? "w-32" : c.range || c.traces || c.counter ? "w-32 min-w-32" : c.wide || c.parts ? "min-w-48" : "min-w-28",
                  )}
                >
                  {c.label}
                </th>
              ))}
              <th className="w-10 min-w-10 border-border/60">
                <span className="sr-only">Entfernen</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.id ?? i}
                data-row
                {...reorder.row(i)}
                className={cn("group focus-within:bg-accent/20 *:border-b", reorder.rowClass(i))}
              >
                {handle(row, i, true)}
                {columns.map((c) => (
                  <td key={c.key} className="border-r border-border/60 p-0">
                    {cellInput(row, i, c)}
                  </td>
                ))}
                <td className="border-border/60">
                  <Hint label="Entfernen">
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      aria-label={`Zeile ${i + 1} entfernen`}
                      className="mx-auto flex size-7 items-center justify-center rounded-md text-muted-foreground/70 hover:bg-accent hover:text-foreground"
                    >
                      <XIcon className="size-3.5" />
                    </button>
                  </Hint>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <AddRow label={`${field.addLabel} hinzufügen`} onClick={add} className="sticky left-0" />
      </div>
    </Labeled>
  )
}

const MARKS: Choice[] = [
  { value: "✓", label: "Ja", className: "text-emerald-400" },
  { value: "×", label: "Nein", className: "text-red-400" },
]

/** One of `choices` from a dropdown, e.g. Ja (✓) or Nein (×); "Offen" leaves the cell empty, which writes its fallback. */
export function ChoiceCell({
  label,
  value,
  choices,
  onChange,
  boxed,
  empty = "---",
}: {
  label: string
  value: string
  choices: Choice[]
  onChange: (value: string) => void
  /** Bordered like an input, instead of filling a table cell. */
  boxed?: boolean
  /** What the cell shows while nothing is chosen. */
  empty?: string
}) {
  const current = choices.find((m) => m.value === value)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${label}: ${current?.label ?? current?.value ?? "offen"}`}
        className={cn(
          "flex w-full items-center gap-2 text-left text-sm outline-none",
          boxed
            ? "h-9 rounded-lg border border-input px-2.5 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=open]:bg-accent/30"
            : "h-10 px-3 hover:bg-accent/30 focus-visible:bg-accent/30 data-[state=open]:bg-accent/30",
          current ? current.className : "text-muted-foreground/60",
        )}
      >
        <span className="flex-1 truncate">{current ? (current.label ?? current.value) : empty}</span>
        <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-32">
        {choices.map((m) => (
          <DropdownMenuItem key={m.value} onSelect={() => onChange(m.value)}>
            <span className={cn("flex-1", m.className)}>{m.label ?? m.value}</span>
            {value === m.value && <CheckIcon className="size-3.5" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onChange("")}>
          <span className="flex-1 text-muted-foreground">Offen</span>
          {!current && <CheckIcon className="size-3.5" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** A count with − and + buttons, e.g. of projectiles; empty counts as 0 and it never goes below. */
function Counter({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const count = Math.max(0, Number.parseInt(value, 10) || 0)
  const step = "flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
  return (
    <span className="flex w-full min-w-0 items-center gap-0.5">
      <button type="button" onClick={() => onChange(String(count - 1))} disabled={count === 0} aria-label={`${label}: eins weniger`} className={step}>
        <MinusIcon className="size-3.5" />
      </button>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        placeholder="0"
        aria-label={label}
        inputMode="numeric"
        autoComplete="off"
        className="min-w-0 flex-1 bg-transparent text-center tabular-nums outline-none placeholder:text-muted-foreground/60"
      />
      <button type="button" onClick={() => onChange(String(count + 1))} aria-label={`${label}: eins mehr`} className={step}>
        <PlusIcon className="size-3.5" />
      </button>
    </span>
  )
}

/** Rolls a random value, e.g. within a range. */
export function DiceButton({ label, onClick, className }: { label: string; onClick: () => void; className?: string }) {
  return (
    <Hint label="Würfeln">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={cn(
          "flex w-8 items-center justify-center text-muted-foreground/70 hover:text-foreground active:scale-90",
          className,
        )}
      >
        <DicesIcon className="size-3.5" />
      </button>
    </Hint>
  )
}

/**
 * A number within a typical range: the range is the placeholder, the unit stands after
 * the value, and the dice roll one. Any other value can be typed too.
 */
export function RangeInput({
  id,
  label,
  value,
  range,
  onChange,
  className,
}: {
  id?: string
  label: string
  value: string
  range: Range
  onChange: (value: string) => void
  /** Classes of a plain input, e.g. to fill a table cell; without, it's a normal input. */
  className?: string
}) {
  const props = {
    id,
    value,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    placeholder: rangeLabel(range),
    "aria-label": label,
    inputMode: "decimal" as const,
    autoComplete: "off",
  }
  return (
    <div className="relative">
      {className ? <input {...props} className={cn(className, "pr-14")} /> : <Input {...props} className="pr-14" />}
      {range.unit && value.trim() && !value.trim().endsWith(range.unit) && (
        <span className="pointer-events-none absolute inset-y-0 right-8 flex items-center text-sm text-muted-foreground">
          {range.unit}
        </span>
      )}
      <DiceButton label={`${label} würfeln`} onClick={() => onChange(roll(range))} className="absolute inset-y-0 right-0" />
    </div>
  )
}

/** The rights to read out during the statement, e.g. the Miranda warning. */
function Notice({ text }: { text?: string }) {
  if (!text) return null
  return (
    <div className="grid basis-full gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/5 px-4 py-3">
      <p className="flex items-center gap-2 text-xs font-medium text-amber-400">
        <ScaleIcon className="size-5 shrink-0" /> Belehrung
      </p>
      <p className="text-sm text-muted-foreground">{text.replace(/`/g, "")}</p>
    </div>
  )
}

/** Says where `{{ME}}` comes from while no own name is set. */
export function MeHint({ me }: { me: string }) {
  const { openPage } = useSettingsDialog()
  if (me !== ME) return null
  return (
    <p className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
      <SparklesIcon className="size-3.5 shrink-0" />
      <span>
        Kein eigener Name gesetzt, es wird <code className="text-foreground">{ME}</code> eingefügt.{" "}
        <button
          type="button"
          onClick={() => openPage("eigene-person")}
          className="font-medium text-foreground underline-offset-2 hover:underline"
        >
          Name eintragen
        </button>
      </span>
    </p>
  )
}
