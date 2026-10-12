// Value ranges like "15-30%" from the templates: shown as a hint, and rolled at random.

/** A span of typical values, e.g. a purity of 15 to 30 %. */
export interface Range {
  min: number
  max: number
  /** Decimal places of a rolled value, e.g. 2 for "0,03". */
  decimals: number
  /** Written after the value, e.g. "%". */
  unit?: string
}

export function range(min: number, max: number, decimals = 0, unit = "%"): Range {
  return { min, max, decimals, unit }
}

/** German number with a fixed number of decimals, e.g. "0,05". */
export function formatNumber(n: number, decimals: number) {
  return n.toLocaleString("de-DE", { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: false })
}

/** "0,05" or "0.05" as a number; NaN when there is none. */
export function parseNumber(s: string) {
  const m = /-?\d+(?:[.,]\d+)?/.exec(s)
  return m ? Number(m[0].replace(",", ".")) : Number.NaN
}

/** "15–30%" */
export function rangeLabel(r: Range) {
  return `${formatNumber(r.min, r.decimals)}–${formatNumber(r.max, r.decimals)}${r.unit ?? ""}`
}

/** A random value within the range, at its precision. */
export function roll(r: Range) {
  const step = 10 ** -r.decimals
  const steps = Math.round((r.max - r.min) / step)
  return formatNumber(r.min + Math.floor(Math.random() * (steps + 1)) * step, r.decimals)
}

/** What's left to 100 % of an entered share, e.g. "23" → "77"; "" while none is entered. */
export function remainder(value: string, decimals: number) {
  const n = parseNumber(value)
  return Number.isNaN(n) ? "" : formatNumber(Math.max(0, 100 - n), decimals)
}

/** The value with its unit, unless it was typed with one. */
export function withUnit(value: string, unit = "") {
  const v = value.trim()
  return !unit || v.endsWith(unit) ? v : `${v}${unit}`
}

/** `count` different items of `items`, in their original order. */
export function pickSome<T>(items: T[], count: number) {
  const picked = new Set<T>()
  while (picked.size < Math.min(count, items.length)) picked.add(items[Math.floor(Math.random() * items.length)])
  return items.filter((i) => picked.has(i))
}

/** A whole number from `min` to `max`. */
export function randomInt(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1))
}
