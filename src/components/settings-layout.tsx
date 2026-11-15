import type { ComponentType, ReactNode } from "react"
import { cn } from "cn"
import { Label } from "@/components/ui/label"

/** A titled group of settings: its rows sit in one card, split by lines. */
export function SettingsSection({
  title,
  description,
  plain,
  children,
}: {
  title?: string
  description?: ReactNode
  /** For content that brings its own frame, e.g. a table. */
  plain?: boolean
  children: ReactNode
}) {
  return (
    <section className="mb-8 grid gap-2.5 last:mb-0">
      {(title || description) && (
        <div className="grid gap-0.5 px-1">
          {title && <h2 className="text-sm font-semibold">{title}</h2>}
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      )}
      {plain ? children : <div className="divide-y overflow-hidden rounded-xl border bg-muted/20">{children}</div>}
    </section>
  )
}

export function SettingsRow({
  title,
  description,
  icon: Icon,
  htmlFor,
  children,
}: {
  title: string
  description?: ReactNode
  icon?: ComponentType<{ className?: string }>
  /** Links the title to the control so clicking it toggles switches. */
  htmlFor?: string
  children: ReactNode
}) {
  return (
    // On a narrow page the control wraps below the text instead of squeezing it.
    <div className="flex flex-wrap items-center gap-x-8 gap-y-3 px-4 py-3">
      <div className="flex flex-1 basis-60 items-start gap-3">
        {Icon && <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
        <div className={cn("grid gap-0.5", !description && "py-0.5")}>
          <Label htmlFor={htmlFor} className="text-sm font-medium">
            {title}
          </Label>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  )
}

/** Right-aligned read-only value for a settings row. */
export function SettingsValue({ children }: { children: ReactNode }) {
  return <span className="text-sm font-medium tabular-nums">{children}</span>
}
