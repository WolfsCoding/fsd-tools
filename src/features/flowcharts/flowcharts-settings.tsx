import { count } from "@/lib/text"
import { countNodes } from "./tree"
import { useFlowcharts } from "./use-flowcharts"

/** What the flowcharts store, for their row in the settings. */
export function FlowchartsSummary() {
  const { charts } = useFlowcharts()
  const steps = charts.reduce((sum, c) => sum + countNodes(c.root), 0)
  return `${count(charts.length, "Ablaufdiagramm", "Ablaufdiagramme")}, ${count(steps, "Schritt", "Schritte")}`
}
