// Copied from the law-book app (hs-apps/law-book/src/data); keep both in sync.

/** One paragraph (§) with its sections (Absätze). */
export interface Paragraph {
  number: number
  title: string
  /** Sections in order; index 0 is Abs. 1. Line breaks are allowed for numbered lists. */
  sections: string[]
}

/** A chapter of a book, e.g. "Traffic Offenses". */
export interface Chapter {
  title: string
  paragraphs: Paragraph[]
}

export interface Book {
  id: string
  title: string
  /** Short form, e.g. "TO". */
  abbreviation: string
  chapters: Chapter[]
}
