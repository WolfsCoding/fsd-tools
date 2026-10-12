export function pageCount(total: number, pageSize: number) {
  return Math.max(1, Math.ceil(total / pageSize))
}

/** First, last, and current ±1, with ellipses for the gaps. */
export function pageItems(page: number, pages: number): (number | "…")[] {
  const shown = new Set([1, pages, page - 1, page, page + 1])
  const items: (number | "…")[] = []
  let prev = 0
  for (let p = 1; p <= pages; p++) {
    if (!shown.has(p)) continue
    if (p - prev > 2) items.push("…")
    else if (p - prev === 2) items.push(p - 1)
    items.push(p)
    prev = p
  }
  return items
}
