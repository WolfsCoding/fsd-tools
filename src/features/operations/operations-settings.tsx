import { SettingsRow, SettingsValue } from "@/components/settings-layout"
import { useOperations } from "./use-operations"

/** Rows for the "Daten" section of the feature's settings page. */
export function OperationsSettings() {
  const { operations } = useOperations()
  const format = (n: number) => n.toLocaleString("de-DE")
  return (
    <>
      <SettingsRow title="Einsätze">
        <SettingsValue>{format(operations.length)}</SettingsValue>
      </SettingsRow>
      <SettingsRow title="Davon laufend">
        <SettingsValue>{format(operations.filter((e) => !e.endedAt).length)}</SettingsValue>
      </SettingsRow>
      <SettingsRow title="Verlaufseinträge">
        <SettingsValue>{format(operations.reduce((sum, e) => sum + e.log.length, 0))}</SettingsValue>
      </SettingsRow>
    </>
  )
}
