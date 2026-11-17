import type { ComponentProps, ReactNode } from "react"
import { XIcon } from "lucide-react"
import { cn } from "cn"
import { Combobox } from "@/components/combobox"
import { CHIP_INPUT } from "@/features/case-files/rich-input"
import { AddRow, BOX, CELL_INPUT } from "@/features/case-files/doc-form"

export interface SheetColumn<R> {
  key: string
  label: string
  /** Room for longer text, e.g. a note. */
  wide?: boolean
  /** Just wide enough for a short choice, e.g. Ja or Nein. */
  narrow?: boolean
  /** A width of its own, e.g. "min-w-64" for a name with its ID chip. */
  width?: string
  cell: (row: R, i: number) => ReactNode
}

/**
 * Rows as an editable table, styled like the case files' tables. The lead cell shows the
 * row's number unless `lead` gives it something else, e.g. a check box.
 */
export function SheetTable<R extends { id: string }>({
  rows,
  columns,
  lead,
  addLabel,
  onAdd,
  onRemove,
}: {
  rows: R[]
  columns: SheetColumn<R>[]
  lead?: { label: string; cell: (row: R, i: number) => ReactNode }
  addLabel: string
  onAdd: () => void
  onRemove: (i: number) => void
}) {
  return (
    <div className={cn(BOX, "overflow-x-auto")}>
      <table className="w-full border-separate border-spacing-0 text-sm tabular-nums">
        <thead>
          <tr className="bg-muted/50 text-xs text-muted-foreground *:border-b">
            <th className="w-10 min-w-10 border-r border-border/60">
              <span className="sr-only">{lead?.label ?? "Nummer"}</span>
            </th>
            {columns.map((c) => (
              <th
                key={c.key}
                className={cn(
                  "h-9 border-r border-border/60 px-3 text-left font-medium whitespace-nowrap",
                  c.width ?? (c.narrow ? "w-32" : c.wide ? "min-w-48" : "min-w-36"),
                )}
              >
                {c.label}
              </th>
            ))}
            <th className="w-10 min-w-10">
              <span className="sr-only">Entfernen</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id} className="group focus-within:bg-accent/20 *:border-b">
              <td className="w-10 min-w-10 border-r border-border/60 bg-muted/50 p-0 text-center text-xs text-muted-foreground">
                {lead ? lead.cell(row, i) : i + 1}
              </td>
              {columns.map((c) => (
                <td key={c.key} className="border-r border-border/60 p-0 align-top">
                  {c.cell(row, i)}
                </td>
              ))}
              <td>
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  aria-label={`Zeile ${i + 1} entfernen`}
                  className="mx-auto flex size-7 items-center justify-center rounded-md text-muted-foreground/70 hover:bg-accent hover:text-foreground"
                >
                  <XIcon className="size-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="sticky left-0 flex">
        <AddRow label={addLabel} onClick={onAdd} />
      </div>
    </div>
  )
}

// The label spans the cell, so a click anywhere in it reaches the input; the combobox's own
// wrapper is stretched so its toggle stays at the right edge.
const CODE_CELL = "flex h-10 cursor-text items-center px-3 [&>div]:flex-1"

// The combobox's input brings its own size, border and focus ring; these undo them.
const CODE_COMBOBOX = cn(
  CHIP_INPUT,
  "h-5 w-auto max-w-[calc(100%-1.75rem)] border-0 py-0 md:text-[0.8em] focus-visible:border-0 focus-visible:ring-1 focus-visible:ring-ring",
)

/** A plain text cell; `code` shows its value as inline code. */
export function TextCell({
  value,
  onChange,
  label,
  placeholder,
  code,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  placeholder?: string
  code?: boolean
}) {
  const input = (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      placeholder={placeholder ?? (code ? "N/A" : undefined)}
      autoComplete="off"
      className={code ? CHIP_INPUT : CELL_INPUT}
    />
  )
  return code ? <label className={CODE_CELL}>{input}</label> : input
}

/** A combobox cell that shows its value as inline code. */
export function CodeComboboxCell(props: Omit<ComponentProps<typeof Combobox>, "className">) {
  return (
    <label className={CODE_CELL}>
      <Combobox placeholder="N/A" {...props} className={CODE_COMBOBOX} />
    </label>
  )
}

/** A section of the sheet: a heading with its actions, then its content. */
export function SheetSection({
  title,
  description,
  actions,
  children,
}: {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="grid gap-4 animate-in duration-200 ease-out-quint fade-in-0 slide-in-from-bottom-1">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto grid min-w-0 gap-0.5">
          <h2 className="truncate text-lg font-semibold">{title}</h2>
          {description && <p className="truncate text-xs text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </div>
      {/* min-w-0: a wide table scrolls inside its box instead of widening the section. */}
      <div className="min-w-0">{children}</div>
    </section>
  )
}

