import { useId, useState } from "react"
import { CalculatorIcon, CheckIcon, ChevronDownIcon, DicesIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { cn } from "cn"
import { Hint } from "@/components/hint"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Combobox } from "@/components/combobox"
import { AddRow, BOX, DiceButton, FULL, Labeled, RangeInput, SHORT } from "@/features/case-files/doc-form"
import { rangeLabel } from "@/features/case-files/range"
import { insertAt, tableRows, type CustomFieldProps, type UpdateValue } from "@/features/case-files/templates"
import { removedToast } from "@/lib/undo"
import type { Row, Value } from "@/features/case-files/types"
import { SUBSTANCE_BY_KEY, SUBSTANCES, type Substance } from "./substances"
import {
  agentsOf,
  autoSample,
  canRoll,
  isFound,
  newSubstanceRow,
  restOf,
  rollSubstance,
  storeAgents,
  withProduct,
  SUBSTANCES_KEY,
  substanceOf,
} from "./tox"

/** A toggle chip, e.g. for a cutting agent. */
function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors",
        on
          ? "border-primary/40 bg-primary/15 text-foreground hover:bg-primary/25"
          : "border-dashed text-muted-foreground hover:border-solid hover:bg-accent/60 hover:text-foreground",
      )}
    >
      {on ? <CheckIcon className="size-3" /> : <PlusIcon className="size-3" />}
      {children}
    </button>
  )
}

/** Every row of the table (also those without a substance yet) and what changes them; both sections edit the same rows. */
function useSubstances(values: Record<string, Value>, onChange: (key: string, value: Value) => void, onUpdate: UpdateValue) {
  const rows = tableRows(values[SUBSTANCES_KEY])
  const set = (next: Row[]) => onChange(SUBSTANCES_KEY, next)
  return {
    rows,
    set,
    /** Removes row `id`; the toast puts it back where it was, among the rows as they are by then. */
    remove: (id: string, label: string) => {
      const index = rows.findIndex((r) => r.id === id)
      const row = rows[index]
      set(rows.filter((r) => r.id !== id))
      removedToast(label, () =>
        onUpdate(SUBSTANCES_KEY, (v) => {
          const now = tableRows(v)
          return now.some((r) => r.id === id) ? now : insertAt(now, index, row)
        }),
      )
    },
    change: (id: string, patch: Partial<Row>) => set(rows.map((r) => (r.id === id ? ({ ...r, ...patch } as Row) : r))),
    /** Replaces the row `id` with what `fn` makes of it. */
    replace: (id: string, fn: (row: Row) => Row) => set(rows.map((r) => (r.id === id ? fn(r) : r))),
  }
}

/** The catalog as the options of the substance cell. */
const SUBSTANCE_OPTIONS = SUBSTANCES.map((s) => s.name)

/** A plain input that fills its table cell. */
const CELL = "h-10 w-full min-w-0 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:bg-accent/30"
/** A combobox that fills its table cell, without a border of its own. */
const CELL_COMBOBOX =
  "h-10 rounded-none border-0 bg-transparent px-3 shadow-none placeholder:text-muted-foreground/60 focus-visible:bg-accent/30 focus-visible:ring-0 dark:bg-transparent"

/**
 * The evidence as rows added by hand: the substance picked from the catalog, then amount,
 * sample, unit and a note. Only rows with an amount above 0 are found and go into the
 * analysis, numbered in this order. The sample is 10 % of the amount, filled in with its button.
 * The arrow at the end of a row opens its results (shares, cutting agents) below it.
 */
