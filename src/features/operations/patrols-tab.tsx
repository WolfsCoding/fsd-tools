import { useAtomValue } from "@effect/atom-react"
import { CheckIcon, RotateCcwIcon } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"
import { Combobox, type ComboboxOption } from "@/components/combobox"
import { Button } from "@/components/ui/button"
import { CheckMark } from "@/components/ui/checkbox"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { CELL_COMBOBOX } from "@/features/case-files/doc-form"
import { sameText } from "@/lib/text"
import { removedToast } from "@/lib/undo"
import { rosterUnitsAtom } from "./roster"
import { insertAt, updateAt } from "./rows"
import { CodeComboboxCell, SheetSection, SheetTable, TextCell, type SheetColumn } from "./sheet"
import { CHECK_COLORS, type CheckColor, type Operation, type Patrol } from "./types"
import { newPatrol } from "./use-operations"

const TONES: Record<CheckColor, { label: string; box: string; fill: string; dot: string }> = {
  rot: { label: "Rot", box: "border-red-500 bg-red-500/15", fill: "border-red-500 bg-red-500 text-white", dot: "bg-red-500" },
  gruen: {
    label: "Grün",
    box: "border-emerald-500 bg-emerald-500/15",
    fill: "border-emerald-500 bg-emerald-500 text-white",
    dot: "bg-emerald-500",
  },
  orange: {
    label: "Orange",
    box: "border-orange-500 bg-orange-500/15",
    fill: "border-orange-500 bg-orange-500 text-white",
    dot: "bg-orange-500",
  },
}

