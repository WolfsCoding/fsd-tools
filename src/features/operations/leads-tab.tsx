import { Combobox, type ComboboxOption } from "@/components/combobox"
import { CELL_COMBOBOX } from "@/features/case-files/doc-form"
import { removedToast } from "@/lib/undo"
import { sameText } from "@/lib/text"
import { insertAt, updateAt } from "./rows"
import { SheetSection, SheetTable, type SheetColumn } from "./sheet"
import type { Lead, Operation } from "./types"

const AREAS = ["Co. Einsatzleitung", "Verhandlungsführung", "Co. Verhandlungsführung", "Absperrung", "Forensic Einsatzleitung"]

/** Who leads which area, picked from the officers of the units. */
export function LeadsTab({ operation, onChange }: { operation: Operation; onChange: (fn: (o: Operation) => Operation) => void }) {
  const leads = operation.leads ?? []
  const setLeads = (fn: (leads: Lead[]) => Lead[]) => onChange((o) => ({ ...o, leads: fn(o.leads ?? []) }))
  const setLead = (i: number, fn: (l: Lead) => Lead) => setLeads((ls) => updateAt(ls, i, fn))

  const crew = operation.patrols.flatMap((p) => p.beamte.filter((b) => b.trim()).map((b) => ({ name: b.trim(), unit: p.einheit.trim() })))
  const officers: ComboboxOption[] = crew.map((c) => ({ value: c.name, hint: c.unit || undefined }))
  const unitOf = (name: string) => crew.find((c) => sameText(c.name, name))?.unit ?? ""

  const columns: SheetColumn<Lead>[] = [
    {
      key: "bereich",
      label: "Bereichsleitung",
      cell: (l, i) => (
        <Combobox
          value={l.bereich}
          onChange={(v) => setLead(i, (x) => ({ ...x, bereich: v }))}
          options={AREAS}
          all
          aria-label={`Bereichsleitung (Zeile ${i + 1})`}
          className={CELL_COMBOBOX}
        />
      ),
    },
    {
      key: "beamter",
      label: "Beamter",
      wide: true,
      cell: (l, i) => (
        <Combobox
          value={l.beamter}
          onChange={(v) => setLead(i, (x) => ({ ...x, beamter: v }))}
          options={officers}
          aria-label={`Beamter (Zeile ${i + 1})`}
          className={CELL_COMBOBOX}
        />
      ),
    },
    {
      key: "einheit",
      label: "Einheit",
      cell: (l) => {
        const unit = unitOf(l.beamter)
        return <span className={unit ? "flex h-10 items-center px-3" : "flex h-10 items-center px-3 text-muted-foreground/60"}>{unit || "—"}</span>
      },
    },
  ]

  function remove(i: number) {
    const row = leads[i]
    setLeads((ls) => ls.filter((l) => l.id !== row.id))
    removedToast(row.bereich.trim() ? `„${row.bereich.trim()}“` : `Bereichsleitung ${i + 1}`, () => setLeads((ls) => insertAt(ls, i, row)))
  }

  return (
    <SheetSection title="Bereichsleitung">
      <SheetTable
        rows={leads}
        columns={columns}
        addLabel="Bereichsleitung hinzufügen"
        onAdd={() => setLeads((ls) => [...ls, { id: crypto.randomUUID(), bereich: "", beamter: "" }])}
        onRemove={remove}
      />
    </SheetSection>
  )
}
