import { CheckIcon, RotateCcwIcon } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"
import { Combobox } from "@/components/combobox"
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
import { removedToast } from "@/lib/undo"
import { insertAt, updateAt } from "./rows"
import { SheetSection, SheetTable, TextCell, type SheetColumn } from "./sheet"
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
        aria-label={`Beamter ${n + 1} (Zeile ${i + 1})`}
        className={CELL_COMBOBOX}
      />
    ),
  })

  const columns: SheetColumn<Patrol>[] = [
    {
      key: "einheit",
      label: "Einheit",
      cell: (p, i) => (
        <TextCell value={p.einheit} onChange={(v) => setPatrol(i, (x) => ({ ...x, einheit: v }))} label={`Einheit (Zeile ${i + 1})`} />
      ),
    },
    {
      key: "aufgabe",
      label: "Aufgabe",
      wide: true,
      cell: (p, i) => (
        <TextCell value={p.aufgabe} onChange={(v) => setPatrol(i, (x) => ({ ...x, aufgabe: v }))} label={`Aufgabe (Zeile ${i + 1})`} />
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
      title="Streifen"
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
