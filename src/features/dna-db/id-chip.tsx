import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { copy } from "@/lib/clipboard"

/** A DNA or fingerprint ID that copies itself on click; "---" while empty. */
export function IdChip({ value, label }: { value: string; label: string }) {
  if (!value) return <span className="text-muted-foreground">---</span>
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => copy(value, label)}
          // Don't let a quick double-click on the chip open the edit dialog.
          onDoubleClick={(e) => e.stopPropagation()}
          className="inline-flex cursor-pointer rounded-md border bg-muted/60 px-2 py-0.5 font-mono text-xs transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {value}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label} kopieren</TooltipContent>
    </Tooltip>
  )
}
