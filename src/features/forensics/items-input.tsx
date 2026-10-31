import { useId, useState } from "react"
import { ChevronDownIcon, GripVerticalIcon, PlusIcon, Settings2Icon, TextQuoteIcon, TriangleAlertIcon } from "lucide-react"
import { cn } from "cn"
import { Hint } from "@/components/hint"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Combobox } from "@/components/combobox"
import type { Step } from "@/components/step-dialog"
import { DnaPicker } from "@/features/case-files/dna-picker"
import { AddRow, BOX, CELL_COMBOBOX, CELL_INPUT, Counter, END, FULL, Labeled, LEAD, RemoveCell, SHORT } from "@/features/case-files/doc-form"
import { move, useReorder } from "@/components/use-reorder"
import { useSettingsDialog } from "@/hooks/use-settings"
import { POLICE_FILES_BASE } from "@/features/case-files/paths"
import { snippetLabel, useSnippets, type Snippet } from "@/features/case-files/snippets"
import { TraceList } from "@/features/case-files/traces-cell"
import { lookupLabel, newDbData, rowLookup, rowTraces, storeTraces, traceSummary, type Trace, type TraceKind } from "@/features/case-files/traces"
import { tableRows, type Column, type CustomFieldProps, type TableField } from "@/features/case-files/templates"
import type { Row } from "@/features/case-files/types"
import { offered, offeredFrom, sourceId, type Suggestions } from "@/features/case-files/use-case-files"
import { useDnaEntries } from "@/features/dna-db/use-dna-entries"
import { AsservateList, type Draft, type ListColumn } from "./asservate-list"
import { isDone, ITEMS_KEY, openIn, openInAll, parseSteps, PLACEHOLDER, STEPS_KEY, storeSteps, withLegacySteps, type ExamStep } from "./items"
import { playbooksOf } from "./step-templates"
import { sameText } from "@/lib/text"

/** The column of the traces and the kinds it records. */
function tracesOf(field: TableField) {
  const c = field.columns.find((x) => x.traces) as Column & { traces: NonNullable<Column["traces"]> }
  return { key: c.key, kinds: c.traces.kinds, spots: c.traces.spots ?? [] }
}

/**
 * The editor of the items of an analysis: a list, each item edited in a dialog: what it is and
 * who seized it, its traces, then its examination step by step. The table's `templates` fill in a step.
 */
export function ItemsInput({ field, values, onChange, onUpdate, suggestions, docId }: CustomFieldProps<TableField>) {
  const { entries, addEntry, updateEntry } = useDnaEntries()
  const traces = tracesOf(field)
  const legacy = tableRows(values[STEPS_KEY]).length > 0
  const rows = withLegacySteps(tableRows(values[ITEMS_KEY]), values[STEPS_KEY])

  // The first change stores the steps of older analyses in their items.
  function change(next: Row[]) {
    onChange(ITEMS_KEY, next)
    if (legacy) onChange(STEPS_KEY, [])
  }

  // The table's own columns, as the document lists them.
  const columns: ListColumn[] = field.columns.map((c) => ({
    label: c.label,
    wide: c.wide,
    cell: (row) => {
      if (c.key === STEPS_KEY) {
        const steps = parseSteps(row[STEPS_KEY])
        if (!steps.length) return ""
        const label = `${steps.length} ${steps.length === 1 ? "Schritt" : "Schritte"}`
        const open = openInAll(steps)
        if (!open) return label
        return (
          <span className="inline-flex items-center gap-2">
            {label}
            <Hint label={`Noch ${open}× XXX auszufüllen`}>
              <span className="inline-flex items-center gap-1 text-xs text-amber-400">
                <TriangleAlertIcon className="size-3.5" /> {open} offen
              </span>
            </Hint>
          </span>
        )
      }
      if (c.traces) {
        const n = rowTraces(row, c.key, c.traces.kinds).length
        return n ? traceSummary(n) : ""
      }
      const lookup = rowLookup(c, row)
      return lookup ? lookupLabel(row, c.key, lookup, entries) : row[c.key]?.trim()
    },
  }))

  return (
    <AsservateList
      noun="Asservat"
      rows={rows}
      onChange={change}
      onUpdate={(fn) => (legacy ? change(fn(rows)) : onUpdate(ITEMS_KEY, (v) => fn(tableRows(v))))}
      newRow={() => ({ id: crypto.randomUUID(), anzahl: "1" })}
      columns={columns}
      title={(row) => row.bezeichnung?.trim() ?? ""}
      steps={(draft) => itemSteps(draft, { field, suggestions, docId })}
      // New IDs of the traces go into the DNA database, like from the traces of a table.
      onSave={(row) => {
        const kinds = Object.keys(traces.kinds) as TraceKind[]
        const { add, update } = newDbData(entries, rowTraces(row, traces.key, traces.kinds), kinds)
        for (const { id, input } of update) updateEntry(id, input)
        for (const input of add) addEntry(input)
      }}
    />
  )
}

