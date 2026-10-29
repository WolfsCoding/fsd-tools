import type { ReactNode } from "react"
import { cn } from "cn"
import { Label } from "@/components/ui/label"

export function SettingsSection({
  title,
  children,
}: {
  title?: string
  children: ReactNode
}) {
  return (
    <section className="mb-8 last:mb-0">
      {title && <h2 className="mb-1 text-base font-semibold">{title}</h2>}
      <div className="divide-y">{children}</div>
    </section>
  )
}

export function SettingsRow({
  title,
  description,
  htmlFor,
  children,
}: {
  title: string
  description?: string
  /** Links the title to the control so clicking it toggles switches. */
  htmlFor?: string
  children: ReactNode
}) {
  return (
    // On a narrow page the control wraps below the text instead of squeezing it.
    <div className="flex flex-wrap items-center gap-x-8 gap-y-3 py-4">
      <div className={cn("grid flex-1 basis-60 gap-1", !description && "py-0.5")}>
        <Label htmlFor={htmlFor} className="text-sm font-medium">
          {title}
        </Label>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  )
}

/** Right-aligned read-only value for a settings row. */
export function SettingsValue({ children }: { children: ReactNode }) {
  return <span className="text-sm font-medium tabular-nums">{children}</span>
}
