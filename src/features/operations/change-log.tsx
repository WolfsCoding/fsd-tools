import { Fragment } from "react"
import { formatDate } from "@/lib/format-date"
import { formatTime, useNow } from "./format"
import { viewEntry } from "./log-entries"
import { STATUS_LABEL } from "./status"
import { StatusSquare } from "./status-badge"
import type { LogEntry, Unit, UnitStatus } from "./types"

/** The change entries as a timeline, grouped by day, in the order given. */
export function ChangeTimeline({ entries, units }: { entries: LogEntry[]; units: Unit[] }) {
  const today = formatDate(useNow(60000))
  return (
    <ol>
      {entries.map((l, i) => {
        const day = formatDate(l.at)
        const newDay = i === 0 || formatDate(entries[i - 1].at) !== day
        const lastOfDay = i === entries.length - 1 || formatDate(entries[i + 1].at) !== day
        return (
          <Fragment key={l.id}>
            {newDay && (
              <li className="flex items-center gap-3 py-2 text-xs font-medium text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                {day === today ? "Heute" : day}
                <span className="h-px flex-1 bg-border" />
              </li>
            )}
            <ChangeItem entry={l} units={units} connected={!lastOfDay} />
          </Fragment>
        )
      })}
    </ol>
  )
}

function ChangeItem({ entry, units, connected }: { entry: LogEntry; units: Unit[]; connected: boolean }) {
  const { icon: Icon, unit, text, status } = viewEntry(entry, units)
  return (
    <li className="relative flex gap-3 pb-3">
      {/* Line down to the next entry of the same day. */}
      {connected && <span aria-hidden className="absolute top-7 bottom-0 left-3 w-px -translate-x-1/2 bg-border" />}
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full border bg-background text-muted-foreground">
        <Icon className="size-3" />
      </span>
      <p className="min-w-0 flex-1 pt-0.5 text-sm/5 break-words">
        {unit && <UnitTag name={unit} />}
        {status ? (
          <span className="inline-flex flex-wrap items-center gap-x-1.5">
            <StatusChip status={status.from} />
            <span className="text-muted-foreground">→</span>
            <StatusChip status={status.to} />
          </span>
        ) : (
          text
        )}
      </p>
      <time dateTime={entry.at} className="shrink-0 pt-0.5 text-xs/5 text-muted-foreground tabular-nums">
        {formatTime(entry.at)}
      </time>
    </li>
  )
}

function UnitTag({ name }: { name: string }) {
  return (
    <span className="mr-1.5 inline-flex min-h-5 items-center rounded-[3px] bg-muted px-1.5 align-[1px] text-xs font-semibold">
      {name}
    </span>
  )
}

function StatusChip({ status }: { status: UnitStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 align-[-3px] whitespace-nowrap">
      <StatusSquare status={status} className="size-4 text-[0.6rem]" />
      {STATUS_LABEL[status]}
    </span>
  )
}
