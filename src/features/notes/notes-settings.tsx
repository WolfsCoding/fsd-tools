import { count } from "@/lib/text"
import { useNoteFolders } from "./folders"
import { useNotes } from "./use-notes"

/** What the notes store, for their row in the settings. */
export function NotesSummary() {
  const { notes } = useNotes()
  const [folders] = useNoteFolders()
  return `${count(notes.length, "Notiz", "Notizen")}, ${count(folders.length, "Ordner", "Ordner")}`
}
