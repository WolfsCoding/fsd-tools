import { useId, useState } from "react"
import { CalculatorIcon, CheckIcon, ChevronDownIcon, DicesIcon, GripVerticalIcon, InfoIcon, PlusIcon, TextQuoteIcon, TriangleAlertIcon } from "lucide-react"
import { cn } from "cn"
import { Hint } from "@/components/hint"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Combobox } from "@/components/combobox"
import type { Step } from "@/components/step-dialog"
import { AddRow, BOX, CELL_COMBOBOX, CELL_INPUT, DiceButton, END, FULL, Labeled, LEAD, RangeInput, RemoveCell, SHORT } from "@/features/case-files/doc-form"
import { move, useReorder } from "@/components/use-reorder"
import { formatNumber, parseNumber, rangeLabel, withUnit, type Range } from "@/features/case-files/range"
import { tableRows, type CustomFieldProps } from "@/features/case-files/templates"
import type { Row, Value } from "@/features/case-files/types"
import { formatFine, OFFENSE_BY_ID } from "@/features/law-book/offenses"
import { AsservateList, type Draft, type ListColumn } from "./asservate-list"
import { CONCLUSION, SUBSTANCE_BY_KEY, SUBSTANCES, type FindingPreset, type Substance } from "./substances"
import {
  agentsOf,
  autoSample,
  canRoll,
  FINDING_TITLES,
  findingsOf,
  findingPresets,
  hasAnalysis,
  missingFor,
  newSubstanceRow,
  outOfRange,
  productName,
  resultInfo,
  resultOf,
  rollSubstance,
  storeAgents,
  substanceOf,
  TOX_RESULTS,
  totals,
  storeFindings,
  type Finding,
  type FindingResult,
  type Total,
  withAmount,
  withProduct,
  withResult,
  SUBSTANCES_KEY,
} from "./tox"

/** A toggle chip, e.g. for a cutting agent. */
function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-1 text-left text-xs font-medium transition-colors",
        on
          ? "border-primary/40 bg-primary/15 text-foreground hover:bg-primary/25"
          : "border-dashed text-muted-foreground hover:border-solid hover:bg-accent/60 hover:text-foreground",
      )}
    >
      {on ? <CheckIcon className="size-3 shrink-0" /> : <PlusIcon className="size-3 shrink-0" />}
      {children}
    </button>
  )
}

/** The catalog as the options of the product. */
const SUBSTANCE_OPTIONS = SUBSTANCES.map((s) => s.name)

/**
 * The evidence of the analysis as a list; each is added and edited in a dialog: the product
 * with amount, sample, unit and a note, then the result of the test, then (when positive) the
 * full analysis. Only found ones (see `missingFor`) go into the analysis, numbered in this order.
 */
export function SubstancesInput({ values, onChange, onUpdate }: CustomFieldProps) {
  return (
    <>
      <AsservateList
        noun="Asservat"
        rows={tableRows(values[SUBSTANCES_KEY])}
        onChange={(rows) => onChange(SUBSTANCES_KEY, rows)}
        onUpdate={(fn) => onUpdate(SUBSTANCES_KEY, (v) => fn(tableRows(v)))}
        newRow={() => newSubstanceRow()}
        columns={COLUMNS}
        title={productName}
        left={(row) => !!missingFor(row)}
        steps={substanceSteps}
      />
      <Totals value={values[SUBSTANCES_KEY]} />
    </>
  )
}

const POSSESSION = OFFENSE_BY_ID.get("to-14-3")

const amountLabel = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 2 })

/** The fine of the possession of a total, per unit; none for what isn't a narcotic. */
function fineOf(total: Total) {
  const fine = POSSESSION?.fine
  return fine && total.narcotic ? { min: fine.min * total.amount, max: fine.max * total.amount } : undefined
}

/**
 * What was found in all, by substance and unit, with the fine its possession carries per the
 * law book. Only a help for the officer: it isn't part of the analysis.
 */
