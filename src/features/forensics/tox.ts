// The substances of a toxicological analysis: rows added by hand, each a substance picked from the
// catalog with amount, sample, unit and a note, and the result of the test. Only rows with a
// product and an amount above 0 are found: listed in the overview, with a numbered section of results.
// A positive result needs a substance of the catalog and has its full analysis; a negative or
// unclear one may name any product and just says what was found.

import { table, type Colors } from "@/features/case-files/markdown"
import { parseNumber, pickSome, randomInt, remainder, roll, withUnit } from "@/features/case-files/range"
import { tableRows } from "@/features/case-files/templates"
import type { Row, Value } from "@/features/case-files/types"
import { textKey } from "@/lib/text"
import {
  CHEMICAL,
  CONCLUSION,
  joinAnd,
  MICROSCOPIC,
  NARCOTICS,
  QUANTITATIVE,
  rangePlaceholder,
  restPlaceholder,
  SUBSTANCE_BY_KEY,
  SUBSTANCE_FINDINGS,
  SUBSTANCES,
  type FindingPreset,
  type Substance,
} from "./substances"

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

/** What the test of a row showed; rows from before there was a choice are positive. */
export type ToxResult = "positiv" | "negativ" | "unklar"

/** Each with its short text in the form and the sentence written in the analysis. */
export const TOX_RESULTS: { value: ToxResult; label: string; text: string; sentence: string; className: string }[] = [
  { value: "positiv", label: "Positiv", text: "Substanz bestätigt", sentence: "Die Substanz wurde bestätigt.", className: "text-emerald-400" },
  { value: "negativ", label: "Negativ", text: "Keine Betäubungsmittel nachgewiesen", sentence: "Es wurden keine Betäubungsmittel nachgewiesen.", className: "text-red-400" },
  { value: "unklar", label: "Nicht eindeutig", text: "Kein eindeutiges Ergebnis", sentence: "Der Test lieferte kein eindeutiges Ergebnis.", className: "text-amber-400" },
]

/** Positive needs a substance of the catalog; any other product isn't confirmed until a result is picked. */
export function resultOf(row: Row): ToxResult {
  if (row.ergebnis === "negativ" || row.ergebnis === "unklar") return row.ergebnis
  return row.produkt?.trim() && !SUBSTANCE_BY_KEY.has(row.substance) ? "unklar" : "positiv"
}

export const resultInfo = (row: Row) => TOX_RESULTS.find((r) => r.value === resultOf(row))!

/** A result that has a finding instead of the analysis. */
export type FindingResult = Exclude<ToxResult, "positiv">

/** Points often written as the finding of a test that wasn't positive. */
export const FINDING_PRESETS: Record<FindingResult, FindingPreset[]> = {
  negativ: [
    [CHEMICAL, "Der Schnelltest verlief negativ."],
    [CONCLUSION, "Bei dem Asservat handelt es sich um eine Imitation ohne Wirkstoff (z. B. Mehl, Zucker oder Kräuter)."],
    [CHEMICAL, "Es wurden ausschließlich Streckmittel nachgewiesen."],
    [CONCLUSION, "Es handelt sich um ein legales Produkt (z. B. ein Medikament)."],
  ],
  unklar: [
    [CHEMICAL, "Der Farbreaktionstest zeigte keine eindeutige Färbung."],
    [QUANTITATIVE, "Die Probemenge reichte für eine vollständige Analyse nicht aus."],
    [CHEMICAL, "Die Probe war für ein eindeutiges Ergebnis zu stark verunreinigt."],
    [CONCLUSION, "Das Ergebnis muss durch eine weitere Untersuchung bestätigt werden."],
  ],
}

/** The titles offered for a point; any other can be typed. */
export const FINDING_TITLES = [CHEMICAL, MICROSCOPIC, QUANTITATIVE, CONCLUSION]

/** The points to pick for `result`: those of the row's substance first, then the general ones. */
export function findingPresets(row: Row, result: FindingResult) {
  return [...(SUBSTANCE_FINDINGS[row.substance]?.[result] ?? []), ...FINDING_PRESETS[result]]
}

