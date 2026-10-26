// The substances of a toxicological analysis: rows added by hand, each a substance picked from the
// catalog with amount, sample, unit and a note. Only rows with a substance and an amount above 0
// are found: listed in the overview, with a numbered section of results.

import { section, table, type Colors } from "@/features/case-files/markdown"
import { parseNumber, pickSome, randomInt, remainder, roll, withUnit } from "@/features/case-files/range"
import { tableRows } from "@/features/case-files/templates"
import type { Row, Value } from "@/features/case-files/types"
import { joinAnd, rangePlaceholder, restPlaceholder, SUBSTANCE_BY_KEY, SUBSTANCES, type Substance } from "./substances"

/** Where the added substances are stored, one row each. */
export const SUBSTANCES_KEY = "substanzen"

/** Agents of a row are stored one per line. */
const SEPARATOR = "\n"

/** The catalog entry named `name` (ignoring case), if there is one. */
export function substanceNamed(name: string) {
  const n = name.trim().toLowerCase()
  return SUBSTANCES.find((s) => s.name.toLowerCase() === n)
}

export function substanceOf(row: Row): Substance {
  return SUBSTANCE_BY_KEY.get(row.substance)!
}

export function agentsOf(row: Row) {
  return (row.agents ?? "").split(SEPARATOR).filter((a) => a.trim())
}

export function storeAgents(agents: string[]) {
  return agents.join(SEPARATOR)
}

/** A new row of the table; without a substance until one is picked. */
export function newSubstanceRow(s?: Substance): Row {
  return {
    id: crypto.randomUUID(),
    substance: s?.key ?? "",
    menge: "",
    stichprobe: "",
    einheit: s?.units[0] ?? "",
    agents: storeAgents(s?.agents?.preset ?? []),
    anmerkung: "",
  }
}

/**
 * The row with `produkt` typed into its substance cell. Naming another substance of the
 * catalog switches to it: its default unit and agents, without the values of the old one.
 */
export function withProduct(row: Row, product: string): Row {
  const s = substanceNamed(product)
  // While the name is being retyped, the row remembers its substance (`vorher`) to keep its values.
  const previous = row.substance || row.vorher || ""
  if (!s) return { ...row, produkt: product, substance: "", vorher: previous }
  if (s.key === previous) return { ...row, produkt: product, substance: s.key, vorher: "" }
  const fresh = newSubstanceRow(s)
  return {
    ...fresh,
    id: row.id,
    menge: row.menge ?? "",
    stichprobe: row.stichprobe ?? "",
    anmerkung: row.anmerkung ?? "",
    produkt: product,
  }
}

/** 10 % of the amount, rounded up and at least one; "" while no amount is entered. */
export function autoSample(row: Row) {
  const n = parseNumber(row.menge ?? "")
  if (Number.isNaN(n)) return ""
  return String(n <= 0 ? 0 : Math.max(1, Math.ceil(n / 10)))
}

/** The entered sample size; the button next to it fills in 10 % of the amount. */
export function sampleOf(row: Row) {
  return row.stichprobe?.trim() ?? ""
}

/** Whether the dice change anything for the substance. */
export function canRoll(s: Substance) {
  return s.params.length > 0 || !!s.agents?.random
}

/** The row with every share rolled within its range, and two or three agents picked at random. */
export function rollSubstance(row: Row): Row {
  const s = substanceOf(row)
  const next = { ...row }
  for (const p of s.params) next[p.key] = roll(p.range)
  if (s.agents?.random) {
    const n = s.agents.options.length
    next.agents = storeAgents(pickSome(s.agents.options, randomInt(Math.min(2, n), Math.min(3, n))))
  }
  return next
}

/** Whether a substance is picked and an amount above 0 entered, which makes the row part of the analysis. */
export function isFound(row: Row) {
  return SUBSTANCE_BY_KEY.has(row.substance) && parseNumber(row.menge ?? "") > 0
}

/** The rows with a substance and an amount above 0, in the order they were added. */
export function foundRows(value: Value | undefined) {
  return tableRows(value).filter(isFound)
}

/** Rolls the found substances again; every other row stays as it is. */
export function randomizeSubstances(value: Value | undefined): Row[] {
  return tableRows(value).map((row) => (isFound(row) ? rollSubstance(row) : row))
}

/** The rest of the substance's main share to 100 %, e.g. "77%"; "" while the share is missing. */
export function restOf(row: Row) {
  const s = substanceOf(row)
  const p = s.params.find((x) => x.key === s.rest)
  if (!p) return ""
  const rest = remainder(row[p.key] ?? "", p.range.decimals)
  return rest && withUnit(rest, p.range.unit)
}

/** The bullet points of a substance's results, with placeholders for what's missing. */
function resultLines(row: Row, colors: Colors) {
  const s = substanceOf(row)
  const param = (key: string) => s.params.find((p) => p.key === key)
  const agents = agentsOf(row)
  const restParam = s.rest ? param(s.rest) : undefined
  const lines = s.lines({
    p: (key) => {
      const p = param(key)
      const v = row[key]?.trim()
      if (!p) return "N/A"
      return v ? withUnit(v, p.range.unit) : (p.fallback ?? rangePlaceholder(p.range))
    },
    rest: restOf(row) || (restParam ? restPlaceholder(restParam.range) : "N/A"),
    agents: agents.length ? joinAnd(agents) : `[ XX ${s.agents?.options.join(", ") ?? "XXX"} XX ]`,
  })
  return lines.map(([title, text]) => `> - <font color=${colors.heading}><b>${title}:</b></font> ${text}`).join("\n")
}

const OVERVIEW_HEADERS = ["Produkt", "Menge", "Stichprobe (10%)", "Einheit", "Anmerkung"]

/**
 * Step 1 (the overview), then a section per substance numbered as an item (`#1`); `next` numbers the step that follows. The
 * empty template (`blank`) shows every substance of the catalog with placeholders.
 */
export function toxSections(value: Value | undefined, style: { colors: Colors }, blank = false) {
  const found = foundRows(value)
  const rows: Row[] = !found.length && blank ? SUBSTANCES.map((s) => ({ ...newSubstanceRow(s), einheit: "" })) : found
  // Without substances there's nothing to give an overview of.
  if (!rows.length) return { sections: [], next: 1 }
  const overview = table(
    OVERVIEW_HEADERS,
    rows.map((row) => {
      const s = substanceOf(row)
      return [
        s.name,
        row.menge?.trim() || "x",
        sampleOf(row) || "x",
        row.einheit?.trim() || s.units.join("/"),
        row.anmerkung?.trim() || "N/A",
      ]
    }),
  )
  return {
    sections: [
      section(style, "1. Übersicht der Asservate:", overview),
      ...rows.map((row, i) =>
        section(style, `#${i + 1} Analyseergebnisse (${substanceOf(row).heading}):`, resultLines(row, style.colors)),
      ),
    ],
    /** Number of the step after the overview; the results are items (`#1`), not steps. */
    next: 2,
  }
}
