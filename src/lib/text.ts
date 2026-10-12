/** Normalized form for comparing user-typed labels: trimmed, case-insensitive. */
export function textKey(text: string) {
  return text.trim().toLocaleLowerCase("de-DE")
}

/** Whether two user-typed labels mean the same thing, ignoring case and outer spaces. */
export function sameText(a: string, b: string) {
  return textKey(a) === textKey(b)
}

/**
 * Whether `query` appears as a whole word in `text`, e.g. "to" finds "TO § 14" but
 * not "Totschlag". Meant for short abbreviation-style queries.
 */
export function matchesWord(text: string, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "iu").test(text)
}
