/** Route prefix of the law books; must match its `path` in the registry. */
export const LAW_BOOK_BASE = "/law-book"

/** A book, or one of its paragraphs scrolled into view. */
export function lawBookPath(bookId: string, paragraph?: number) {
  return paragraph === undefined ? `${LAW_BOOK_BASE}/${bookId}` : `${LAW_BOOK_BASE}/${bookId}/${paragraph}`
}

/** Element id of a paragraph on the page. */
export function paragraphAnchor(bookId: string, paragraph: number) {
  return `law-${bookId}-p${paragraph}`
}

/** The Strafkatalog: every chargeable offense with its penalty. */
export function catalogPath() {
  return `${LAW_BOOK_BASE}/strafkatalog`
}

/** The Strafrechner: charges added up outside of a case file. */
export function calculatorPath() {
  return `${LAW_BOOK_BASE}/rechner`
}
