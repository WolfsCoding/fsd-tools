import { SettingsRow, SettingsValue } from "@/components/settings-layout"
import { useDnaEntries } from "./use-dna-entries"

/** DNA-DB specific rows in the feature's "Daten" settings section. */
export function DnaDbSettings() {
  const { entries } = useDnaEntries()

  return (
    <SettingsRow title="Einträge">
      <SettingsValue>{entries.length.toLocaleString("de-DE")}</SettingsValue>
    </SettingsRow>
  )
}
