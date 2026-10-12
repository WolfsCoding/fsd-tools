export interface Note {
  id: string
  title: string
  /** Plain text of each DIN A4 page, in order. Always at least one. */
  pages: string[]
  /**
   * Indexes of pages that start after a manual page break ("Seite hinzufügen"); the other
   * pages continue the text of the one before. Missing in older notes, see `pageBreaks()`.
   */
  pageBreaks?: number[]
  createdAt: string
  updatedAt: string
}
