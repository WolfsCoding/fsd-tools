/** Route prefix of the flowcharts; must match its `path` in the registry. */
export const FLOWCHARTS_BASE = "/flowcharts"

export function flowchartPath(id: string) {
  return `${FLOWCHARTS_BASE}/${id}`
}