interface Context {
  field: TableField
  suggestions: Suggestions
  docId: string
}

function itemSteps(draft: Draft, context: Context): Step[] {
  return [
    {
      title: "Asservat",
      description: "Was untersucht wurde und von wem es sichergestellt wurde.",
      content: <ItemStep {...draft} {...context} />,
    },
    {
      title: "Spuren",
      description: "DNA und Fingerabdrücke: von wem sie sind und wo sie gefunden wurden. Neue IDs kommen in die DNA-Datenbank.",
      content: <TracesStep {...draft} field={context.field} />,
    },
    {
      title: "Untersuchung",
      description:
        "Jede Untersuchung in der Reihenfolge, in der sie gemacht wurde. „Aus Vorlage“ fügt eine mit vorbereitetem Ergebnis ein; ihre XXX füllst du von Hand aus.",
      content: context.field.templates && <ExaminationStep {...draft} templates={context.field.templates} />,
    },
  ]
}

function ItemStep({ row, set, field, suggestions, docId }: Draft & Context) {
  const id = useId()
  const cell = (key: string) => sourceId(docId, field.key, row.id, key)
  // The kinds with a usual examination first, then the ones entered before.
  const entered = offered(suggestions.columns[`${field.key}.art`] ?? [], cell("art")).map((s) => s.value)
  const usual = playbooksOf(field.templates?.atom).map((p) => p.art)
  const kinds = [...usual, ...entered.filter((k) => !usual.some((u) => sameText(u, k)))]
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-4">
      <Labeled id={`${id}-bezeichnung`} label="Bezeichnung" className={FULL}>
        <Input
          id={`${id}-bezeichnung`}
          value={row.bezeichnung ?? ""}
          onChange={(e) => set({ bezeichnung: e.target.value })}
          placeholder="z. B. Handy des BES"
        />
      </Labeled>
      <Labeled id={`${id}-art`} label="Art" className={SHORT}>
        <Combobox id={`${id}-art`} value={row.art ?? ""} onChange={(v) => set({ art: v })} options={kinds} placeholder="z. B. Smartphone" />
      </Labeled>
      <Labeled label="Anzahl" className={SHORT}>
        <div className="flex h-9 items-center rounded-lg border border-input px-1.5 text-sm">
          <Counter label="Anzahl" value={row.anzahl ?? ""} onChange={(v) => set({ anzahl: v })} />
        </div>
      </Labeled>
      <Labeled id={`${id}-abgenommen`} label="Sichergestellt von" className={SHORT}>
        <Combobox
          id={`${id}-abgenommen`}
          value={row.abgenommen ?? ""}
          onChange={(v) => set({ abgenommen: v })}
          options={offeredFrom(suggestions, ["officer"], cell("abgenommen"))}
          placeholder="Rang Name"
        />
      </Labeled>
      <Labeled id={`${id}-bes`} label="BES" className={SHORT}>
        <DnaPicker
          id={`${id}-bes`}
          value={row.bes ?? ""}
          kinds={["dna", "fa"]}
          names
          show="name"
          extra={offeredFrom(suggestions, ["suspect"], cell("bes"))}
          onChange={(v) => set({ bes: v })}
          placeholder="Von wem es stammt"
        />
      </Labeled>
    </div>
  )
}

function TracesStep({ row, set, field }: Draft & { field: TableField }) {
  const { key, kinds, spots } = tracesOf(field)
  // Kept here too, so a trace just added stays while it is still empty.
  const [traces, setTraces] = useState<Trace[]>(() => rowTraces(row, key, kinds))
  const update = (next: Trace[]) => {
    setTraces(next)
    set({ [key]: storeTraces(next) })
  }
  return (
    <TraceList
      kinds={Object.keys(kinds) as TraceKind[]}
      spots={spots}
      traces={traces}
      onChange={update}
      onRemove={(i) => update(traces.filter((_, j) => j !== i))}
    />
  )
}

const newStep = (fill: Partial<ExamStep> = {}): ExamStep => ({ id: crypto.randomUUID(), untersuchung: "", ergebnis: "", ...fill })