export function SubstancesInput({ values, onChange, onUpdate }: CustomFieldProps) {
  const { rows, set, change, replace, remove } = useSubstances(values, onChange, onUpdate)
  const found = rows.filter(isFound)
  // Rows whose results are shown below them; all start closed.
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })

  return (
    <div className={cn(FULL, BOX, "overflow-x-auto")}>
      {/* Separate borders, so the number column lines up exactly with the add button below. */}
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr className="h-9 bg-muted/50 text-left text-xs text-muted-foreground *:border-b *:border-border/60">
            <th className="w-10 min-w-10 border-r border-border/60 text-center font-medium">#</th>
            <th className="min-w-44 border-r border-border/60 px-3 font-medium">Produkt</th>
            <th className="min-w-24 border-r border-border/60 px-3 font-medium">Menge</th>
            <th className="min-w-36 border-r border-border/60 p-0 font-medium">
              <span className="flex items-center gap-2 pr-1 pl-3">
                <span className="flex-1 whitespace-nowrap">Stichprobe (10 %)</span>
                {found.length > 0 && (
                  <Hint label="10 % für alle mit Menge berechnen">
                    <button
                      type="button"
                      onClick={() => set(rows.map((r) => (isFound(r) ? { ...r, stichprobe: autoSample(r) } : r)))}
                      aria-label="10 % für alle mit Menge berechnen"
                      className="flex size-7 items-center justify-center rounded-md hover:bg-accent hover:text-foreground"
                    >
                      <CalculatorIcon className="size-3.5" />
                    </button>
                  </Hint>
                )}
              </span>
            </th>
            <th className="min-w-28 border-r border-border/60 px-3 font-medium">Einheit</th>
            <th className="min-w-48 px-3 font-medium">Anmerkung</th>
            <th className="w-10 min-w-10 border-l border-border/60">
              <span className="sr-only">Ergebnisse</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const s = SUBSTANCE_BY_KEY.get(row.substance)
            const on = isFound(row)
            const sample = on ? autoSample(row) : ""
            const name = s?.name ?? `Zeile ${i + 1}`
            const expanded = open.has(row.id)
            return [
              <tr
                key={row.id}
                className={cn("focus-within:bg-accent/20 *:border-b *:border-border/60", expanded && "bg-accent/10")}
              >
                <td className="border-r border-border/60 bg-muted/50 text-center text-xs font-semibold">{i + 1}</td>
                <td className="border-r border-border/60 p-0">
                  <Combobox
                    value={row.produkt ?? s?.name ?? ""}
                    onChange={(v) => replace(row.id, (r) => withProduct(r, v))}
                    options={SUBSTANCE_OPTIONS}
                    all
                    placeholder="Substanz wählen…"
                    aria-label={`Zeile ${i + 1}: Produkt`}
                    className={cn(CELL_COMBOBOX, s && "font-medium", !s && row.produkt?.trim() && "text-red-400")}
                  />
                </td>
                <td className="border-r border-border/60 p-0">
                  <input
                    value={row.menge ?? ""}
                    onChange={(e) => change(row.id, { menge: e.target.value })}
                    placeholder="0"
                    inputMode="numeric"
                    aria-label={`${name}: Menge`}
                    className={CELL}
                  />
                </td>
                <td className="border-r border-border/60 p-0">
                  <span className="flex items-center">
                    <input
                      value={row.stichprobe ?? ""}
                      onChange={(e) => change(row.id, { stichprobe: e.target.value })}
                      placeholder={on ? "x" : undefined}
                      inputMode="numeric"
                      aria-label={`${name}: Stichprobe`}
                      className={CELL}
                    />
                    {/* Wrapped so the tooltip also shows while the button is disabled. */}
                    <Hint label={sample ? `10 % der Menge: ${sample}` : "Erst die Menge eintragen"}>
                      <span className="mr-1 flex shrink-0">
                        <button
                          type="button"
                          onClick={() => change(row.id, { stichprobe: sample })}
                          disabled={!sample}
                          aria-label={`${name}: 10 % berechnen`}
                          className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                        >
                          <CalculatorIcon className="size-3.5" />
                        </button>
                      </span>
                    </Hint>
                  </span>
                </td>
                <td className="border-r border-border/60 p-0">
                  <Combobox
                    value={row.einheit ?? ""}
                    onChange={(v) => change(row.id, { einheit: v })}
                    options={s?.units ?? []}
                    placeholder={s?.units.join("/") ?? "---"}
                    aria-label={`${name}: Einheit`}
                    className={CELL_COMBOBOX}
                  />
                </td>
                <td className="p-0">
                  <input
                    value={row.anmerkung ?? ""}
                    onChange={(e) => change(row.id, { anmerkung: e.target.value })}
                    placeholder="--"
                    aria-label={`${name}: Anmerkung`}
                    className={CELL}
                  />
                </td>
                <td className="border-l border-border/60 p-0">
                  <Hint label={expanded ? "Ergebnisse ausblenden" : "Ergebnisse anzeigen"}>
                    <button
                      type="button"
                      onClick={() => toggle(row.id)}
                      aria-expanded={expanded}
                      aria-label={`${name}: Ergebnisse`}
                      className="mx-auto flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <ChevronDownIcon className={cn("size-4 transition-transform", expanded && "rotate-180")} />
                    </button>
                  </Hint>
                </td>
              </tr>,
              // Always there (empty while closed), so the details can slide open and closed.
              <tr key={`${row.id}-details`}>
                <td colSpan={7} className="p-0">
                  <Collapsible open={expanded}>
                    <CollapsibleContent>
                      <div className="border-b border-border/60">
                        <RowDetails
                          row={row}
                          number={on ? found.indexOf(row) + 1 : undefined}
                          onChange={(patch) => change(row.id, patch)}
                          onRoll={() => replace(row.id, rollSubstance)}
                          onRemove={() => remove(row.id, name)}
                        />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </td>
              </tr>,
            ]
          })}
        </tbody>
      </table>
      <AddRow label="Substanz hinzufügen" onClick={() => set([...rows, newSubstanceRow()])} className="sticky left-0" />
    </div>
  )
}

