import { useCallback, useRef, useState, type ComponentProps, type KeyboardEvent, type ReactNode } from "react"
import { flushSync } from "react-dom"
import { CalendarClockIcon, CalendarIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { formatDate } from "@/lib/format-date"

const pad = (n: number) => String(n).padStart(2, "0")
const hours = (d: Date) => d.getHours()
const minutes = (d: Date) => d.getMinutes()
const clock = (d: Date) => `${pad(hours(d))}:${pad(minutes(d))}`

/** As a datetime-local input writes it, e.g. "2026-10-02T14:30". */
const toLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${clock(d)}`

function fromLocal(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value)
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : undefined
}

/** "2.10.2026" or "02.10.2026"; anything else (e.g. "xx.xx.2026") isn't a date. */
function fromGerman(value: string) {
  const m = /^\s*(\d{1,2})\.(\d{1,2})\.(\d{4})\s*$/.exec(value)
  if (!m) return undefined
  const d = new Date(+m[3], +m[2] - 1, +m[1])
  return d.getDate() === +m[1] && d.getMonth() === +m[2] - 1 ? d : undefined
}

const FIELD =
  "flex h-9 w-full min-w-0 items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-left text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 md:text-sm"

/** A date and time ("2026-10-02T14:30", or "" for none), picked from a calendar and a clock. */
export function DateTimePicker({
  value,
  onChange,
  placeholder = "Datum wählen",
  className,
  ...props
}: { value: string; onChange: (value: string) => void; placeholder?: string } & Omit<
  ComponentProps<"button">,
  "value" | "onChange"
>) {
  const [open, setOpen] = useState(false)
  const selected = fromLocal(value)
  // Picking only a day or only a time fills in the rest from now.
  const edit = (change: (d: Date) => void) => {
    const d = selected ? new Date(selected) : new Date()
    change(d)
    onChange(toLocal(d))
  }
  const pick = (v: string) => {
    onChange(v)
    setOpen(false)
  }
  return (
    // Modal, so its own scroll lock wins over a dialog's, which would block the wheel in the time columns.
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={cn(FIELD, className)} {...props}>
          <span className={cn("flex-1 truncate tabular-nums", !value && "text-muted-foreground")}>
            {selected ? `${formatDate(selected)}, ${clock(selected)}` : value || placeholder}
          </span>
          <CalendarClockIcon className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PickerContent now="Jetzt" onNow={() => pick(toLocal(new Date()))} onClear={value ? () => pick("") : undefined}>
        <Calendar
          selected={selected}
          onSelect={(day) => edit((d) => d.setFullYear(day.getFullYear(), day.getMonth(), day.getDate()))}
        />
        <div className="flex border-l pl-2">
          <TimeColumn label="Std" count={24} value={selected?.getHours()} now={hours} onSelect={(h) => edit((d) => d.setHours(h))} />
          <TimeColumn
            label="Min"
            count={60}
            value={selected?.getMinutes()}
            now={minutes}
            onSelect={(min) => edit((d) => d.setMinutes(min))}
          />
        </div>
      </PickerContent>
    </Popover>
  )
}

/** A date as typed (e.g. "02.10.2026", but any text is kept), or picked from a calendar. */
export function DatePicker({
  value,
  onChange,
  className,
  ...props
}: { value: string; onChange: (value: string) => void } & Omit<ComponentProps<"input">, "value" | "onChange">) {
  const [open, setOpen] = useState(false)
  const pick = (v: string) => {
    onChange(v)
    setOpen(false)
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className={cn("relative", className)}>
          <Input value={value} onChange={(e) => onChange(e.target.value)} className="pr-9 tabular-nums" {...props} />
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Kalender öffnen"
              className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-lg text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground"
            >
              <CalendarIcon className="size-4" />
            </button>
          </PopoverTrigger>
        </div>
      </PopoverAnchor>
      <PickerContent now="Heute" onNow={() => pick(formatDate(new Date()))} onClear={value ? () => pick("") : undefined}>
        <Calendar selected={fromGerman(value)} onSelect={(day) => pick(formatDate(day))} />
      </PickerContent>
    </Popover>
  )
}

function PickerContent({
  now,
  onNow,
  onClear,
  children,
}: {
  now: string
  onNow: () => void
  onClear?: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <PopoverContent
      ref={ref}
      align="start"
      className="w-auto gap-2 p-2"
      // Start on the selected day (or today) instead of the first button.
      onOpenAutoFocus={(e) => {
        e.preventDefault()
        ref.current?.querySelector<HTMLElement>('[role="grid"] [tabindex="0"]')?.focus()
      }}
    >
      <div className="flex gap-2">{children}</div>
      <div className="flex items-center justify-between border-t pt-2">
        <Button type="button" variant="ghost" size="sm" onClick={onNow}>
          <ClockIcon /> {now}
        </Button>
        {onClear && (
          <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={onClear}>
            Leeren
          </Button>
        )}
      </div>
    </PopoverContent>
  )
}

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]
const monthTitle = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" })
const monthShort = new Intl.DateTimeFormat("de-DE", { month: "short" })
const dayLabel = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })

const sameDay = (a: Date | undefined, b: Date) => a?.toDateString() === b.toDateString()
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
/** The same day `n` months later, or the month's last day if it's shorter. */
function addMonths(d: Date, n: number) {
  const last = new Date(d.getFullYear(), d.getMonth() + n + 1, 0).getDate()
  return new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), last))
}

type View = "days" | "months" | "years"

/** A month of days; its title zooms out to the months of a year, then to twelve years. */
function Calendar({ selected, onSelect }: { selected?: Date; onSelect: (day: Date) => void }) {
  const [focus, setFocus] = useState(() => selected ?? new Date())
  const [view, setView] = useState<View>("days")
  const grid = useRef<HTMLDivElement>(null)
  const [today] = useState(() => new Date())
  const year = focus.getFullYear()
  const decade = year - (year % 12)

  const step = { days: 1, months: 12, years: 144 }[view]
  const title = { days: monthTitle.format(focus), months: String(year), years: `${decade} – ${decade + 11}` }[view]

  const moveTo = (next: Date) => {
    flushSync(() => setFocus(next))
    grid.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus()
  }
  const onKeyDown = (e: KeyboardEvent) => {
    const weekday = (focus.getDay() + 6) % 7
    const next = {
      ArrowLeft: () => addDays(focus, -1),
      ArrowRight: () => addDays(focus, 1),
      ArrowUp: () => addDays(focus, -7),
      ArrowDown: () => addDays(focus, 7),
      PageUp: () => addMonths(focus, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(focus, e.shiftKey ? 12 : 1),
      Home: () => addDays(focus, -weekday),
      End: () => addDays(focus, 6 - weekday),
    }[e.key]
    if (!next) return
    e.preventDefault()
    moveTo(next())
  }

  const first = new Date(year, focus.getMonth(), 1)
  const start = addDays(first, -((first.getDay() + 6) % 7))
  // Always six weeks, so the popover keeps its height from month to month.
  const weeks = Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)))

  return (
    <div className="w-56">
      <div className="mb-1 flex h-8 items-center gap-1">
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Zurück" onClick={() => setFocus(addMonths(focus, -step))}>
          <ChevronLeftIcon />
        </Button>
        <button
          type="button"
          disabled={view === "years"}
          onClick={() => setView(view === "days" ? "months" : "years")}
          className="h-8 flex-1 rounded-md text-sm font-medium tabular-nums outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 disabled:hover:bg-transparent"
        >
          {title}
        </button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Weiter" onClick={() => setFocus(addMonths(focus, step))}>
          <ChevronRightIcon />
        </Button>
      </div>

      {view === "days" ? (
        <>
          <div className="grid h-8 grid-cols-7 place-items-center text-xs text-muted-foreground">
            {WEEKDAYS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div
            ref={grid}
            key={`${year}-${focus.getMonth()}`}
            role="grid"
            aria-label={monthTitle.format(focus)}
            onKeyDown={onKeyDown}
            className="duration-150 animate-in fade-in-0"
          >
            {weeks.map((week) => (
              <div key={week[0].toDateString()} role="row" className="grid grid-cols-7">
                {week.map((day) => {
                  const isSelected = sameDay(selected, day)
                  const isToday = sameDay(today, day)
                  return (
                    <button
                      key={day.toDateString()}
                      type="button"
                      role="gridcell"
                      tabIndex={sameDay(focus, day) ? 0 : -1}
                      aria-selected={isSelected}
                      aria-label={dayLabel.format(day)}
                      aria-current={isToday ? "date" : undefined}
                      onClick={() => {
                        setFocus(day)
                        onSelect(day)
                      }}
                      className={cn(
                        "relative size-8 rounded-md text-sm tabular-nums outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
                        day.getMonth() !== focus.getMonth() && "text-muted-foreground/50",
                        isToday && !isSelected && "font-semibold text-primary",
                        isSelected && "bg-primary font-medium text-primary-foreground hover:bg-primary/90",
                      )}
                    >
                      {day.getDate()}
                      {isToday && (
                        <span
                          className={cn(
                            "absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full",
                            isSelected ? "bg-primary-foreground" : "bg-primary",
                          )}
                        />
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div key={view} className="grid h-56 grid-cols-3 gap-1 duration-150 animate-in fade-in-0 zoom-in-95">
          {Array.from({ length: 12 }, (_, i) => {
            const date = view === "months" ? addMonths(new Date(year, 0, focus.getDate()), i) : addMonths(focus, (decade + i - year) * 12)
            const current = view === "months" ? i === focus.getMonth() : decade + i === year
            const now = view === "months" ? year === today.getFullYear() && i === today.getMonth() : decade + i === today.getFullYear()
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setFocus(date)
                  setView(view === "months" ? "days" : "months")
                }}
                className={cn(
                  "rounded-md text-sm tabular-nums outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
                  now && "font-semibold text-primary",
                  current && "bg-accent font-medium",
                )}
              >
                {view === "months" ? monthShort.format(date) : decade + i}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** A scrolling column of the hours or minutes; opens on the selected one, or on `now` if none is. */
function TimeColumn({
  label,
  count,
  value,
  now,
  onSelect,
}: {
  label: string
  count: number
  value?: number
  now: (d: Date) => number
  onSelect: (value: number) => void
}) {
  // Only when it opens, so it doesn't jump while picking.
  const [start] = useState(value)
  const center = useCallback(
    (list: HTMLDivElement | null) => {
      const item = list?.children[start ?? now(new Date())]
      if (list && item instanceof HTMLElement) list.scrollTop = item.offsetTop - (list.clientHeight - item.offsetHeight) / 2
    },
    [start, now],
  )
  return (
    <div className="w-12">
      <div className="mb-1 flex h-8 items-center justify-center text-xs text-muted-foreground">{label}</div>
      <div
        ref={center}
        role="listbox"
        aria-label={label}
        className="relative flex h-56 flex-col gap-0.5 overflow-y-auto px-1 [scrollbar-width:none]"
      >
        {Array.from({ length: count }, (_, i) => (
          <button
            key={i}
            type="button"
            role="option"
            aria-selected={i === value}
            onClick={() => onSelect(i)}
            className={cn(
              "h-8 shrink-0 rounded-md text-sm tabular-nums outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
              i === value && "bg-primary font-medium text-primary-foreground hover:bg-primary/90",
            )}
          >
            {pad(i)}
          </button>
        ))}
      </div>
    </div>
  )
}
