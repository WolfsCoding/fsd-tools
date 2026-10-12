import type { ComponentProps, ReactNode } from "react"
import { cn } from "cn"
import { useEditSession, useLocked } from "./edit-state"

/** A small heading over a bordered card, like the task lists. Rows inside are divided by lines. */
export function Section({
  title,
  aside,
  className,
  children,
}: {
  title: ReactNode
  /** Shown at the right of the heading, e.g. a count. */
  aside?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section className={cn("grid content-start gap-2", className)}>
      <h3 className="flex items-center justify-between gap-2 text-sm font-medium text-muted-foreground">
        {title}
        {aside && <span className="text-xs font-normal tabular-nums">{aside}</span>}
      </h3>
      <div className="divide-y rounded-lg border bg-card text-card-foreground">{children}</div>
    </section>
  )
}

/**
 * A text area without a frame that grows with its text; saves while typing. `onCommit` gets the
 * text from before and after an edit once the field loses focus, e.g. to log it. Read-only while
 * the operation is locked.
 */
export function QuietField({
  value,
  onChange,
  onCommit,
  className,
  ...props
}: {
  value: string
  onChange: (value: string) => void
  onCommit?: (before: string, after: string) => void
} & Omit<ComponentProps<"textarea">, "value" | "onChange">) {
  const locked = useLocked()
  const session = useEditSession(value, onCommit)
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      {...session}
      readOnly={locked}
      rows={1}
      className={cn(
        "field-sizing-content block w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/60",
        className,
      )}
      {...props}
    />
  )
}
