import { Combobox } from "@/components/combobox"
import { CELL_COMBOBOX, ChoiceCell, MARKS } from "@/features/case-files/doc-form"
import { removedToast } from "@/lib/undo"
import { insertAt, updateAt } from "./rows"
import { SheetSection, SheetTable, TextCell, type SheetColumn } from "./sheet"
import { toMark, type Operation, type Vehicle } from "./types"
import { newVehicle } from "./use-operations"

const STATUSES = ["Sichergestellt", "Beschlagnahmt", "Abgeschleppt", "Freigegeben"]

/** The vehicles involved, with whether they were searched. */
export function VehiclesTab({
  operation,
  onChange,
  people,
}: {
  operation: Operation
  onChange: (fn: (o: Operation) => Operation) => void
  /** Names of the people involved, offered as owners. */
  people: string[]
}) {
  const setVehicle = (i: number, fn: (v: Vehicle) => Vehicle) => onChange((o) => ({ ...o, vehicles: updateAt(o.vehicles, i, fn) }))
  const text = (key: "modell" | "kennzeichen", label: string, wide = false): SheetColumn<Vehicle> => ({
    key,
    label,
    wide,
    cell: (v, i) => (
      <TextCell value={v[key]} onChange={(x) => setVehicle(i, (y) => ({ ...y, [key]: x }))} label={`${label} (Zeile ${i + 1})`} />
    ),
  })

  const columns: SheetColumn<Vehicle>[] = [
    text("modell", "Modell"),
    text("kennzeichen", "Kennzeichen"),
    {
      key: "eigentuemer",
      label: "Eigentümer",
      cell: (v, i) => (
        <Combobox
          value={v.eigentuemer}
          onChange={(x) => setVehicle(i, (y) => ({ ...y, eigentuemer: x }))}
          options={people}
          aria-label={`Eigentümer (Zeile ${i + 1})`}
          className={CELL_COMBOBOX}
        />
      ),
    },
    {
      key: "status",
      label: "Status",
      cell: (v, i) => (
        <Combobox
          value={v.status}
          onChange={(x) => setVehicle(i, (y) => ({ ...y, status: x }))}
          options={STATUSES}
          aria-label={`Status (Zeile ${i + 1})`}
          className={CELL_COMBOBOX}
        />
      ),
    },
    {
      key: "durchsucht",
      label: "Durchsucht",
      narrow: true,
      cell: (v, i) => (
        <ChoiceCell
          label={`Durchsucht (Zeile ${i + 1})`}
          value={v.durchsucht}
          choices={MARKS}
          onChange={(x) => setVehicle(i, (y) => ({ ...y, durchsucht: toMark(x) }))}
        />
      ),
    },
    {
      key: "anmerkung",
      label: "Anmerkung",
      wide: true,
      cell: (v, i) => (
        <TextCell value={v.anmerkung} onChange={(x) => setVehicle(i, (y) => ({ ...y, anmerkung: x }))} label={`Anmerkung (Zeile ${i + 1})`} />
      ),
    },
  ]

  function remove(i: number) {
    const row = operation.vehicles[i]
    onChange((o) => ({ ...o, vehicles: o.vehicles.filter((v) => v.id !== row.id) }))
    removedToast(row.kennzeichen.trim() ? `„${row.kennzeichen.trim()}“` : `Fahrzeug ${i + 1}`, () =>
      onChange((o) => ({ ...o, vehicles: insertAt(o.vehicles, i, row) })),
    )
  }

  return (
    <SheetSection title="Beteiligte Fahrzeuge" description="Fahrzeuge, die am Einsatz beteiligt sind.">
      <SheetTable
        rows={operation.vehicles}
        columns={columns}
        addLabel="Fahrzeug hinzufügen"
        onAdd={() => onChange((o) => ({ ...o, vehicles: [...o.vehicles, newVehicle()] }))}
        onRemove={remove}
      />
    </SheetSection>
  )
}
