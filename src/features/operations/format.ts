import { useEffect, useState } from "react"

const time = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" })

/** e.g. "14:32" */
export function formatTime(iso: string) {
  return time.format(new Date(iso))
}

/** e.g. "45 Min.", "2 Std. 05 Min." */
export function formatDuration(from: string, to: Date | string) {
  const minutes = Math.max(0, Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 60000))
  if (minutes < 60) return `${minutes} Min.`
  return `${Math.floor(minutes / 60)} Std. ${String(minutes % 60).padStart(2, "0")} Min.`
}

/** The current time, updated every `ms` so durations keep counting. */
export function useNow(ms = 15000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), ms)
    return () => clearInterval(timer)
  }, [ms])
  return now
}