/** A point of the finding: its title (blue in the analysis), then the text. */
export interface Finding {
  id: string
  titel: string
  text: string
}

/** The entered points; older analyses stored plain lines, each becomes a conclusion. */
export function findingsOf(row: Row): Finding[] {
  const cell = row.befund ?? ""
  if (!cell.trim().startsWith("["))
    return cell
      .split("\n")
      .filter((l) => l.trim())
      .map((text, i) => ({ id: `line-${i}`, titel: CONCLUSION, text: text.trim() }))
  try {
    const parsed: unknown = JSON.parse(cell)
    if (!Array.isArray(parsed)) return []
    const str = (v: unknown) => (typeof v === "string" ? v : "")
    return parsed.flatMap((f) =>
      typeof f === "object" && f !== null ? [{ id: str(f.id) || crypto.randomUUID(), titel: str(f.titel), text: str(f.text) }] : [],
    )
  } catch {
    return []
  }
}

export function storeFindings(findings: Finding[]) {
  return findings.length ? JSON.stringify(findings) : ""
}

/**
 * The row with another result. A positive one has its analysis instead of a finding; otherwise
 * the points picked for the old result go, since they'd contradict it. Own points stay.
 */
export function withResult(row: Row, result: ToxResult): Row {
  if (result === "positiv") return { ...row, ergebnis: result, befund: "" }
  const other = findingPresets(row, result === "negativ" ? "unklar" : "negativ").map(([, text]) => text)
  return { ...row, ergebnis: result, befund: storeFindings(findingsOf(row).filter((f) => !other.includes(f.text))) }
}

/** The catalog substance's name, else the product typed in, e.g. "Weißes Pulver"; "" without either. */
export function productName(row: Row) {
  return SUBSTANCE_BY_KEY.get(row.substance)?.name ?? row.produkt?.trim() ?? ""
}

/** Whether the full analysis (shares, cutting agents) is written: a positive result of a catalog substance. */
export function hasAnalysis(row: Row) {
  return resultOf(row) === "positiv" && SUBSTANCE_BY_KEY.has(row.substance)
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
    ergebnis: row.ergebnis ?? "",
    befund: row.befund ?? "",
    produkt: product,
  }
}

/** 10 % of the amount, rounded up and at least one; "" while no amount is entered. */
export function autoSample(row: Row) {
  const n = parseNumber(row.menge ?? "")
  if (Number.isNaN(n)) return ""
  return String(n <= 0 ? 0 : Math.max(1, Math.ceil(n / 10)))
}

