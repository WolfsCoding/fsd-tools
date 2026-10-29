import { useState } from "react"
import { SlidersHorizontalIcon } from "lucide-react"
import { cn } from "cn"
import { Hint } from "@/components/hint"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogPanel, DialogTitle } from "@/components/ui/dialog"
import { useDnaEntries } from "@/features/dna-db/use-dna-entries"
import { Combobox } from "@/components/combobox"
import { DnaPicker } from "./dna-picker"
import { removedToast } from "@/lib/undo"
import { AddRow, BOX, LEAD, RemoveCell } from "./doc-form"
import { insertAt } from "./templates"
import {
  dbOptions,
  entryRef,
  findEntry,
  newDbData,
  storeTraces,
  TRACE_LABELS,
  traceSummary,
  tracesNoun,
  type Trace,
  type TraceKind,
} from "./traces"

const newTrace = (): Trace => ({ id: crypto.randomUUID(), dna: "", fa: "", name: "", ort: "" })

/** A combobox that fills its cell of a trace row, without a border of its own. */
const TRACE_INPUT =
  "h-10 rounded-none border-0 bg-transparent px-3 shadow-none placeholder:text-muted-foreground/60 focus-visible:bg-accent/30 focus-visible:ring-0 dark:bg-transparent"

/**
 * How many traces were found on an item ("3 Gefunden" / "Keine"), with a button that opens
 * the list: whose each was (from the DNA database, or unknown) and where it was. With several
 * `kinds`, each trace is the pair of one person, e.g. their DNA and fingerprints.
 */
