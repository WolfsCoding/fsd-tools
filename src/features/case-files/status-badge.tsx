import { cn } from "cn"
import { STATUS_LABELS, type CaseStatus } from "./types"

// Offen and Erledigt in the colors of negative and positive results in the Berichte; Verwaltung like the ID chips of the Personen.
const COLORS: Record<CaseStatus, string> = {
  offen: "bg-[#F87171] text-white",
  erledigt: "bg-[#34D399] text-white",
  verwaltung: "bg-muted/60 text-foreground",
}

/** Shows where a case file stands, like the records system. */
export function StatusBadge({ status }: { status: CaseStatus }) {
  return (
    <span
      className={cn(
        "inline-flex h-5.5 items-center rounded-sm px-1.5 text-[11px] font-semibold tracking-wide uppercase",
        COLORS[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