function ExaminationStep({ row, set, templates }: Draft & { templates: NonNullable<TableField["templates"]> }) {
  const id = useId()
  // Kept here too, so a step just added stays while it is still empty; an empty one stands in
  // while there are none, so the table has a row to type into.
  const [steps, setSteps] = useState(() => {
    const stored = parseSteps(row[STEPS_KEY])
    return stored.length ? stored : [newStep()]
  })
  const update = (next: ExamStep[]) => {
    setSteps(next)
    set({ [STEPS_KEY]: storeSteps(next) })
  }
  const change = (i: number, patch: Partial<ExamStep>) => update(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  const reorder = useReorder((from, to) => update(move(steps, from, to)))
  const fieldsOf = (s: ExamStep) => [
    document.getElementById(`${id}-${s.id}`) as HTMLInputElement | null,
    document.getElementById(`${id}-${s.id}-ergebnis`) as HTMLTextAreaElement | null,
  ]
  const { snippets } = useSnippets(templates.atom)
  const titles = snippets.map((t) => t.title).filter((t) => t.trim())
  const entered = steps.filter((s) => s.untersuchung.trim() || s.ergebnis.trim())

  return (
    <div className="grid gap-3">
      {entered.length > 0 && <Progress steps={entered} />}
      <div className={cn(BOX, "divide-y divide-border/60")}>
        <div className="flex h-9 items-stretch bg-muted/50 text-xs font-medium text-muted-foreground">
          <span className="w-10 shrink-0 border-r border-border/60" />
          <span className="flex w-52 shrink-0 items-center border-r border-border/60 px-3">Untersuchung</span>
          <span className="flex flex-1 items-center px-3">Ergebnis</span>
          <span className={END} />
        </div>
        <ul className="divide-y divide-border/60">
          {steps.map((s, i) => (
            <li key={s.id} {...reorder.row(i)} className={cn("group flex items-stretch focus-within:bg-accent/20", reorder.rowClass(i))}>
              <span
                {...reorder.handle(i)}
                className={cn(LEAD, "cursor-grab text-muted-foreground group-focus-within:bg-accent/60 active:cursor-grabbing")}
              >
                <GripVerticalIcon className="size-3.5 group-focus-within:text-foreground" />
              </span>
              <div className="w-52 shrink-0 border-r border-border/60">
                <Combobox
                  id={`${id}-${s.id}`}
                  value={s.untersuchung}
                  onChange={(v) => change(i, { untersuchung: v })}
                  options={titles}
                  all
                  placeholder="z. B. Datenextraktion"
                  aria-label={`Untersuchung ${i + 1}`}
                  className={cn(CELL_COMBOBOX, "font-medium text-primary")}
                />
              </div>
              {/* Grows with its text; each line becomes a sub-point. */}
              <textarea
                id={`${id}-${s.id}-ergebnis`}
                rows={1}
                value={s.ergebnis}
                onChange={(e) => change(i, { ergebnis: e.target.value })}
                placeholder={i === 0 ? "Ergebnis; jede Zeile wird ein Unterpunkt" : undefined}
                aria-label={`Untersuchung ${i + 1}, Ergebnis`}
                className={cn(CELL_INPUT, "field-sizing-content h-auto min-h-10 flex-1 resize-none py-2.5 text-sm")}
              />
              {openIn(s) > 0 && (
                <Hint label="Nächstes XXX markieren; Tippen ersetzt es">
                  <button
                    type="button"
                    // The field keeps the focus, so the search goes on from its cursor.
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => selectNext(fieldsOf(s))}
                    className="flex shrink-0 items-center gap-1 border-l border-border/60 px-2 text-xs font-medium whitespace-nowrap text-amber-400 hover:bg-amber-400/10"
                  >
                    <TriangleAlertIcon className="size-3.5" /> {openIn(s)}× XXX
                  </button>
                </Hint>
              )}
              <RemoveCell label={`Untersuchung ${i + 1} entfernen`} onRemove={() => update(steps.filter((_, j) => j !== i))} />
            </li>
          ))}
        </ul>
        <div className="flex">
          <AddRow label="Untersuchung hinzufügen" onClick={() => update([...steps, newStep()])} />
          <TemplatePicker art={row.art ?? ""} templates={templates} steps={steps} onChange={update} />
        </div>
      </div>
    </div>
  )
}


/**
 * Selects the next placeholder after the cursor, in the focused field and then the ones after
 * it, wrapping around; typing then replaces it.
 */
