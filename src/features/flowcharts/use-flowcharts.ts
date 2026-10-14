import { useCallback, useMemo } from "react"
import { useLocalStorage } from "@/lib/local-storage"
import { newNode } from "./tree"
import { NODE_COLORS, type FlowNode, type Flowchart } from "./types"

export const FLOWCHARTS_KEY = "flowcharts:flowcharts"
const NO_FLOWCHARTS: Flowchart[] = []

/** Checks imported data before it replaces the stored flowcharts. */
export function isValidFlowchartsData(data: Record<string, unknown>) {
  const charts = data[FLOWCHARTS_KEY]
  return charts === undefined || (Array.isArray(charts) && charts.every(isFlowchart))
}

function isFlowchart(value: unknown): value is Flowchart {
  if (typeof value !== "object" || value === null) return false
  const v = value as Record<string, unknown>
  return (
    ["id", "createdAt", "updatedAt"].every((k) => typeof v[k] === "string") &&
    (v.direction === "down" || v.direction === "right") &&
    (v.theme === "dark" || v.theme === "light") &&
    isFlowNode(v.root)
  )
}

function isFlowNode(value: unknown): value is FlowNode {
  if (typeof value !== "object" || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === "string" &&
    typeof v.text === "string" &&
    (v.color === undefined || NODE_COLORS.includes(v.color as never)) &&
    (v.linkTo === undefined || typeof v.linkTo === "string") &&
    Array.isArray(v.children) &&
    v.children.every(isFlowNode)
  )
}

export function flowchartTitle(chart: Flowchart | undefined) {
  return chart?.root.text.trim() || "Ohne Titel"
}

export type FlowchartPatch = Partial<Pick<Flowchart, "root" | "direction" | "theme">>

const now = () => new Date().toISOString()

/** The example from the empty page: when the forensics get called to a shooting. */
function exampleRoot(): FlowNode {
  const node = (text: string, children: FlowNode[] = [], color?: FlowNode["color"]) => ({
    ...newNode(text),
    color,
    children,
  })
  return node("Wann informiere ich die Forensik?", [
    node("Schießerei", [
      node("Gang vs. Gang", [node("Wird nicht gebraucht", [], "red")]),
      node("Gang vs. Officer", [node("Wird informiert", [], "green")]),
    ]),
  ])
}

export function useFlowcharts() {
  const [charts, setCharts] = useLocalStorage<Flowchart[]>(FLOWCHARTS_KEY, NO_FLOWCHARTS)

  const sorted = useMemo(() => [...charts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [charts])

  const createFlowchart = useCallback(
    (example = false) => {
      const chart: Flowchart = {
        id: crypto.randomUUID(),
        root: example ? exampleRoot() : newNode(),
        direction: "down",
        theme: "dark",
        createdAt: now(),
        updatedAt: now(),
      }
      setCharts((prev) => [...prev, chart])
      return chart.id
    },
    [setCharts],
  )

  /** Applies `patch`, or what it returns for the stored flowchart. Only real changes count as an edit. */
  const updateFlowchart = useCallback(
    (id: string, patch: FlowchartPatch | ((chart: Flowchart) => FlowchartPatch)) =>
      setCharts((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c
          const p = typeof patch === "function" ? patch(c) : patch
          const changed = (Object.keys(p) as (keyof FlowchartPatch)[]).some((k) => p[k] !== c[k])
          return changed ? { ...c, ...p, updatedAt: now() } : c
        }),
      ),
    [setCharts],
  )

  /** Deletes the flowchart right away; the returned function puts it back where it was. */
  const deleteFlowchart = useCallback(
    (id: string) => {
      const index = charts.findIndex((c) => c.id === id)
      const chart = charts[index]
      setCharts((prev) => prev.filter((c) => c.id !== id))
      return () =>
        setCharts((prev) =>
          !chart || prev.some((c) => c.id === id) ? prev : [...prev.slice(0, index), chart, ...prev.slice(index)],
        )
    },
    [charts, setCharts],
  )

  return { charts: sorted, createFlowchart, updateFlowchart, deleteFlowchart }
}
