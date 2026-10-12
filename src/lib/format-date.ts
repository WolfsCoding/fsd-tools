const absolute = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
})

const dateOnly = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })

/** e.g. "Di., 29.09., 09:00" */
export function formatDateTime(iso: string | Date) {
  return absolute.format(new Date(iso))
}

/** e.g. "29.09.2026" */
export function formatDate(iso: string | Date) {
  return dateOnly.format(new Date(iso))
}

const relative = new Intl.RelativeTimeFormat("de-DE", { numeric: "auto" })

/** e.g. "in 3 Stunden", "morgen", "vor 5 Minuten" */
export function formatRelative(iso: string | Date, now = new Date()) {
  const seconds = (new Date(iso).getTime() - now.getTime()) / 1000
  const abs = Math.abs(seconds)
  if (abs < 60) return relative.format(Math.round(seconds), "second")
  if (abs < 3600) return relative.format(Math.round(seconds / 60), "minute")
  if (abs < 86400) return relative.format(Math.round(seconds / 3600), "hour")
  if (abs < 86400 * 30) return relative.format(Math.round(seconds / 86400), "day")
  return relative.format(Math.round(seconds / (86400 * 30)), "month")
}
