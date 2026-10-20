import { SettingsRow, SettingsValue } from "@/components/settings-layout"
import { useNoteFolders } from "./folders"
import { useNotes } from "./use-notes"

/** Rows for the "Daten" section of the feature's settings page. */
export function NotesSettings() {
  const { notes } = useNotes()
  const [folders] = useNoteFolders()
  return (
    <>
      <SettingsRow title="Notizen">
        <SettingsValue>{notes.length.toLocaleString("de-DE")}</SettingsValue>
      </SettingsRow>
      <SettingsRow title="Ordner">
        <SettingsValue>{folders.length.toLocaleString("de-DE")}</SettingsValue>
      </SettingsRow>
    </>
  )
}
