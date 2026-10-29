import type { ReactNode } from "react"
import { Link, type To } from "react-router"
import { ChevronLeftIcon } from "lucide-react"
import { cn } from "cn"
import { Hint } from "@/components/hint"
import { Button } from "@/components/ui/button"

/** Items of an explorer, one per line across the whole width, each standing apart as a card of its own. */
export const EXPLORER_CARDS = "grid content-start gap-2 stagger-in"

/** One item of `EXPLORER_CARDS`; leaves room on the right for a ⋯ button. */
export const EXPLORER_CARD =
  "grid gap-0.5 rounded-lg border px-3 py-2.5 pr-10 outline-none transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"

/**
 * A page's items (notes, posts, …) across the whole page, like a file explorer. Opening an
 * item replaces it with the item's view, which goes back here with `<BackButton>`.
 */
export function Explorer({
  title,
  toolbar,
  children,
}: {
  /** Accessible name of the list. */
  title: string
  /** Search and "new" buttons above the items. */
  toolbar?: ReactNode
  children: ReactNode
}) {
  return (
    <div role="region" aria-label={title} className="flex min-h-0 flex-1 flex-col">
      {toolbar && <div className="flex gap-2 p-4">{toolbar}</div>}
      <div className={cn("min-h-0 flex-1 overflow-y-auto px-4 pb-4", !toolbar && "pt-4")}>{children}</div>
    </div>
  )
}

/** Leads from an item's view back to the explorer it was opened from. */
export function BackButton({ to, label, className }: { to: To; label: string; className?: string }) {
  return (
    <Hint label={label}>
      <Button variant="ghost" size="icon-sm" asChild className={cn("shrink-0", className)}>
        <Link to={to} aria-label={label}>
          <ChevronLeftIcon />
        </Link>
      </Button>
    </Hint>
  )
}
