import type { PlateCheck, PlateStatus } from "./types"

export const STATUS_FILTERS: { value: PlateStatus | "alle"; label: string }[] = [
  { value: "alle", label: "Alle" },
  { value: "offen", label: "Offen" },
  { value: "gueltig", label: "Gültig" },
  { value: "ungueltig", label: "Ungültig" },
]
export type StatusFilter = (typeof STATUS_FILTERS)[number]["value"]

/** How many days back the filter reaches; "alle" has no limit. */
export const DATE_FILTERS = [
  { value: "alle", label: "Jederzeit", days: undefined },
  { value: "heute", label: "Heute", days: 0 },
  { value: "woche", label: "Letzte 7 Tage", days: 7 },
  { value: "monat", label: "Letzte 30 Tage", days: 30 },
] as const
export type DateFilter = (typeof DATE_FILTERS)[number]["value"]

export interface PlateFilter {
  query?: string
  status?: StatusFilter
  date?: DateFilter
}

export const isStatusFilter = (v: unknown): v is StatusFilter => STATUS_FILTERS.some((s) => s.value === v)
export const isDateFilter = (v: unknown): v is DateFilter => DATE_FILTERS.some((d) => d.value === v)

/** The local day `days` ago, as a datetime-local value starts ("2026-10-28"). */
function dayAgo(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

/** The checks matching the text (driver, holder, model, plate, scene), the status and the date range. */
export function filterChecks(checks: readonly PlateCheck[], { query = "", status = "alle", date = "alle" }: PlateFilter) {
  const q = query.trim().toLowerCase()
  const days = DATE_FILTERS.find((d) => d.value === date)?.days
  const since = days === undefined ? "" : dayAgo(days)
  return checks.filter(
    (c) =>
      (status === "alle" || c.status === status) &&
      c.date.slice(0, 10) >= since &&
      (!q || [c.driver, c.holder ?? "", c.model, c.plate, c.scene].some((t) => t.toLowerCase().includes(q))),
  )
}
