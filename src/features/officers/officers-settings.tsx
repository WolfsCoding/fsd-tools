import { useAtom } from "@effect/atom-react"
import { SettingsSection } from "@/components/settings-layout"
import { insertAt, updateAt } from "@/features/operations/rows"
import { SheetTable, TextCell } from "@/features/operations/sheet"
import { removedToast } from "@/lib/undo"
import { officersAtom, type Officer } from "./officers"

/** Settings page "Officer": the officers suggested in the Akten and the Einsatzleitung. */
export function OfficersSettings() {
  const [officers, setOfficers] = useAtom(officersAtom)
  const setOfficer = (i: number, fn: (o: Officer) => Officer) => setOfficers((os) => updateAt(os, i, fn))

  function remove(i: number) {
    const row = officers[i]
    setOfficers((os) => os.filter((o) => o.id !== row.id))
    if (row.name.trim()) removedToast(`„${row.name.trim()}“`, () => setOfficers((os) => insertAt(os, i, row)))
  }

  return (
    <SettingsSection
      title="Officer"
      description="Werden überall vorgeschlagen, wo ein Officer eingetragen wird, etwa in Akten und im Streifenblatt."
      plain
    >
      <SheetTable
        rows={officers}
        columns={[
          {
            key: "name",
            label: "Name",
            cell: (o, i) => (
              <TextCell
                value={o.name}
                onChange={(v) => setOfficer(i, (x) => ({ ...x, name: v }))}
                label={`Name (Zeile ${i + 1})`}
                placeholder="Officer I Ryan Shaw"
              />
            ),
          },
        ]}
        addLabel="Officer hinzufügen"
        onAdd={() => setOfficers((os) => [...os, { id: crypto.randomUUID(), name: "" }])}
        onRemove={remove}
      />
    </SettingsSection>
  )
}