export function TracesCell({
  label,
  title,
  traces,
  kinds,
  spots = [],
  onChange,
  onUpdate,
}: {
  label: string
  /** The item, e.g. "Waffe 2"; heads the dialog. */
  title: string
  traces: Trace[]
  kinds: TraceKind[]
  /** Typical places on the item, e.g. "Griff". */
  spots?: string[]
  /** The traces as a cell. */
  onChange: (value: string) => void
  /** Changes the traces as they are stored by then, e.g. from a toast. */
  onUpdate: (fn: (traces: Trace[]) => Trace[]) => void
}) {
  const { entries, addEntry, updateEntry } = useDnaEntries()
  const [draft, setDraft] = useState<Trace[]>()
  const noun = tracesNoun(kinds)

  function open() {
    setDraft(traces.length ? traces : [newTrace()])
  }

  /** Keeps the rows being edited (even empty ones) and stores the filled ones right away. */
  function update(next: Trace[]) {
    setDraft(next)
    onChange(storeTraces(next))
  }

  /** Removes trace `i`; the toast puts it back where it was, also once the list is closed. */
  function remove(i: number) {
    const trace = draft![i]
    update(draft!.filter((_, j) => j !== i))
    if (![trace.name, trace.dna, trace.fa, trace.ort].some((v) => v.trim())) return
    const restore = (list: Trace[]) => (list.some((t) => t.id === trace.id) ? list : insertAt(list, i, trace))
    removedToast(`Spur ${i + 1}`, () => {
      setDraft((prev) => prev && restore(prev))
      onUpdate(restore)
    })
  }

  /** IDs the DNA database doesn't know yet are added to it once the list is closed. */
  function close() {
    if (draft) {
      const { add, update } = newDbData(entries, draft, kinds)
      for (const { id, input } of update) updateEntry(id, input)
      for (const input of add) addEntry(input)
    }
    setDraft(undefined)
  }

  return (
    <>
      <div className="flex h-10 w-full items-center gap-2 pr-1 pl-3 text-sm">
        <span className={cn("flex-1 truncate", !traces.length && "text-muted-foreground/60")}>
          {traceSummary(traces.length)}
        </span>
        <Hint label={`${noun} verwalten`}>
          <button
            type="button"
            onClick={open}
            aria-label={`${label}: verwalten`}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <SlidersHorizontalIcon className="size-3.5" />
          </button>
        </Hint>
      </div>
      <Dialog open={draft !== undefined} onOpenChange={(o) => !o && close()}>
        <DialogContent className={kinds.length > 1 ? "sm:max-w-3xl" : "sm:max-w-2xl"}>
          <DialogPanel>
            <DialogHeader>
              <DialogTitle>
                {noun} · {title}
              </DialogTitle>
              <DialogDescription>
                Von wem sie {kinds.length > 1 ? "sind" : "ist"} und wo gefunden. Ohne Namen wird sie mit ihrer ID oder als
                „Unbekannt“ geschrieben; neue IDs kommen in die DNA-Datenbank.
              </DialogDescription>
            </DialogHeader>
            {draft && <TraceList kinds={kinds} spots={spots} traces={draft} onChange={update} onRemove={remove} />}
          </DialogPanel>
          <DialogFooter>
            <Button onClick={close}>Fertig</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function TraceList({
  kinds,
  spots,
  traces,
  onChange,
  onRemove,
}: {
  kinds: TraceKind[]
  spots: string[]
  traces: Trace[]
  onChange: (traces: Trace[]) => void
  onRemove: (index: number) => void
}) {
  const { entries } = useDnaEntries()
  const set = (i: number, patch: Partial<Trace>) => onChange(traces.map((t, j) => (j === i ? { ...t, ...patch } : t)))

  /** What the entry with this `field` fills in of trace `i`: its other fields still empty. */
  function known(i: number, field: "name" | TraceKind, value: string): Partial<Trace> {
    const entry = findEntry(entries, field, value)
    if (!entry) return {}
    const t = traces[i]
    const patch: Partial<Trace> = {}
    if (field !== "name" && !t.name.trim() && entry.name.trim()) patch.name = entry.name.trim()
    for (const k of kinds) if (k !== field && !t[k].trim() && entryRef(entry, k)) patch[k] = entryRef(entry, k)
    return patch
  }

  /** An ID from the database also fills in whose it is and their other IDs, while not entered. */
  function setId(i: number, kind: TraceKind, typed: string) {
    // IDs are always written in capitals, like in the database.
    const id = typed.toUpperCase()
    set(i, { ...known(i, kind, id), [kind]: id })
  }

  /** A name from the database also fills in their IDs, while none are entered. */
  function setName(i: number, name: string) {
    set(i, { ...known(i, "name", name), name })
  }

  return (
    <div className={cn(BOX, "divide-y divide-border/60")}>
      <div className="flex h-9 items-stretch bg-muted/50 text-xs font-medium text-muted-foreground">
        <span className="w-10 shrink-0 border-r border-border/60" />
        <span className="flex flex-1 items-center border-r border-border/60 px-3">Name</span>
        {kinds.map((k) => (
          <span key={k} className="flex flex-1 items-center border-r border-border/60 px-3">
            {TRACE_LABELS[k].id}
          </span>
        ))}
        <span className="flex flex-1 items-center px-3">Fundort</span>
        <span className="w-10 shrink-0 border-l border-border/60" />
      </div>
      {traces.map((t, i) => (
        <div key={t.id} className="flex items-stretch focus-within:bg-accent/20">
          <span className={cn(LEAD, "text-xs font-semibold text-muted-foreground")}>{i + 1}</span>
          <span className="min-w-0 flex-1 border-r border-border/60">
            <Combobox
              value={t.name}
              onChange={(v) => setName(i, v)}
              options={dbOptions(entries, "name")}
              placeholder="Unbekannt"
              aria-label={`Name (Spur ${i + 1})`}
              className={cn(TRACE_INPUT, "text-sm")}
            />
          </span>
          {kinds.map((k) => (
            <span key={k} className="min-w-0 flex-1 border-r border-border/60">
              <DnaPicker
                value={t[k]}
                kinds={[k]}
                show="id"
                onChange={(v) => setId(i, k, v)}
                placeholder="Aus DNA-DB oder neu anlegen"
                aria-label={`${TRACE_LABELS[k].id} (Spur ${i + 1})`}
                className={cn(TRACE_INPUT, "text-sm")}
              />
            </span>
          ))}
          <span className="min-w-0 flex-1">
            <Combobox
              value={t.ort}
              onChange={(v) => set(i, { ort: v })}
              options={spots}
              placeholder="Wo gefunden?"
              aria-label={`Fundort (Spur ${i + 1})`}
              className={cn(TRACE_INPUT, "text-sm")}
            />
          </span>
          <RemoveCell label={`Spur ${i + 1} entfernen`} onRemove={() => onRemove(i)} />
        </div>
      ))}
      <AddRow label="Spur hinzufügen" onClick={() => onChange([...traces, newTrace()])} />
    </div>
  )
}
