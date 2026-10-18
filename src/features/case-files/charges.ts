import {
  formatFine,
  needsQuantity,
  quantityLabel,
  resolveOffense,
  type Fine,
  type Offense,
} from "@/features/law-book/offenses"
import { code, table } from "./markdown"
import { tableRows } from "./templates"
import type { Row, Value } from "./types"

/**
 * One charged offense, stored as a row of the case file document:
 * `{ id, offense, betrag?, anzahl? }`. `offense` is the offense's id (its citation, see
 * `Offense.id`). `betrag` is the amount set within the fine's range; empty means the range counts.
 */
export type ChargeRow = Row

export interface Charge {
  row: ChargeRow
  offense: Offense
  /** Units or items for offenses fined per unit or item; at least 1. */
  quantity: number
  /** The range the law allows for this charge, with its quantity applied. */
  range?: Fine
  /** The amount set by hand, if any. */
  amount?: number
}

/** A saved row whose offense isn't in the law books (anymore). Shown as a warning, never counted. */
export interface UnknownCharge {
  row: ChargeRow
  offense: undefined
}

const parseNumber = (s: string | undefined) => {
  const n = Number((s ?? "").replace(/[.\s$]/g, "").replace(",", "."))
  return s?.trim() && Number.isFinite(n) ? n : undefined
}

export function newChargeRow(offense: Offense): ChargeRow {
  return { id: crypto.randomUUID(), offense: offense.id }
}

/** The fine range of an offense for a quantity: per-unit fines multiply, per-item extras add up. */
export function rangeOf(o: Offense, quantity: number): Fine | undefined {
  if (!o.fine) return undefined
  const factor = o.per ? quantity : 1
  const extra = o.extra ? o.extra.amount * quantity : 0
  return { min: o.fine.min * factor + extra, max: o.fine.max * factor + extra }
}

/** Every stored row in order, as a charge or, if its offense can't be found, an unknown one. */
export function chargeEntries(value: Value | undefined): (Charge | UnknownCharge)[] {
  return tableRows(value).map((row) => {
    // Also finds offenses saved under an older spelling of their id.
    const offense = resolveOffense(row.offense)
    if (!offense) return { row, offense: undefined }
    const quantity = needsQuantity(offense) ? Math.max(1, parseNumber(row.anzahl) ?? 1) : 1
    return { row, offense, quantity, range: rangeOf(offense, quantity), amount: parseNumber(row.betrag) }
  })
}

/** The stored rows as charges, without the unknown ones. */
export function chargesOf(value: Value | undefined): Charge[] {
  return chargeEntries(value).filter((c): c is Charge => !!c.offense)
}

/** Whether a set amount lies outside the range the law allows. */
export const isOutOfRange = (c: Charge) =>
  c.amount !== undefined && !!c.range && (c.amount < c.range.min || c.amount > c.range.max)

/** The fine of one charge: the set amount, else its range. */
export function fineOf(c: Charge): Fine | undefined {
  if (c.amount !== undefined) return { min: c.amount, max: c.amount }
  return c.range
}

/** Sum of every charge's fine, and the penalties besides fines (e.g. Haft). */
export function totalOf(charges: Charge[]) {
  const total: Fine = { min: 0, max: 0 }
  for (const c of charges) {
    const fine = fineOf(c)
    if (!fine) continue
    total.min += fine.min
    total.max += fine.max
  }
  const other = [...new Set(charges.flatMap((c) => c.offense.other?.split(" / ") ?? []))]
  return { fine: total, other, hasFine: charges.some((c) => fineOf(c)) }
}

/** The charge's offense as a short text, e.g. "Betäubungsmittel (Einheit: 25)". */
function chargeTitle(c: Charge) {
  return needsQuantity(c.offense) ? `${c.offense.title} (${quantityLabel(c.offense)}: ${c.quantity})` : c.offense.title
}

function chargeFine(c: Charge) {
  const fine = fineOf(c)
  return [fine && formatFine(fine), c.offense.other].filter(Boolean).join(" + ") || "--"
}

/**
 * The charges as a quoted table plus the total, for the markdown of a document. Unknown ones stay
 * listed as such; the empty template (`blank`) shows one row of placeholders instead of none.
 */
export function chargesMarkdown(value: Value | undefined, blank = false) {
  const entries = chargeEntries(value)
  const cells = entries.map((c) =>
    c.offense
      ? [c.offense.ref, chargeTitle(c), chargeFine(c)]
      : [c.row.offense || "--", "Unbekannte Straftat (nicht im Gesetzbuch)", "--"],
  )
  const rows = table(["Paragraph", "Tatbestand", "Strafmaß"], cells.length || !blank ? cells : [["§XX", "XXX", "XXX"]])
  const charges = entries.filter((c): c is Charge => !!c.offense)
  if (!charges.length) return rows
  const { fine, other, hasFine } = totalOf(charges)
  const sum = [hasFine && formatFine(fine), ...other].filter(Boolean).join(" + ")
  return `${rows}\n>\n> **Gesamt:** ${code(sum)}`
}
