import { SettingsRow, SettingsValue } from "@/components/settings-layout"
import { useNotes } from "./use-notes"

/** Rows for the "Daten" section of the feature's settings page. */
export function NotesSettings() {
  const { notes } = useNotes()
  const format = (n: number) => n.toLocaleString("de-DE")
  return (
    <>
      <SettingsRow title="Notizen">
        <SettingsValue>{format(notes.length)}</SettingsValue>
      </SettingsRow>
      <SettingsRow title="Seiten">
        <SettingsValue>{format(notes.reduce((sum, n) => sum + n.pages.length, 0))}</SettingsValue>
      </SettingsRow>
    </>
  )
}
