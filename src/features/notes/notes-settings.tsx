import { SettingsRow, SettingsValue } from "@/components/settings-layout"
import { useNotes } from "./use-notes"

/** Rows for the "Daten" section of the feature's settings page. */
export function NotesSettings() {
  const { notes } = useNotes()
  return (
    <SettingsRow title="Notizen">
      <SettingsValue>{notes.length.toLocaleString("de-DE")}</SettingsValue>
    </SettingsRow>
  )
}