/** The Streifenblatt: every unit with its task and officers, checked off in each checkup. */
export function PatrolsTab({
  operation,
  onChange,
  officers,
}: {
  operation: Operation
  onChange: (fn: (o: Operation) => Operation) => void
  officers: string[]
}) {
  const units = useAtomValue(rosterUnitsAtom)
  const patrols = operation.patrols
  const setPatrol = (i: number, fn: (p: Patrol) => Patrol) => onChange((o) => ({ ...o, patrols: updateAt(o.patrols, i, fn) }))
  const marked = patrols.some((p) => p.checked || p.color)

  function reset() {
    const before = new Map(patrols.map((p) => [p.id, { checked: p.checked, color: p.color }]))
    onChange((o) => ({ ...o, patrols: o.patrols.map((p) => ({ ...p, checked: false, color: undefined })) }))
    const undo = () => onChange((o) => ({ ...o, patrols: o.patrols.map((p) => ({ ...p, ...before.get(p.id) })) }))
    toast("Checks zurückgesetzt", { action: { label: "Rückgängig", onClick: undo } })
  }

  function remove(i: number) {
    const row = patrols[i]
    onChange((o) => ({ ...o, patrols: o.patrols.filter((p) => p.id !== row.id) }))
    removedToast(row.einheit.trim() ? `„${row.einheit.trim()}“` : `Streife ${i + 1}`, () =>
      onChange((o) => ({ ...o, patrols: insertAt(o.patrols, i, row) })),
    )
  }

  const officerColumn = (n: 0 | 1 | 2 | 3): SheetColumn<Patrol> => ({
    key: `beamter${n}`,
    label: `Beamter ${n + 1}`,
    // Room for rank and name; the table scrolls sideways where the four don't fit.
    wide: true,
    cell: (p, i) => (
      <Combobox
        value={p.beamte[n]}
        onChange={(v) =>
          setPatrol(i, (x) => {
            const beamte: Patrol["beamte"] = [...x.beamte]
            beamte[n] = v
            return { ...x, beamte }
          })
        }
        options={officers}
        placeholder="N/A"
        aria-label={`Beamter ${n + 1} (Zeile ${i + 1})`}
        className={CELL_COMBOBOX}
      />
    ),
  })

  const unitOptions: ComboboxOption[] = units
    .filter((u) => u.kennung.trim())
    .map((u) => ({ value: u.kennung.trim(), hint: u.fahrzeug.trim() || undefined }))
  // Only a Kennung from the settings has a vehicle; any other unit is for this operation only.
  const vehicleOf = (einheit: string) =>
    (einheit.trim() && units.find((u) => sameText(u.kennung, einheit))?.fahrzeug.trim()) || ""

  const columns: SheetColumn<Patrol>[] = [
    {
      key: "einheit",
      label: "Einheit",
      // Room for the call sign's chip next to the toggle.
      wide: true,
      cell: (p, i) => (
        <CodeComboboxCell
          value={p.einheit}
          onChange={(v) => setPatrol(i, (x) => ({ ...x, einheit: v }))}
          options={unitOptions}
          aria-label={`Einheit (Zeile ${i + 1})`}
        />
      ),
    },
    {
      key: "fahrzeug",
      label: "Fahrzeug",
      cell: (p) => {
        const vehicle = vehicleOf(p.einheit)
        return (
          <span className={cn("flex h-10 items-center px-3 whitespace-nowrap", !vehicle && "text-muted-foreground")}>{vehicle || "—"}</span>
        )
      },
    },
    {
      key: "aufgabe",
      label: "Aufgabe",
      wide: true,
      cell: (p, i) => (
        <TextCell value={p.aufgabe} onChange={(v) => setPatrol(i, (x) => ({ ...x, aufgabe: v }))} label={`Aufgabe (Zeile ${i + 1})`} placeholder="N/A" />
      ),
    },
    officerColumn(0),
    officerColumn(1),
    officerColumn(2),
    officerColumn(3),
    {
      key: "anmerkung",
      label: "Anmerkung",
      wide: true,
      cell: (p, i) => (
        <TextCell
          value={p.anmerkung}
          onChange={(v) => setPatrol(i, (x) => ({ ...x, anmerkung: v }))}
          label={`Anmerkung (Zeile ${i + 1})`}
        />
      ),
    },
  ]

  return (
    <SheetSection
      title="Streifenblatt"
      actions={
        <>
          <Button variant="outline" size="sm" onClick={reset} disabled={!marked}>
            <RotateCcwIcon /> Checks zurücksetzen
          </Button>
        </>
      }
    >
      <SheetTable
        rows={patrols}
        columns={columns}
        lead={{
          label: "Check",
          cell: (p, i) => (
            <CheckBox
              checked={p.checked}
              color={p.color}
              label={`Check: ${p.einheit.trim() || `Streife ${i + 1}`}`}
              onCheckedChange={(v) => setPatrol(i, (x) => ({ ...x, checked: v }))}
              onColor={(c) => setPatrol(i, (x) => ({ ...x, color: c }))}
            />
          ),
        }}
        addLabel="Streife hinzufügen"
        onAdd={() => onChange((o) => ({ ...o, patrols: [...o.patrols, newPatrol()] }))}
        onRemove={remove}
      />
    </SheetSection>
  )
}

/** A check box whose color is picked from its context menu. */
function CheckBox({
  checked,
  color,
  label,
  onCheckedChange,
  onColor,
}: {
  checked: boolean
  color?: CheckColor
  label: string
  onCheckedChange: (checked: boolean) => void
  onColor: (color: CheckColor | undefined) => void
}) {
  const tone = color && TONES[color]
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          aria-label={tone ? `${label} (${tone.label})` : label}
          onClick={() => onCheckedChange(!checked)}
          className="flex h-10 w-full items-center justify-center outline-none hover:bg-accent/60 focus-visible:bg-accent/60"
        >
          <span
            className={cn(
              "flex size-4.5 items-center justify-center rounded-[5px] border transition-colors",
              checked
                ? (tone?.fill ?? "border-primary bg-primary text-primary-foreground")
                : (tone?.box ?? "border-muted-foreground/50 bg-background"),
            )}
          >
            {checked && <CheckMark />}
          </span>
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {CHECK_COLORS.map((c) => (
          <ContextMenuItem key={c} onSelect={() => onColor(c)}>
            <span className={cn("size-3 rounded-full", TONES[c].dot)} /> {TONES[c].label}
            {color === c && <CheckIcon className="ml-auto" />}
          </ContextMenuItem>
        ))}
        <ContextMenuSeparator />
        <ContextMenuItem disabled={!color} onSelect={() => onColor(undefined)}>
          Farbe entfernen
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
