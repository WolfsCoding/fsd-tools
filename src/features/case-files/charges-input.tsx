import { useEffect, useRef, type ReactNode } from "react"
import { Link } from "react-router"
import { PlusIcon, TriangleAlertIcon } from "lucide-react"
import { cn } from "cn"
import { Hint } from "@/components/hint"
import { formatFine, needsQuantity, quantityLabel } from "@/features/law-book/offenses"
import { lawBookPath } from "@/features/law-book/paths"
import { removedToast } from "@/lib/undo"
import { chargeEntries, isOutOfRange, newChargeRow, totalOf, type Charge, type ChargeRow } from "./charges"
import { BOX, END, FULL, LEAD, Labeled, RemoveCell } from "./doc-form"
import { OffensePicker } from "./offense-picker"
import type { CustomFieldProps } from "./templates"
import type { Row, Value } from "./types"

/** A plain input that fills its cell. */
const CELL = "h-10 w-full min-w-0 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:bg-accent/30"
const QUANTITY = "w-24 shrink-0 border-l border-border/60"
const AMOUNT = "w-40 shrink-0 border-l border-border/60"

/**
 * The charges of a case file document; see `ChargesEditor`. A function declaration, not a
 * const: the templates use it while loading, and they import this file in a cycle.
 */
export function ChargesInput({ field, values, onChange }: CustomFieldProps) {
  return (
    <ChargesEditor
      label={field.label}
      hint={field.hint}
      value={values[field.key]}
      onChange={(rows) => onChange(field.key, rows)}
    />
  )
}

/**
 * Offenses picked from the law books, with their fine ranges and the total. An amount can be
 * set within each range; a set amount counts instead of the range. Each row shows only the
 * citation and name, linking to the paragraph in the law book. Rows whose offense isn't in
 * the law books anymore stay as warnings until removed.
 */
export function ChargesEditor({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint?: ReactNode
  value: Value | undefined
  onChange: (rows: ChargeRow[]) => void
}) {
  const entries = chargeEntries(value)
  const rows = entries.map((c) => c.row)
  const charges = entries.filter((c): c is Charge => !!c.offense)
  const change = (id: string, patch: Partial<Row>) => onChange(rows.map((r) => (r.id === id ? ({ ...r, ...patch } as Row) : r)))
  const { fine, other, hasFine } = totalOf(charges)

  // "Rückgängig" runs later, so it puts the row back into the rows as they are by then.
  const latest = useRef({ rows, onChange })
  useEffect(() => {
    latest.current = { rows, onChange }
  })

  const remove = (row: ChargeRow, label: string) => {
    const index = rows.indexOf(row)
    const before = rows[index - 1]?.id
    onChange(rows.filter((r) => r !== row))
    removedToast(label, () => {
      const { rows: now, onChange } = latest.current
      if (now.some((r) => r.id === row.id)) return
      // After the row it followed, if that's still there; else at its old index.
      const after = now.findIndex((r) => r.id === before)
      const at = after >= 0 ? after + 1 : Math.min(index, now.length)
      onChange([...now.slice(0, at), row, ...now.slice(at)])
    })
  }

  return (
    <Labeled label={label} hint={hint} bare className={FULL}>
      <div className={cn(BOX, "divide-y divide-border/60")}>
        <div className="flex h-9 items-stretch bg-muted/50 text-xs font-medium text-muted-foreground">
          <span className="w-10 shrink-0 border-r border-border/60" />
          <span className="flex min-w-0 flex-1 items-center px-3">Straftat</span>
          <span className={cn(QUANTITY, "flex items-center px-3")}>Anzahl</span>
          <span className={cn(AMOUNT, "flex items-center px-3")}>Betrag</span>
          <span className={END}>
            <span className="sr-only">Entfernen</span>
          </span>
        </div>

        {entries.map((c, i) =>
          c.offense ? (
            <ChargeLine
              key={c.row.id}
              charge={c}
              index={i}
              onChange={(patch) => change(c.row.id, patch)}
              onRemove={() => remove(c.row, `Straftat ${c.offense.ref}`)}
            />
          ) : (
            <UnknownLine key={c.row.id} row={c.row} index={i} onRemove={() => remove(c.row, "Unbekannte Straftat")} />
          ),
        )}

        <OffensePicker
          onPick={(offense) => onChange([...rows, newChargeRow(offense)])}
        >
          <button
            type="button"
            className="group/add flex h-10 w-full items-stretch text-left text-sm text-muted-foreground hover:text-foreground"
          >
            <span className={cn(LEAD, "group-hover/add:bg-accent/60")}>
              <PlusIcon className="size-3.5" />
            </span>
            <span className="flex items-center px-3">Straftat hinzufügen</span>
          </button>
        </OffensePicker>

        {charges.length > 0 && (
          <div className="flex min-h-10 items-stretch bg-muted/30 text-sm">
            <span className={cn(LEAD, "text-xs font-semibold")}>Σ</span>
            <span className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
              <span className="font-medium">Gesamt</span>
              {hasFine && <span className="font-semibold tabular-nums text-amber-300">{formatFine(fine)}</span>}
              {other.map((o) => (
                <span key={o} className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-red-300">
                  {o}
                </span>
              ))}
            </span>
          </div>
        )}
      </div>
    </Labeled>
  )
}

