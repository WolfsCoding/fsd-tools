// The Asservate of the cyber forensics and the other items. Each row keeps its own examination
// steps, stored as JSON in its `schritte` cell so they move with it.

import type { Row, Value } from "@/features/case-files/types"
import { tableRows } from "@/features/case-files/templates"
import { sameText } from "@/lib/text"

export const ITEMS_KEY = "asservate"
/** Where the steps are stored: in each row, and in older analyses as a table of their own linked by name. */
export const STEPS_KEY = "schritte"

/** One step of an item's examination: what was done and its result, one line per point. */
export interface ExamStep {
  id: string
  untersuchung: string
  ergebnis: string
}

const str = (v: unknown) => (typeof v === "string" ? v : "")

export function parseSteps(cell: string | undefined): ExamStep[] {
  if (!cell?.trim().startsWith("[")) return []
  try {
    const parsed: unknown = JSON.parse(cell)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((s) =>
      typeof s === "object" && s !== null
        ? [{ id: str(s.id) || crypto.randomUUID(), untersuchung: str(s.untersuchung), ergebnis: str(s.ergebnis) }]
        : [],
    )
  } catch {
    return []
  }
}

/** What the templates write where something is still to be filled in by hand. */
export const PLACEHOLDER = /X{3,}/g

export const placeholdersIn = (text: string) => text.match(PLACEHOLDER)?.length ?? 0

export const openIn = (step: ExamStep) => placeholdersIn(step.untersuchung) + placeholdersIn(step.ergebnis)

export const openInAll = (steps: ExamStep[]) => steps.reduce((n, s) => n + openIn(s), 0)

/** Whether the step is filled in: an examination, a result and no placeholder left. */
export const isDone = (step: ExamStep) => !!step.untersuchung.trim() && !!step.ergebnis.trim() && !openIn(step)

/** The steps as a cell; "" without any that have something entered, so the row doesn't count as filled. */
export function storeSteps(steps: ExamStep[]) {
  const entered = steps.filter((s) => s.untersuchung.trim() || s.ergebnis.trim())
  return entered.length ? JSON.stringify(entered) : ""
}

/**
 * The items with their steps. Older analyses kept the steps in a table of their own, each
 * naming its item: they go to the first item of that name still without steps of its own; those
 * of an item not listed become an item of their own, after the others.
 */
export function withLegacySteps(rows: Row[], legacy: Value | undefined): Row[] {
  const old = tableRows(legacy)
  if (!old.length) return rows
  const groups = new Map<string, { name: string; steps: ExamStep[] }>()
  old.forEach((s, i) => {
    const name = s.asservat?.trim() ?? ""
    const key = name.toLowerCase()
    const group = groups.get(key) ?? { name, steps: [] }
    group.steps.push({ id: s.id || `legacy-${i}`, untersuchung: s.untersuchung ?? "", ergebnis: s.ergebnis ?? "" })
    groups.set(key, group)
  })
  const next = rows.map((row) => {
    if (row[STEPS_KEY]) return row
    const match = [...groups].find(([, g]) => sameText(g.name, row.bezeichnung ?? ""))
    if (!match) return row
    groups.delete(match[0])
    return { ...row, [STEPS_KEY]: storeSteps(match[1].steps) }
  })
  // Ids that stay the same on every read, until the rows are stored.
  const rest = [...groups.values()].map((g) => ({ id: `legacy-${g.steps[0].id}`, bezeichnung: g.name, [STEPS_KEY]: storeSteps(g.steps) }))
  return [...next, ...rest]
}
