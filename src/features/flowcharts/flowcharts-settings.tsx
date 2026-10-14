import { SettingsRow, SettingsValue } from "@/components/settings-layout"
import { countNodes } from "./tree"
import { useFlowcharts } from "./use-flowcharts"

/** Rows for the "Daten" section of the feature's settings page. */
export function FlowchartsSettings() {
  const { charts } = useFlowcharts()
  const format = (n: number) => n.toLocaleString("de-DE")
  return (
    <>
      <SettingsRow title="Ablaufdiagramme">
        <SettingsValue>{format(charts.length)}</SettingsValue>
      </SettingsRow>
      <SettingsRow title="Schritte">
        <SettingsValue>{format(charts.reduce((sum, c) => sum + countNodes(c.root), 0))}</SettingsValue>
      </SettingsRow>
    </>
  )
}
