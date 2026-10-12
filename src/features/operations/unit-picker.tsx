import type { ReactNode } from "react"
import { UserRoundXIcon } from "lucide-react"
import { Hint } from "@/components/hint"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { DROPDOWN_KIT, type MenuKit } from "./menu-kit"
import { StatusSquare } from "./status-badge"
import type { Unit } from "./types"
import { toggleId, unitName } from "./use-operations"

/** Checkbox items to pick any number of units, for a dropdown or a right-click menu. The menu stays open while ticking. */
export function UnitOptions({
  kit,
  units,
  value,
  onChange,
}: {
  kit: MenuKit
  units: Unit[]
  value: string[]
  onChange: (ids: string[]) => void
}) {
  return (
    <>
      {units.map((u) => (
        <kit.CheckboxItem
          key={u.id}
          checked={value.includes(u.id)}
          onCheckedChange={(on) => onChange(toggleId(value, u.id, on))}
          onSelect={(e) => e.preventDefault()}
        >
          <StatusSquare status={u.status} className="size-5" />
          <span className="truncate">{unitName(u)}</span>
        </kit.CheckboxItem>
      ))}
      {units.length === 0 && <p className="px-2 py-1.5 text-sm text-muted-foreground">Noch keine Streifen</p>}
      {value.length > 0 && (
        <>
          <kit.Separator />
          <kit.Item onSelect={() => onChange([])}>
            <UserRoundXIcon className="text-muted-foreground" /> Keine Streife
          </kit.Item>
        </>
      )}
    </>
  )
}

/** A dropdown to pick any number of units. */
export function UnitPicker({
  units,
  value,
  onChange,
  align = "end",
  side,
  hint,
  children,
}: {
  units: Unit[]
  value: string[]
  onChange: (ids: string[]) => void
  align?: "start" | "end"
  side?: "top" | "bottom"
  /** Tooltip of the trigger. */
  hint?: string
  /** The trigger, e.g. a button. */
  children: ReactNode
}) {
  return (
    <DropdownMenu>
      <Hint label={hint}>
        <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      </Hint>
      <DropdownMenuContent align={align} side={side} className="w-56">
        <DROPDOWN_KIT.Label>Streifen zuordnen</DROPDOWN_KIT.Label>
        <UnitOptions kit={DROPDOWN_KIT} units={units} value={value} onChange={onChange} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
