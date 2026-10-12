import { cn } from "cn"
import type { MenuKit } from "./menu-kit"
import { STATUS_HINT, STATUS_LABEL, STATUS_LETTER, STATUS_SQUARE } from "./status"
import { UNIT_STATUSES, type UnitStatus } from "./types"

/** The coloured status letter of a unit, e.g. a red "B" for "Beschäftigt". */
export function StatusSquare({ status, className }: { status: UnitStatus; className?: string }) {
  return (
    <span
      aria-label={STATUS_LABEL[status]}
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-[3px] text-xs font-bold",
        STATUS_SQUARE[status],
        className,
      )}
    >
      {STATUS_LETTER[status]}
    </span>
  )
}

/** The unit statuses to pick from, with their hints, for a dropdown or a right-click menu. */
export function StatusOptions({
  kit,
  value,
  onChange,
}: {
  kit: MenuKit
  value: UnitStatus
  onChange: (status: UnitStatus) => void
}) {
  return (
    <kit.RadioGroup value={value} onValueChange={(s) => onChange(s as UnitStatus)}>
      {UNIT_STATUSES.map((s) => (
        <kit.RadioItem key={s} value={s} className="gap-2.5">
          <StatusSquare status={s} className="size-5" />
          <span className="grid">
            <span>{STATUS_LABEL[s]}</span>
            <span className="text-xs text-muted-foreground">{STATUS_HINT[s]}</span>
          </span>
        </kit.RadioItem>
      ))}
    </kit.RadioGroup>
  )
}