function selectNext(fields: (HTMLInputElement | HTMLTextAreaElement | null)[]) {
  const at = fields.findIndex((f) => f && f === document.activeElement)
  const order = at < 0 ? fields : [...fields.slice(at), ...fields.slice(0, at + 1)]
  for (const [k, field] of order.entries()) {
    if (!field) continue
    const from = at >= 0 && k === 0 ? (field.selectionEnd ?? 0) : 0
    const match = [...field.value.matchAll(PLACEHOLDER)].find((m) => m.index >= from)
    if (!match) continue
    field.focus()
    field.setSelectionRange(match.index, match.index + match[0].length)
    return
  }
}

/** How many of the steps are filled in. */
function Progress({ steps }: { steps: ExamStep[] }) {
  const done = steps.filter(isDone).length
  const open = openInAll(steps)
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center text-xs text-muted-foreground">
        <span>
          {done} von {steps.length} {steps.length === 1 ? "Schritt" : "Schritten"} ausgefüllt
        </span>
        {open > 0 && <span className="ml-auto text-amber-400">{open}× XXX offen</span>}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
    </div>
  )
}

/**
 * "Aus Vorlage": the templates to tick, those of the usual examination of the item's kind
 * first. Ticking adds a step with the template's current text, unticking removes it again.
 */
function TemplatePicker({
  art,
  templates,
  steps,
  onChange,
}: {
  art: string
  templates: NonNullable<TableField["templates"]>
  steps: ExamStep[]
  onChange: (steps: ExamStep[]) => void
}) {
  const { snippets } = useSnippets(templates.atom)
  const { openPage } = useSettingsDialog()
  const playbook = playbooksOf(templates.atom).find((p) => sameText(p.art, art))
  // Templates removed in the settings are left out.
  const usual = (playbook?.steps ?? []).flatMap((tid) => snippets.filter((s) => s.id === tid))
  const others = snippets.filter((s) => !usual.includes(s))
  const stepOf = (t: Snippet) => steps.find((s) => sameText(s.untersuchung, t.title))
  // The empty stand-in row makes way for the first template.
  const kept = steps.filter((s) => s.untersuchung.trim() || s.ergebnis.trim())
  const add = (ts: Snippet[]) => onChange([...kept, ...ts.map((t) => newStep(templates.fill(t)))])
  const toggle = (t: Snippet) => {
    const step = stepOf(t)
    if (step) onChange(steps.filter((s) => s !== step))
    else add([t])
  }
  const missing = usual.filter((t) => !stepOf(t))
  const item = (t: Snippet) => {
    const step = stepOf(t)
    return (
      <DropdownMenuCheckboxItem
        key={t.id}
        checked={!!step}
        // Stays open, so several can be picked in a row.
        onSelect={(e) => e.preventDefault()}
        onCheckedChange={() => toggle(t)}
        className="grid gap-0.5"
      >
        <span className="flex items-center gap-2 text-xs font-medium text-primary">
          <span className="truncate">{snippetLabel(t)}</span>
          {step && openIn(step) > 0 && <span className="ml-auto shrink-0 text-amber-400">{openIn(step)}× XXX</span>}
        </span>
        {t.text.trim() && <span className="line-clamp-2">{t.text}</span>}
      </DropdownMenuCheckboxItem>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex shrink-0 items-center gap-1.5 border-l border-border/60 px-3 text-sm whitespace-nowrap text-muted-foreground hover:bg-accent/30 hover:text-foreground data-[state=open]:bg-accent/30 data-[state=open]:text-foreground"
        >
          <TextQuoteIcon className="size-3.5" /> Aus Vorlage <ChevronDownIcon className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-96 w-96 overflow-y-auto">
        {usual.length > 0 && (
          <>
            <DropdownMenuLabel className="flex items-center gap-2">
              <span className="truncate">Üblich für {playbook?.art}</span>
              {missing.length > 0 && (
                <button
                  type="button"
                  onClick={() => add(missing)}
                  className="ml-auto flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-primary hover:bg-accent"
                >
                  <PlusIcon className="size-3" /> Fehlende ({missing.length})
                </button>
              )}
            </DropdownMenuLabel>
            {usual.map(item)}
            {others.length > 0 && <DropdownMenuSeparator />}
          </>
        )}
        {!snippets.length && <DropdownMenuLabel>Noch keine Vorlagen</DropdownMenuLabel>}
        {others.map(item)}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => openPage(POLICE_FILES_BASE.slice(1))}>
          <Settings2Icon /> Vorlagen bearbeiten…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