function Totals({ value }: { value: Value | undefined }) {
  const all = totals(value)
  if (!all.length) return null
  const fines = all.flatMap((t) => fineOf(t) ?? [])
  const sum = fines.length > 1 && { min: fines.reduce((n, f) => n + f.min, 0), max: fines.reduce((n, f) => n + f.max, 0) }
  const cell = "border-b border-border/60 px-3 py-2"

  return (
    <div className={cn(FULL, BOX, "grid")}>
      <div className="flex items-baseline gap-2 border-b border-border/60 bg-muted/50 px-3 py-2">
        <span className="text-sm font-medium">Gesamtmengen</span>
        <span className="text-xs text-muted-foreground">Nur positive Ergebnisse. Nicht Teil der Analyse.</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className={cn(cell, "font-medium")}>Substanz</th>
              <th className={cn(cell, "text-right font-medium")}>Asservate</th>
              <th className={cn(cell, "text-right font-medium")}>Menge</th>
              {POSSESSION && <th className={cn(cell, "text-right font-medium whitespace-nowrap")}>Strafrahmen {POSSESSION.ref}</th>}
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {all.map((t) => {
              const fine = fineOf(t)
              return (
                <tr key={`${t.name}\n${t.unit}`}>
                  <td className={cell}>{t.name}</td>
                  <td className={cn(cell, "text-right")}>{t.rows}</td>
                  <td className={cn(cell, "text-right whitespace-nowrap")}>
                    {amountLabel(t.amount)} {t.unit}
                  </td>
                  {POSSESSION && (
                    <td className={cn(cell, "text-right whitespace-nowrap")}>
                      {fine ? (
                        formatFine(fine)
                      ) : (
                        <Hint label={`Kein Betäubungsmittel nach ${POSSESSION.ref}`}>
                          <span className="text-muted-foreground">--</span>
                        </Hint>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
            {sum && (
              <tr className="font-medium">
                <td className={cell} colSpan={3}>
                  Gesamt
                </td>
                <td className={cn(cell, "text-right whitespace-nowrap")}>{formatFine(sum)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="px-3 py-2 text-xs text-muted-foreground">
        {POSSESSION?.fine && `${formatFine(POSSESSION.fine)} je Einheit, mal der Menge. Die Strafe legt der Officer fest.`}
      </p>
    </div>
  )
}

/** The table of the form, like the overview of the analysis, plus the result (or why the row isn't part of it). */
const COLUMNS: ListColumn[] = [
  { label: "Produkt", cell: productName, wide: true },
  { label: "Menge", cell: (row) => row.menge?.trim() },
  { label: "Stichprobe (10 %)", cell: (row) => row.stichprobe?.trim() },
  { label: "Einheit", cell: (row) => row.einheit?.trim() },
  { label: "Anmerkung", cell: (row) => row.anmerkung?.trim(), wide: true },
  {
    label: "Ergebnis",
    cell: (row) => {
      const missing = missingFor(row)
      if (missing)
        return (
          <Hint label="Kommt so nicht in die Analyse">
            <span className="text-xs text-amber-400">{missing}</span>
          </Hint>
        )
      const result = resultInfo(row)
      const odd = outOfRange(row)
      return (
        <span className="inline-flex items-center gap-1.5">
          <span className={cn("font-medium", result.className)}>{result.label}</span>
          {odd.length > 0 && (
            <Hint label={`Außerhalb des Typischen: ${odd.map((p) => `${p.label} ${withUnit(row[p.key], p.range.unit)} (${rangeLabel(p.range)})`).join(", ")}`}>
              <span className="flex text-amber-400">
                <TriangleAlertIcon aria-label="Wert außerhalb des Typischen" className="size-3.5" />
              </span>
            </Hint>
          )}
        </span>
      )
    },
  },
]

function substanceSteps(draft: Draft): Step[] {
  const steps: Step[] = [
    {
      title: "Asservat",
      description: "Was gefunden wurde und wie viel. Erst mit einer Menge über 0 kommt es in die Analyse.",
      content: <ItemStep {...draft} />,
    },
    {
      title: "Ergebnis",
      description: "Was der Test ergeben hat. Nur ein positives braucht die vollständige Analyse.",
      content: <ResultStep {...draft} />,
    },
  ]
  const result = resultOf(draft.row)
  if (result !== "positiv")
    steps.push({
      title: "Schlussfolgerung",
      description: "Was stattdessen festgestellt wurde. Jeder Punkt kommt mit seinem Titel in die Analyse.",
      content: <FindingStep row={draft.row} set={draft.set} result={result} />,
    })
  else if (hasAnalysis(draft.row))
    steps.push({
      title: "Analyse",
      description: "Anteile und Streckmittel; leer bleibt der typische Bereich als Platzhalter stehen.",
      content: <AnalysisStep {...draft} />,
    })
  return steps
}

function ItemStep({ row, set, replace }: Draft) {
  const id = useId()
  const s = SUBSTANCE_BY_KEY.get(row.substance)
  const sample = autoSample(row)
  const unknown = !s && !!row.produkt?.trim()
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-4">
      <Labeled
        id={`${id}-produkt`}
        label="Substanz"
        hint={unknown ? "Nicht in der Liste: geht nur mit einem negativen oder unklaren Ergebnis." : undefined}
        className={FULL}
      >
        <Combobox
          id={`${id}-produkt`}
          value={row.produkt ?? s?.name ?? ""}
          onChange={(v) => replace((r) => withProduct(r, v))}
          options={SUBSTANCE_OPTIONS}
          all
          placeholder="Substanz wählen oder beschreiben, z. B. weißes Pulver…"
        />
      </Labeled>
      <Labeled id={`${id}-menge`} label="Menge" className={SHORT}>
        <Input id={`${id}-menge`} value={row.menge ?? ""} onChange={(e) => replace((r) => withAmount(r, e.target.value))}
          placeholder="0" inputMode="numeric" />
      </Labeled>
      <Labeled id={`${id}-einheit`} label="Einheit" className={SHORT}>
        <Combobox
          id={`${id}-einheit`}
          value={row.einheit ?? ""}
          onChange={(v) => set({ einheit: v })}
          options={s?.units ?? []}
          placeholder={s?.units.join("/") ?? "z. B. Gramm"}
        />
      </Labeled>
      <Labeled id={`${id}-stichprobe`} label="Stichprobe (10 %)" className={SHORT}>
        <div className="relative">
          <Input
            id={`${id}-stichprobe`}
            value={row.stichprobe ?? ""}
            onChange={(e) => set({ stichprobe: e.target.value })}
            placeholder={sample || "x"}
            inputMode="numeric"
            className="pr-10"
          />
          {/* Wrapped so the tooltip also shows while the button is disabled. */}
          <Hint label={sample ? `10 % der Menge: ${sample}` : "Erst die Menge eintragen"}>
            <span className="absolute inset-y-1 right-1 flex">
              <button
                type="button"
                onClick={() => set({ stichprobe: sample })}
                disabled={!sample}
                aria-label="10 % der Menge berechnen"
                className="flex w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
              >
                <CalculatorIcon className="size-3.5" />
              </button>
            </span>
          </Hint>
        </div>
      </Labeled>
      <Labeled id={`${id}-anmerkung`} label="Anmerkung" className={FULL}>
        <Input id={`${id}-anmerkung`} value={row.anmerkung ?? ""} onChange={(e) => set({ anmerkung: e.target.value })} placeholder="--" />
      </Labeled>
    </div>
  )
}

function ResultStep({ row, replace }: Draft) {
  const result = resultOf(row)
  const known = SUBSTANCE_BY_KEY.has(row.substance)
  return (
    <div className="grid gap-4">
      <div role="radiogroup" aria-label="Ergebnis" className="grid gap-2 sm:grid-cols-3">
        {TOX_RESULTS.map((r) => (
          <button
            key={r.value}
            type="button"
            role="radio"
            aria-checked={result === r.value}
            onClick={() => replace((now) => withResult(now, r.value))}
            disabled={r.value === "positiv" && !known}
            className={cn(
              "grid gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
              result === r.value ? "border-primary/50 bg-primary/10" : "hover:bg-accent/40",
              "disabled:pointer-events-none disabled:opacity-40",
            )}
          >
            <span className={cn("text-sm font-semibold", r.className)}>{r.label}</span>
            <span className="text-xs text-muted-foreground">
              {r.value === "positiv" && !known ? "Nur mit einer Substanz aus der Liste" : r.text}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** What was found instead of a positive result, as titled points; the result's and substance's are offered. */
function FindingStep({ row, set, result }: Pick<Draft, "row" | "set"> & { result: FindingResult }) {
  const stored = findingsOf(row)
  // An empty point stands in while there are none, so the table has a row to type into.
  const findings = stored.length ? stored : [newFinding()]
  const update = (next: Finding[]) => set({ befund: storeFindings(next) })
  const change = (i: number, patch: Partial<Finding>) => update(findings.map((f, j) => (j === i ? { ...f, ...patch } : f)))
  const reorder = useReorder((from, to) => update(move(findings, from, to)))
  const picked = (text: string) => stored.some((f) => f.text === text)
  const toggle = ([titel, text]: FindingPreset) =>
    update(
      picked(text)
        ? stored.filter((f) => f.text !== text)
        : [...stored.filter((f) => f.text.trim() || f.titel !== CONCLUSION), { ...newFinding(), titel, text }],
    )

  return (
    <div className={cn(BOX, "divide-y divide-border/60")}>
      <div className="flex h-9 items-stretch bg-muted/50 text-xs font-medium text-muted-foreground">
        <span className="w-10 shrink-0 border-r border-border/60" />
        <span className="flex w-52 shrink-0 items-center border-r border-border/60 px-3">Titel</span>
        <span className="flex flex-1 items-center px-3">Text</span>
        <span className={END} />
      </div>
      <ul className="divide-y divide-border/60">
        {findings.map((f, i) => (
          <li key={f.id} {...reorder.row(i)} className={cn("group flex items-stretch focus-within:bg-accent/20", reorder.rowClass(i))}>
            <span
              {...reorder.handle(i)}
              className={cn(LEAD, "cursor-grab text-muted-foreground group-focus-within:bg-accent/60 active:cursor-grabbing")}
            >
              <GripVerticalIcon className="size-3.5 group-focus-within:text-foreground" />
            </span>
            <div className="w-52 shrink-0 border-r border-border/60">
              <Combobox
                value={f.titel}
                onChange={(v) => change(i, { titel: v })}
                options={FINDING_TITLES}
                all
                placeholder={CONCLUSION}
                aria-label={`Punkt ${i + 1}, Titel`}
                className={cn(CELL_COMBOBOX, "font-medium text-primary")}
              />
            </div>
            {/* Grows with its text; a point stays one paragraph, so Enter adds no line. */}
            <textarea
              rows={1}
              value={f.text}
              onChange={(e) => change(i, { text: e.target.value.replace(/\n/g, " ") })}
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
              placeholder={i === 0 ? "Was stattdessen festgestellt wurde" : undefined}
              aria-label={`Punkt ${i + 1}, Text`}
              className={cn(CELL_INPUT, "field-sizing-content h-auto min-h-10 flex-1 resize-none py-2.5 text-sm")}
            />
            <RemoveCell label={`Punkt ${i + 1} entfernen`} onRemove={() => update(findings.filter((_, j) => j !== i))} />
          </li>
        ))}
      </ul>
      <div className="flex">
        <AddRow label="Punkt hinzufügen" onClick={() => update([...findings, newFinding()])} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex shrink-0 items-center gap-1.5 border-l border-border/60 px-3 text-sm whitespace-nowrap text-muted-foreground hover:bg-accent/30 hover:text-foreground data-[state=open]:bg-accent/30 data-[state=open]:text-foreground"
            >
              <TextQuoteIcon className="size-3.5" /> Aus Vorlage <ChevronDownIcon className="size-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-96">
            {findingPresets(row, result).map((preset) => (
              <DropdownMenuCheckboxItem
                key={preset[1]}
                checked={picked(preset[1])}
                // Stays open, so several can be picked in a row.
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={() => toggle(preset)}
                className="grid gap-0.5"
              >
                <span className="text-xs font-medium text-primary">{preset[0]}</span>
                <span>{preset[1]}</span>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

const newFinding = (): Finding => ({ id: crypto.randomUUID(), titel: CONCLUSION, text: "" })

/** Whether the substance has shares or cutting agents to enter; otherwise its results are fixed text. */
const needsInput = (s: Substance) => s.params.length > 0 || !!s.agents

/** The shares and cutting agents of a positive result, and the dice. */
function AnalysisStep({ row, set, replace }: Draft) {
  const id = useId()
  const s = substanceOf(row)

  if (!needsInput(s))
    return <p className="text-sm text-muted-foreground">Keine Eingabe nötig: für {s.name} stehen die Ergebnisse fest.</p>

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">Analyseergebnisse ({s.heading})</span>
        {canRoll(s) && (
          <Button variant="outline" size="xs" onClick={() => replace(rollSubstance)}>
            <DicesIcon /> Würfeln
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-4">
        {s.params.map((p) => {
          const odd = outOfRange(row).includes(p)
          return (
            <Labeled key={p.key} id={`${id}-${p.key}`} label={p.label} className={SHORT}>
              <RangeInput id={`${id}-${p.key}`} label={p.label} value={row[p.key] ?? ""} range={p.range} onChange={(v) => set({ [p.key]: v })} />
              <ShareSlider label={p.label} value={row[p.key] ?? ""} range={p.range} onChange={(v) => set({ [p.key]: v })} />
              <RangeMessage range={p.range} odd={odd} />
            </Labeled>
          )
        })}
        {s.agents && <AgentsInput row={row} onChange={set} />}
        {s.params.some((p) => p.range.unit === "%") && <Composition row={row} />}
      </div>
    </div>
  )
}

/**
 * The share as a slider, on a scale reaching past the typical range (marked on the track) on
 * both sides. Without a value the handle waits in the middle of the typical range.
 */
function ShareSlider({ label, value, range, onChange }: { label: string; value: string; range: Range; onChange: (value: string) => void }) {
  const n = parseNumber(value)
  const span = range.max - range.min
  const lo = Math.max(0, range.min - span / 2)
  const hi = range.unit === "%" ? Math.min(100, range.max + span / 2) : range.max + span / 2
  const at = (x: number) => ((Math.min(Math.max(x, lo), hi) - lo) / (hi - lo)) * 100
  return (
    <Slider
      aria-label={label}
      min={lo}
      max={hi}
      step={10 ** -range.decimals}
      value={[Number.isNaN(n) ? (range.min + range.max) / 2 : Math.min(Math.max(n, lo), hi)]}
      onValueChange={([v]) => onChange(formatNumber(v, range.decimals))}
      className="mt-1"
    >
      <div className="absolute inset-y-0 bg-primary/25" style={{ left: `${at(range.min)}%`, width: `${at(range.max) - at(range.min)}%` }} />
    </Slider>
  )
}

/** The typical range under a share; a warning while the value lies outside it. */
function RangeMessage({ range, odd }: { range: Range; odd: boolean }) {
  const Icon = odd ? TriangleAlertIcon : InfoIcon
  return (
    <div role={odd ? "alert" : undefined} className="flex items-start gap-2.5 rounded-lg border bg-muted/30 px-3 py-2">
      <Icon className={cn("mt-0.5 size-4 shrink-0", odd ? "text-amber-400" : "text-muted-foreground")} />
      <div className="grid gap-0.5">
        <p className="text-sm font-medium">{odd ? "Außerhalb des Typischen" : `Typisch ${rangeLabel(range)}`}</p>
        <p className="text-xs text-muted-foreground">
          {odd ? `Üblich sind ${rangeLabel(range)}. Bitte den Wert prüfen.` : "Der markierte Bereich auf dem Regler."}
        </p>
      </div>
    </div>
  )
}

const PART_COLORS = ["bg-chart-1", "bg-chart-2", "bg-chart-4", "bg-chart-5"]

/**
 * The entered shares and what is left to 100 %, as one bar. Shown for every substance with a
 * share; grey while none is entered.
 */
function Composition({ row }: { row: Row }) {
  const s = substanceOf(row)
  const shares = s.params.filter((p) => p.range.unit === "%")
  const values = shares.map((p) => parseNumber(row[p.key] ?? ""))
  const entered = values.filter((n) => n >= 0 && n <= 100)
  const empty = !entered.length
  const agents = agentsOf(row)
  const restLabel = s.rest ? `${s.agents?.label ?? "Wasser & Zusatzstoffe"}${agents.length ? `: ${agents.join(", ")}` : ""}` : "Übrige Bestandteile"
  // The rest is as exact as the most exact share entered.
  const restDecimals = Math.max(0, ...shares.filter((_, i) => values[i] >= 0).map((p) => p.range.decimals))
  const parts = [
    ...shares.map((p, i) => ({
      label: shares.length > 1 ? p.label : s.name,
      value: values[i],
      decimals: p.range.decimals,
      color: PART_COLORS[i % PART_COLORS.length],
    })),
    { label: restLabel, value: Math.max(0, 100 - entered.reduce((a, b) => a + b, 0)), decimals: restDecimals, color: "bg-chart-3" },
  ]
  return (
    <div className={cn(FULL, "grid gap-2")}>
      <span className="text-xs font-medium text-muted-foreground">Zusammensetzung</span>
      <div aria-hidden className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-muted">
        {!empty && parts.map((x) => x.value > 0 && <div key={x.label} className={x.color} style={{ flexGrow: x.value, minWidth: 4 }} />)}
      </div>
      <ul className={cn("grid gap-1 text-xs", empty && "text-muted-foreground")}>
        {parts.map((x) => {
          const shown = !empty && x.value >= 0
          return (
            <li key={x.label} className="flex items-center gap-2">
              <span className={cn("size-2 shrink-0 rounded-full", shown ? x.color : "bg-muted-foreground/40")} />
              <span className="min-w-0 flex-1 truncate">{x.label}</span>
              <span className="tabular-nums text-muted-foreground">{shown ? withUnit(formatNumber(x.value, x.decimals), "%") : "--"}</span>
            </li>
          )
        })}
      </ul>
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
