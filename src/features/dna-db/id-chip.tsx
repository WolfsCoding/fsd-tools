import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "cn"
import { copy } from "@/lib/clipboard"

/**
 * A short value that copies itself on click; a dash while empty. IDs show as a chip in
 * monospace; `plain` is for other values, e.g. a phone number.
 */
export function IdChip({ value, label, plain }: { value: string; label: string; plain?: boolean }) {
  if (!value) return <span className="text-muted-foreground">—</span>
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => copy(value, label)}
          aria-label={`${label} ${value} kopieren`}
          // Don't let a quick double-click on the chip open the edit dialog.
          onDoubleClick={(e) => e.stopPropagation()}
          className={cn(
            "inline-flex cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            plain ? "rounded-sm tabular-nums hover:underline" : "rounded-md bg-muted/60 px-2 py-[3px] font-mono text-xs transition-colors hover:bg-muted",
          )}
        >
          {value}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label} kopieren</TooltipContent>
    </Tooltip>
  )
}