/** Whether the substance has shares or cutting agents to enter; otherwise its results are fixed text. */
const needsInput = (s: Substance) => s.params.length > 0 || !!s.agents

/**
 * A row's results, opened below it with the arrow: its shares and cutting agents (or that
 * nothing is needed), the dice, and removing the row.
 */
function RowDetails({
  row,
  number,
  onChange,
  onRoll,
  onRemove,
}: {
  row: Row
  /** Its section in the case file; none while the row isn't part of the analysis. */
  number?: number
  onChange: (patch: Partial<Row>) => void
  onRoll: () => void
  onRemove: () => void
}) {
  const id = useId()
  const s = SUBSTANCE_BY_KEY.get(row.substance)
  const restParam = s?.params.find((p) => p.key === s.rest)

  return (
    <div className="grid gap-4 border-l-2 border-primary/40 bg-background/40 p-4">
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {s ? `${number ? `#${number} ` : ""}Analyseergebnisse (${s.heading})` : "Analyseergebnisse"}
        </span>
        {s && canRoll(s) && (
          <Button variant="outline" size="xs" onClick={onRoll}>
            <DicesIcon /> Würfeln
          </Button>
        )}
        <Button variant="ghost" size="xs" onClick={onRemove} className="text-muted-foreground hover:text-destructive">
          <Trash2Icon /> Zeile entfernen
        </Button>
      </div>

      {s && !number && (
        <p className="text-xs text-muted-foreground">Kommt erst mit einer Menge über 0 in die Analyse.</p>
      )}

      {!s ? (
        <p className="text-sm text-muted-foreground">Erst eine Substanz wählen; dann kommen hier ihre Ergebnisse hin.</p>
      ) : !needsInput(s) ? (
        <p className="text-sm text-muted-foreground">
          Keine Eingabe nötig: für {s.name} stehen die Ergebnisse fest.
        </p>
      ) : (
        <div className="flex flex-wrap gap-x-3 gap-y-4">
          {s.params.map((p) => (
            <Labeled key={p.key} id={`${id}-${p.key}`} label={p.label} hint={`Typisch ${rangeLabel(p.range)}`} className={SHORT}>
              <RangeInput
                id={`${id}-${p.key}`}
                label={p.label}
                value={row[p.key] ?? ""}
                range={p.range}
                onChange={(v) => onChange({ [p.key]: v })}
              />
            </Labeled>
          ))}
          {restParam && (
            <Labeled
              id={`${id}-rest`}
              label={`Rest (${s.agents?.label ?? "Wasser & Zusatzstoffe"})`}
              hint={`100 % − ${restParam.label}`}
              className={SHORT}
            >
              <Input id={`${id}-rest`} value={restOf(row)} readOnly placeholder="---" tabIndex={-1} className="bg-muted/40" />
            </Labeled>
          )}

          {s.agents && <AgentsInput row={row} onChange={onChange} />}
        </div>
      )}
    </div>
  )
}

/** The agents found: the substance's typical ones as chips, own ones can be added. */
function AgentsInput({ row, onChange }: { row: Row; onChange: (patch: Partial<Row>) => void }) {
  const s = substanceOf(row)
  const agents = s.agents!
  const picked = agentsOf(row)
  const own = picked.filter((a) => !agents.options.includes(a))
  const [draft, setDraft] = useState("")
  const set = (next: string[]) => onChange({ agents: storeAgents(next) })
  // Picked ones keep the order of the options, own ones follow.
  const toggle = (a: string) =>
    set(picked.includes(a) ? picked.filter((x) => x !== a) : [...agents.options, ...own].filter((x) => x === a || picked.includes(x)))

  function addOwn() {
    const a = draft.trim()
    if (a && !picked.includes(a)) set([...picked, a])
    setDraft("")
  }

  return (
    <Labeled label={agents.label} className={FULL}>
      <div className="flex flex-wrap items-center gap-1.5">
        {[...agents.options, ...own].map((a) => (
          <Chip key={a} on={picked.includes(a)} onClick={() => toggle(a)}>
            {a}
          </Chip>
        ))}
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
          placeholder="Weitere…"
          aria-label={`${agents.label}: weiterer Eintrag`}
          className="h-7 w-28 rounded-full border border-dashed bg-transparent px-2.5 text-xs outline-none placeholder:text-muted-foreground focus:border-solid focus:border-ring"
        />
        {agents.random && (
          <DiceButton
            label={`${agents.label} würfeln`}
            onClick={() => onChange({ agents: rollSubstance(row).agents })}
            className="h-7 rounded-full hover:bg-accent/60"
          />
        )}
      </div>
    </Labeled>
  )
}
