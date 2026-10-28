import { useAtomValue } from "@effect/atom-react"
import { useEffect } from "react"
import { toast } from "sonner"
import { useSettingsDialog } from "@/hooks/use-settings"
import { writeFailureAtom } from "@/lib/storage"

/** Warns with a toast when a change couldn't be saved because the browser storage is full. */
export function StorageWarning() {
  const { openPage } = useSettingsDialog()
  const failure = useAtomValue(writeFailureAtom)

  useEffect(() => {
    if (!failure) return
    toast.error("Änderung konnte nicht gespeichert werden", {
      id: "storage-full",
      description: "Der Browserspeicher ist voll. Exportiere deine Daten und lösche Nicht-Benötigtes.",
      duration: Infinity,
      action: { label: "Sicherung", onClick: () => openPage("sicherung") },
    })
  }, [failure, openPage])

  return null
}
