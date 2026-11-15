import { useAtom } from "@effect/atom-react"
import { SettingsSection } from "@/components/settings-layout"
import { removedToast } from "@/lib/undo"
import { insertAt, updateAt } from "./rows"
import { rosterUnitsAtom, type RosterUnit } from "./roster"
import { SheetTable, TextCell } from "./sheet"

/** The units the Streifenblatt suggests; any other unit can still be typed there. */
export function RosterSettings() {
  const [units, setUnits] = useAtom(rosterUnitsAtom)
  const setUnit = (i: number, fn: (u: RosterUnit) => RosterUnit) => setUnits((us) => updateAt(us, i, fn))

  function removeUnit(i: number) {
    const row = units[i]
    setUnits((us) => us.filter((u) => u.id !== row.id))
    if (row.kennung.trim() || row.fahrzeug.trim())
      removedToast(`„${row.kennung.trim() || row.fahrzeug.trim()}“`, () => setUnits((us) => insertAt(us, i, row)))
  }

  return (
    <SettingsSection
      title="Fahrzeuge & Kennungen"
      description="Wählst du im Streifenblatt eine Kennung als Einheit, wird ihr Fahrzeug daneben angezeigt."
      plain
    >
      <SheetTable
        rows={units}
        columns={[
          {
            key: "kennung",
            label: "Kennung",
            cell: (u, i) => (
              <TextCell
                value={u.kennung}
                onChange={(v) => setUnit(i, (x) => ({ ...x, kennung: v }))}
                label={`Kennung (Zeile ${i + 1})`}
                placeholder="Adam-12"
                code
              />
            ),
          },
          {
            key: "fahrzeug",
            label: "Fahrzeug",
            wide: true,
            cell: (u, i) => (
              <TextCell
                value={u.fahrzeug}
                onChange={(v) => setUnit(i, (x) => ({ ...x, fahrzeug: v }))}
                label={`Fahrzeug (Zeile ${i + 1})`}
                placeholder="Vapid Scout"
                code
              />
            ),
          },
        ]}
        addLabel="Fahrzeug hinzufügen"
        onAdd={() => setUnits((us) => [...us, { id: crypto.randomUUID(), kennung: "", fahrzeug: "" }])}
        onRemove={removeUnit}
      />
    </SettingsSection>
  )
}