/** The amount; the sample follows it at 10 % until it's changed by hand. */
export function withAmount(row: Row, menge: string): Row {
  const follows = !sampleOf(row) || sampleOf(row) === autoSample(row)
  const next = { ...row, menge }
  return follows ? { ...next, stichprobe: autoSample(next) } : next
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

/**
 * Why the row isn't part of the analysis yet; "" once it is: a product and an amount above 0.
 */
export function missingFor(row: Row) {
  if (!productName(row)) return "Ohne Substanz"
  if (!(parseNumber(row.menge ?? "") > 0)) return "Ohne Menge"
  return ""
}

export const isFound = (row: Row) => !missingFor(row)

/** The found rows, in the order they were added. */
export function foundRows(value: Value | undefined) {
  return tableRows(value).filter(isFound)
}

/** Rolls the found substances with a full analysis again; every other row stays as it is. */
export function randomizeSubstances(value: Value | undefined): Row[] {
  return tableRows(value).map((row) => (isFound(row) && hasAnalysis(row) ? rollSubstance(row) : row))
}

/** The shares of a full analysis entered outside their typical range. */
export function outOfRange(row: Row) {
  if (!hasAnalysis(row)) return []
  return substanceOf(row).params.filter((p) => {
    const n = parseNumber(row[p.key] ?? "")
    return n < p.range.min || n > p.range.max
  })
}

/** The amount of one substance in one unit, summed over the rows that have it. */
export interface Total {
  name: string
  unit: string
  amount: number
  rows: number
  narcotic: boolean
}

/** The found positive substances, summed up by product and unit in the order they first appear. */
export function totals(value: Value | undefined): Total[] {
  const byKey = new Map<string, Total>()
  for (const row of foundRows(value)) {
    if (resultOf(row) !== "positiv") continue
    const name = productName(row)
    const unit = row.einheit?.trim() || "Einheit"
    const key = textKey(`${name}\n${unit}`)
    const total = byKey.get(key) ?? { name, unit, amount: 0, rows: 0, narcotic: NARCOTICS.has(row.substance) }
    total.amount += parseNumber(row.menge ?? "")
    total.rows += 1
    byKey.set(key, total)
  }
  return [...byKey.values()]
}

/** The rest of the substance's main share to 100 %, e.g. "77%"; "" while the share is missing. */
export function restOf(row: Row) {
  const s = substanceOf(row)
  const p = s.params.find((x) => x.key === s.rest)
  if (!p) return ""
  const rest = remainder(row[p.key] ?? "", p.range.decimals)
  return rest && withUnit(rest, p.range.unit)
}

/**
 * The bullet points of a row's results: for a positive one its full analysis, with placeholders
 * for what's missing, else the entered points; without any, the result as the conclusion.
 */
function resultLines(row: Row, colors: Colors) {
  const findings = findingsOf(row).filter((f) => f.text.trim())
  const lines: [string, string][] = hasAnalysis(row)
    ? analysisLines(row)
    : findings.length
      ? findings.map((f) => [f.titel.trim() || CONCLUSION, f.text.trim()])
      : [[CONCLUSION, resultInfo(row).sentence]]
  return lines.map(([title, text]) => `> - <font color=${colors.heading}><b>${title}:</b></font> ${text}`).join("\n")
}

function analysisLines(row: Row) {
  const s = substanceOf(row)
  const param = (key: string) => s.params.find((p) => p.key === key)
  const agents = agentsOf(row)
  const restParam = s.rest ? param(s.rest) : undefined
  return s.lines({
    p: (key) => {
      const p = param(key)
      const v = row[key]?.trim()
      if (!p) return "N/A"
      return v ? withUnit(v, p.range.unit) : (p.fallback ?? rangePlaceholder(p.range))
    },
    rest: restOf(row) || (restParam ? restPlaceholder(restParam.range) : "N/A"),
    agents: agents.length ? joinAnd(agents) : `[ XX ${s.agents?.options.join(", ") ?? "XXX"} XX ]`,
  })
}

const OVERVIEW_HEADERS = ["Produkt", "Menge", "Stichprobe (10%)", "Einheit", "Anmerkung"]

/**
 * The overview table of the substances, and their results, one item (`#1`) each; "" and none
 * while no substance was found. The empty template (`blank`) shows every substance of the
 * catalog with placeholders.
 */
export function toxParts(value: Value | undefined, colors: Colors, blank = false) {
  const found = foundRows(value)
  const rows: Row[] = !found.length && blank ? SUBSTANCES.map((s) => ({ ...newSubstanceRow(s), einheit: "" })) : found
  // Without substances there's nothing to give an overview of.
  if (!rows.length) return { overview: "", items: [] }
  const overview = table(
    OVERVIEW_HEADERS,
    rows.map((row) => {
      const s = SUBSTANCE_BY_KEY.get(row.substance)
      return [
        productName(row),
        row.menge?.trim() || "x",
        sampleOf(row) || "x",
        row.einheit?.trim() || s?.units.join("/") || "x",
        row.anmerkung?.trim() || "N/A",
      ]
    }),
  )
  return {
    overview,
    items: rows.map((row) => ({
      title: `Analyseergebnisse (${SUBSTANCE_BY_KEY.get(row.substance)?.heading ?? productName(row)})`,
      body: resultLines(row, colors),
    })),
  }
}
