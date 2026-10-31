import { useState, type ReactNode } from "react"
import { GripVerticalIcon, PencilIcon, XIcon } from "lucide-react"
import { cn } from "cn"
import { Hint } from "@/components/hint"
import { StepDialog, type Step } from "@/components/step-dialog"
import { move, useReorder } from "@/components/use-reorder"
import { AddRow, BOX, FULL } from "@/features/case-files/doc-form"
import { insertAt } from "@/features/case-files/templates"
import type { Row } from "@/features/case-files/types"
import { removedToast } from "@/lib/undo"

/** A column of the table: its header and what a row shows in it. */
export interface ListColumn {
  label: string
  cell: (row: Row) => ReactNode
  wide?: boolean
}

/** What the steps of the dialog get: the row being edited and what changes it. */
export interface Draft {
  row: Row
  set: (patch: Partial<Row>) => void
  replace: (fn: (row: Row) => Row) => void
}

/**
 * The Asservate of an analysis as a table; each row is added and edited in a dialog, step by
 * step. Its columns, steps and name come from the analysis.
 */
export function AsservateList({
  noun,
  rows,
  onChange,
  onUpdate,
  newRow,
  columns,
  title,
  left,
  steps,
  onSave,
}: {
  /** e.g. "Asservat". */
  noun: string
  rows: Row[]
  onChange: (rows: Row[]) => void
  /** Changes the rows as they are stored by then, e.g. from a toast. */
  onUpdate: (fn: (rows: Row[]) => Row[]) => void
  newRow: () => Row
  columns: ListColumn[]
  /** What names the row, e.g. in the dialog's title; "" while nothing is entered. */
  title: (row: Row) => string
  /** Whether the row isn't part of the analysis yet; it's then greyed out. */
  left?: (row: Row) => boolean
  steps: (draft: Draft) => Step[]
  /** Called with the edited row before it is stored. */
  onSave?: (row: Row) => void
}) {
  const [draft, setDraft] = useState<{ row: Row; isNew: boolean }>()
  const reorder = useReorder((from, to) => onChange(move(rows, from, to)))

  function save() {
    if (!draft) return
    const { row, isNew } = draft
    onSave?.(row)
    onUpdate((now) => (isNew || !now.some((r) => r.id === row.id) ? [...now, row] : now.map((r) => (r.id === row.id ? row : r))))
    setDraft(undefined)
  }

  function remove(i: number, name: string) {
    const row = rows[i]
    onChange(rows.filter((_, j) => j !== i))
    removedToast(name, () => onUpdate((now) => (now.some((r) => r.id === row.id) ? now : insertAt(now, i, row))))
  }

  const change = (fn: (row: Row) => Row) => setDraft((d) => d && { ...d, row: fn(d.row) })

  return (
    <div className={cn(FULL, BOX, "overflow-x-auto")}>
      {/* Separate borders, so the number column lines up exactly with the add button below. */}
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr className="h-9 bg-muted/50 text-left text-xs text-muted-foreground *:border-b *:border-border/60">
            <th className="w-10 min-w-10 border-r border-border/60">
              <span className="sr-only">Verschieben</span>
            </th>
            {columns.map((c) => (
              <th key={c.label} className={cn("border-r border-border/60 px-3 font-medium whitespace-nowrap", c.wide ? "min-w-44" : "min-w-24")}>
                {c.label}
              </th>
            ))}
            <th className="w-20 min-w-20">
              <span className="sr-only">Bearbeiten, Entfernen</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const name = title(row) || `${noun} ${i + 1}`
            const out = left?.(row)
            return (
              <tr
                key={row.id}
                {...reorder.row(i)}
                onClick={(e) => !(e.target as HTMLElement).closest("button") && setDraft({ row, isNew: false })}
                className={cn("group cursor-pointer hover:bg-accent/30 *:border-b *:border-border/60", reorder.rowClass(i))}
              >
                <td
                  {...reorder.handle(i)}
                  className="w-10 min-w-10 cursor-grab border-r border-border/60 bg-muted/50 text-center text-xs font-semibold text-muted-foreground active:cursor-grabbing"
                >
                  <span className="group-hover:hidden">{i + 1}</span>
                  <GripVerticalIcon className="mx-auto hidden size-3.5 group-hover:block" />
                </td>
                {columns.map((c) => (
                  <td
                    key={c.label}
                    className={cn("h-10 max-w-64 truncate border-r border-border/60 px-3", out && "text-muted-foreground")}
                  >
                    {c.cell(row) || <span className="text-muted-foreground/50">--</span>}
                  </td>
                ))}
                <td>
                  <span className="flex items-center justify-center gap-0.5 px-1">
                    <Hint label={`${noun} bearbeiten`}>
                      <button
                        type="button"
                        onClick={() => setDraft({ row, isNew: false })}
                        aria-label={`${name} bearbeiten`}
                        className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <PencilIcon className="size-3.5" />
                      </button>
                    </Hint>
                    <button
                      type="button"
                      onClick={() => remove(i, name)}
                      aria-label={`${name} entfernen`}
                      className="flex size-7 items-center justify-center rounded-md text-muted-foreground/70 hover:bg-accent hover:text-foreground"
                    >
                      <XIcon className="size-3.5" />
                    </button>
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <AddRow label={`${noun} hinzufügen`} onClick={() => setDraft({ row: newRow(), isNew: true })} className="sticky left-0" />
      <StepDialog
        open={!!draft}
        title={draft?.isNew ? `Neues ${noun}` : (draft && title(draft.row)) || `${noun} bearbeiten`}
        steps={draft ? steps({ row: draft.row, set: (patch) => change((r) => ({ ...r, ...patch }) as Row), replace: change }) : []}
        saveLabel={draft?.isNew ? "Hinzufügen" : "Speichern"}
        onSave={save}
        onCancel={() => setDraft(undefined)}
      />
    </div>
  )
}
