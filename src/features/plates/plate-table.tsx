import { useRef, useState } from "react"
import { EllipsisIcon, EyeIcon, GripVerticalIcon, Trash2Icon } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useReorder } from "@/components/use-reorder"
import { AddRow, BOX, CELL_INPUT, ChoiceCell } from "@/features/case-files/doc-form"
import type { Choice } from "@/features/case-files/templates"
import { useColors } from "@/features/case-files/use-case-files"
import { removedToast } from "@/lib/undo"
import { renderPlateTicket } from "./render"
import { TicketDialog } from "./ticket-dialog"
import type { PlateCheck, PlateCheckInput, PlateStatus } from "./types"
import type { PlatesApi } from "./use-plates"

const TH = "h-9 border-r border-border/60 px-3 text-left font-medium whitespace-nowrap"

const COLUMNS: { key: keyof Omit<PlateCheckInput, "date">; label: string; placeholder: string }[] = [
  { key: "driver", label: "Fahrzeugführer", placeholder: "Name" },
  { key: "holder", label: "Fahrzeughalter", placeholder: "Name" },
  { key: "plate", label: "Kennzeichen", placeholder: "ZZ 0000" },
  { key: "model", label: "Fahrzeugmodell", placeholder: "Modell" },
  { key: "scene", label: "Tatort", placeholder: "Ort" },
]

/** "Offen" is the dropdown's own empty choice, so only the results are listed. */
const STATUS: Choice[] = [
  { value: "gueltig", label: "Gültig", className: "text-emerald-400" },
  { value: "ungueltig", label: "Ungültig", className: "text-red-400" },
]

/**
 * Plate checks as an editable table like the ones in the Akten: every cell is filled in place,
 * new rows start on top, and rows are reordered by dragging their handle.
 */
export function PlateTable({ checks, api, onAdd }: { checks: PlateCheck[]; api: PlatesApi; onAdd: () => void }) {
  const { colors } = useColors()
  const [ticket, setTicket] = useState<string>()
  const bodyRef = useRef<HTMLTableSectionElement>(null)
  const reorder = useReorder((from, to) => api.moveCheck(checks[from].id, checks[to].id))

  return (
    <div className={cn(BOX, "overflow-x-auto")}>
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr className="bg-muted/50 text-xs text-muted-foreground *:border-b">
            <th className="w-10 min-w-10 border-r border-border/60">
              <span className="sr-only">Verschieben</span>
            </th>
            {COLUMNS.map((c) => (
              <th key={c.key} className={cn(TH, "min-w-28")}>
                {c.label}
              </th>
            ))}
            <th className={cn(TH, "w-48 min-w-48")}>Datum</th>
            <th className={cn(TH, "w-32")}>Status</th>
            <th className="w-10 min-w-10 border-border/60">
              <span className="sr-only">Aktionen</span>
            </th>
          </tr>
        </thead>
        <tbody ref={bodyRef}>
          {checks.map((check, i) => (
            <tr key={check.id} {...reorder.row(i)} className={cn("group focus-within:bg-accent/20 *:border-b", reorder.rowClass(i))}>
              <td
                {...reorder.handle(i)}
                className="w-10 min-w-10 cursor-grab border-r border-border/60 bg-muted/50 text-muted-foreground group-focus-within:bg-accent/60 active:cursor-grabbing"
              >
                <GripVerticalIcon className="mx-auto size-3.5" />
              </td>
              {COLUMNS.map((c) => (
                <td key={c.key} className="border-r border-border/60 p-0">
                  <input
                    value={check[c.key] ?? ""}
                    onChange={(e) => api.updateCheck(check.id, { [c.key]: e.target.value })}
                    placeholder={c.placeholder}
                    aria-label={`${c.label} (Zeile ${i + 1})`}
                    autoComplete="off"
                    className={CELL_INPUT}
                  />
                </td>
              ))}
              <td className="border-r border-border/60 p-0">
                <input
                  type="datetime-local"
                  value={check.date}
                  onChange={(e) => api.updateCheck(check.id, { date: e.target.value })}
                  aria-label={`Datum (Zeile ${i + 1})`}
                  className={cn(CELL_INPUT, "scheme-dark")}
                />
              </td>
              <td className="border-r border-border/60 p-0">
                <ChoiceCell
                  label={`Status (Zeile ${i + 1})`}
                  value={check.status === "offen" ? "" : check.status}
                  choices={STATUS}
                  empty="Offen"
                  onChange={(v) => api.setStatus(check.id, (v || "offen") as PlateStatus)}
                />
              </td>
              <td className="border-border/60">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Aktionen (Zeile ${i + 1})`}
                      className="mx-auto flex text-muted-foreground/70"
                    >
                      <EllipsisIcon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {check.status === "ungueltig" && (
                      <DropdownMenuItem onSelect={() => setTicket(renderPlateTicket(check, colors))}>
                        <EyeIcon /> Ticket anzeigen
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => removedToast(check.plate.trim() ? `Abfrage „${check.plate.trim()}“` : "Abfrage", api.deleteCheck(check.id))}
                    >
                      <Trash2Icon /> Löschen
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <AddRow
        label="Abfrage hinzufügen"
        onClick={() => {
          onAdd()
          // New rows start on top.
          requestAnimationFrame(() => bodyRef.current?.querySelector("input")?.focus())
        }}
        className="sticky left-0"
      />
      <TicketDialog markdown={ticket} onClose={() => setTicket(undefined)} />
    </div>
  )
}
