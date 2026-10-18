import { useEffect } from "react"
import { toast } from "sonner"
import { useSettingsDialog } from "@/hooks/use-settings"
import { WRITE_FAILED_EVENT } from "@/lib/local-storage"

/** Warns with a toast when a change couldn't be saved because the browser storage is full. */
export function StorageWarning() {
  const { openPage } = useSettingsDialog()

  useEffect(() => {
    function onFail() {
      toast.error("Änderung konnte nicht gespeichert werden", {
        id: "storage-full",
        description: "Der Browserspeicher ist voll. Exportiere deine Daten und lösche Nicht-Benötigtes.",
        duration: Infinity,
        action: { label: "Sicherung", onClick: () => openPage("sicherung") },
      })
    }
    window.addEventListener(WRITE_FAILED_EVENT, onFail)
    return () => window.removeEventListener(WRITE_FAILED_EVENT, onFail)
  }, [openPage])

  return null
}