/** A saved charge whose offense isn't in the law books (anymore); kept visible so it isn't lost unnoticed. */
function UnknownLine({ row, index, onRemove }: { row: ChargeRow; index: number; onRemove: () => void }) {
  return (
    <div role="alert" className="flex items-stretch bg-destructive/10">
      <span className={cn(LEAD, "text-xs font-semibold")}>{index + 1}</span>
      <span className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-sm text-red-300">
        <TriangleAlertIcon className="size-4 shrink-0" />
        <span className="min-w-0">
          Unbekannte Straftat <span className="font-mono text-xs">{row.offense || "(ohne ID)"}</span> – nicht mehr im
          Gesetzbuch und nicht im Gesamt enthalten. Bitte neu auswählen und diese Zeile entfernen.
        </span>
      </span>
      <RemoveCell label="Unbekannte Straftat entfernen" onRemove={onRemove} />
    </div>
  )
}

function ChargeLine({
  charge,
  index,
  onChange,
  onRemove,
}: {
  charge: Charge
  index: number
  onChange: (patch: Partial<Row>) => void
  onRemove: () => void
}) {
  const { offense, range, row } = charge
  const outOfRange = isOutOfRange(charge)
  return (
    <div className="flex items-stretch focus-within:bg-accent/20">
      <span className={cn(LEAD, "text-xs font-semibold")}>{index + 1}</span>
      <Hint label="Im Gesetzbuch öffnen">
        <Link
          to={lawBookPath(offense.book.id, offense.paragraph.number)}
          className="flex min-w-0 flex-1 items-center px-3 py-2 text-sm outline-none hover:underline focus-visible:bg-accent/40"
        >
          <span className="truncate">
            <span className="font-medium text-amber-400">{offense.ref}</span> {offense.title}
          </span>
        </Link>
      </Hint>
      <span className={QUANTITY}>
        {needsQuantity(offense) ? (
          <input
            value={row.anzahl ?? ""}
            onChange={(e) => onChange({ anzahl: e.target.value })}
            placeholder="1"
            inputMode="numeric"
            aria-label={`${offense.ref}: Anzahl (${quantityLabel(offense)})`}
            className={cn(CELL, "h-full")}
          />
        ) : (
          <span className="flex h-full items-center px-3 text-muted-foreground/50">---</span>
        )}
      </span>
      <span className={cn(AMOUNT, "flex items-center")}>
        {range ? (
          <>
            <input
              value={row.betrag ?? ""}
              onChange={(e) => onChange({ betrag: e.target.value })}
              placeholder={formatFine(range)}
              inputMode="numeric"
              aria-label={`${offense.ref}: Betrag`}
              aria-invalid={outOfRange}
              className={cn(CELL, "h-full", outOfRange && "text-red-400")}
            />
            {outOfRange && (
              <Hint label={`Außerhalb des Strafrahmens (${formatFine(range)})`}>
                <TriangleAlertIcon className="mr-2 size-4 shrink-0 text-red-400" />
              </Hint>
            )}
          </>
        ) : (
          <span className="px-3 text-muted-foreground/50">---</span>
        )}
      </span>
      <RemoveCell label={`${offense.ref} entfernen`} onRemove={onRemove} />
    </div>
  )
}
