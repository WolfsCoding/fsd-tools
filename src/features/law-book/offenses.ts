import { matchesWord } from "@/lib/text"
import { books } from "./data/books"
import type { Book, Chapter, Paragraph } from "./data/types"
import { OFFENSE_NAMES } from "./offense-names"

/** Books whose sections can be charged; the procedure books only explain. */
const PENAL_BOOKS = ["co", "to"]

/** Sections of the procedure books that are charged nonetheless, by offense id. */
const PENAL_SECTIONS = ["lp-39-3"]

export interface Fine {
  min: number
  max: number
}

/** One chargeable section (Absatz) of a law, or one item of a section's tier list. */
export interface Offense {
  /**
   * The citation as "<book>-<§>-<Abs.>[-<Nr.>]", e.g. "co-4-1", or "to-17-2-1" for the first
   * tier of § 17 Abs. 2 TO. Never a position in the list, so saved charges keep pointing at
   * the same Absatz when offenses are added or removed elsewhere in the books.
   */
  id: string
  book: Book
  chapter: Chapter
  paragraph: Paragraph
  /** Index of the section; 0 is Abs. 1. */
  section: number
  /** e.g. "§ 4 Abs. 1 CO" or "§ 17 Abs. 2 Nr. 1 TO". */
  ref: string
  /** Short name of this offense from `OFFENSE_NAMES`, else the paragraph's title (plus the tier for tier lists). */
  title: string
  /** The section's wording, i.e. the definition of the offense. */
  text: string
  /** The wording of this offense alone: the section, or for tier lists the tier's line. */
  excerpt: string
  fine?: Fine
  /** The fine is per unit, e.g. "Einheit"; multiplied by the quantity. */
  per?: string
  /** Added per item on top of the fine, e.g. 100 $ per weapon. */
  extra?: { amount: number; per: string }
  /** A penalty besides (or instead of) the fine, e.g. "Haft bis lebenslang". */
  other?: string
}

const NUM = String.raw`(\d{1,3}(?:\.\d{3})+|\d+)`
const RANGE = new RegExp(String.raw`${NUM}\s*(?:Dollar\s*)?bis\s*${NUM}\s*(?:Dollar|\$)`)
const SINGLE = new RegExp(String.raw`${NUM}\s*(?:Dollar|\$)`)
const EXTRA = new RegExp(String.raw`${NUM}\s*(?:Dollar|\$)\s+(?:pro|je)\s+([\p{L} ]+?)\s*(?=[,.]|$)`, "u")
const PER = /^\s*(?:pro|je)\s+(\p{L}+)/u
const SAME_AS = /gemäß Absatz (\d+)/

const amount = (s: string) => Number(s.replace(/\./g, ""))

type Penalty = Pick<Offense, "fine" | "per" | "extra" | "other">

/** The penalty a section's wording sets; empty if it sets none. */
function parsePenalty(text: string): Penalty {
  const penalty: Penalty = {}
  const range = RANGE.exec(text)
  if (range) {
    penalty.fine = { min: amount(range[1]), max: amount(range[2]) }
    const rest = text.slice(range.index + range[0].length)
    penalty.per = PER.exec(rest)?.[1]
    const extra = EXTRA.exec(rest)
    if (extra) penalty.extra = { amount: amount(extra[1]), per: extra[2] }
  } else {
    const single = SINGLE.exec(text)
    if (single) penalty.fine = { min: amount(single[1]), max: amount(single[1]) }
  }

  const other = [
    /lebenslang/.test(text) && "Haft bis lebenslang",
    /Abschiebung|aus dem Staat ausgewiesen/.test(text) && "Ausweisung",
    /Zugang zu .* eingeschränkt/.test(text) && "Zonenverbot",
    /Führerscheinentzug/.test(text) && "Führerscheinentzug",
  ].filter(Boolean)
  if (other.length) penalty.other = other.join(" / ")
  return penalty
}

const hasPenalty = (p: Penalty) => !!(p.fine || p.other)

/** Items of a numbered list in a section, e.g. the tiers of a speeding fine: "1. 1 km/h bis 20 km/h auf 25 $,". */
function listItems(text: string) {
  return text
    .split("\n")
    .flatMap((line) => {
      const m = /^(\d+)\.\s+(.*?)[,.]?$/.exec(line.trim())
      return m ? [{ number: Number(m[1]), text: m[2] }] : []
    })
}

function buildOffenses(): Offense[] {
  const offenses: Offense[] = []
  for (const book of books) {
    for (const chapter of book.chapters) {
      for (const paragraph of chapter.paragraphs) {
        const penalties = paragraph.sections.map(parsePenalty)
        paragraph.sections.forEach((text, section) => {
          const id = `${book.id}-${paragraph.number}-${section + 1}`
          if (!PENAL_BOOKS.includes(book.id) && !PENAL_SECTIONS.includes(id)) return
          const base = {
            book,
            chapter,
            paragraph,
            section,
            text,
            excerpt: text,
            title: paragraph.title,
            ref: citation(book, paragraph, section),
            id,
          }

          // A tier list where every tier has its own fine becomes one offense per tier.
          const tiers = listItems(text).map((item) => ({ item, penalty: parsePenalty(item.text) }))
          if (tiers.length > 1 && tiers.every((t) => t.penalty.fine)) {
            for (const { item, penalty } of tiers) {
              offenses.push({
                ...base,
                ...penalty,
                id: `${base.id}-${item.number}`,
                excerpt: item.text,
                ref: `§ ${paragraph.number} Abs. ${section + 1} Nr. ${item.number} ${book.abbreviation}`,
                // The tier without its amount, e.g. "21 km/h bis 40 km/h".
                title: `${paragraph.title}: ${item.text.replace(/\s*(?:auf|von)\s+[\d.]+\s*\$\s*/, " ").trim()}`,
              })
            }
            return
          }

          // "wird gemäß Absatz 1 bestraft" takes the penalty of that section.
          const sameAs = SAME_AS.exec(text)
          const penalty = sameAs && !hasPenalty(penalties[section]) ? penalties[Number(sameAs[1]) - 1] : penalties[section]
          if (penalty && hasPenalty(penalty)) offenses.push({ ...base, ...penalty })
        })
      }
    }
  }
  return offenses.map((o) => ({ ...o, title: OFFENSE_NAMES[o.id] ?? o.title }))
}

export const OFFENSES = buildOffenses()
export const OFFENSE_BY_ID = new Map(OFFENSES.map((o) => [o.id, o]))

/**
 * The offense a saved id stands for. Also takes ids written differently ("CO-14-3",
 * "co 14 3"), and the id of a tier ("to-17-2-1") whose Absatz no longer has tiers.
 */
export function resolveOffense(id: unknown): Offense | undefined {
  if (typeof id !== "string") return undefined
  const exact = OFFENSE_BY_ID.get(id)
  if (exact) return exact
  const [book, ...numbers] = id.trim().toLowerCase().split(/[\s\-_.:/]+/).filter(Boolean)
  const bookId = books.find((b) => b.id === book || b.abbreviation.toLowerCase() === book)?.id
  if (!bookId || numbers.length < 2 || numbers.some((n) => !/^\d+$/.test(n))) return undefined
  const normalized = [bookId, ...numbers.map(Number)].join("-")
  return OFFENSE_BY_ID.get(normalized) ?? (numbers.length > 2 ? OFFENSE_BY_ID.get(normalized.replace(/-\d+$/, "")) : undefined)
}

/** How a paragraph or one of its Absätze is cited, e.g. "§ 14 TO" or "§ 14 Abs. 3 TO". */
export function citation(book: Book, paragraph: Paragraph, section?: number) {
  return section === undefined
    ? `§ ${paragraph.number} ${book.abbreviation}`
    : `§ ${paragraph.number} Abs. ${section + 1} ${book.abbreviation}`
}

/** "3.500 $" */
export function formatDollar(n: number) {
  return `${n.toLocaleString("de-DE")} $`
}

/** "3.500 – 6.500 $", or "100 $" when both are the same. */
export function formatFine({ min, max }: Fine) {
  return min === max ? formatDollar(min) : `${min.toLocaleString("de-DE")} – ${formatDollar(max)}`
}

/** Everything of the penalty besides the fine's range, one note each, e.g. ["Geldstrafe je Einheit"] or ["Haft bis lebenslang", "Ausweisung"]. */
export function penaltyNotes(o: Offense) {
  return [
    o.per && `Geldstrafe je ${o.per}`,
    o.extra && `+ ${formatDollar(o.extra.amount)} je ${o.extra.per}`,
    ...(o.other?.split(" / ") ?? []),
  ].filter((n): n is string => !!n)
}

/** Whether the offense needs a quantity, e.g. units of narcotics or the number of weapons. */
export const needsQuantity = (o: Offense) => !!(o.per || o.extra)

/** What the quantity counts, e.g. "Einheit" or "unerlaubter Waffe". */
export const quantityLabel = (o: Offense) => o.per ?? o.extra?.per ?? ""

const ABBREVIATIONS = new Set<string>(books.map((b) => b.abbreviation.toLowerCase()))

/**
 * Whether a term only matches whole words: book abbreviations and other terms of one or
 * two letters, so "to" finds "TO" but not "Totschlag".
 */
export const isWordTerm = (term: string) => term.length <= 2 || ABBREVIATIONS.has(term.toLowerCase())

/** Whether `text` contains the term; whole words only for `isWordTerm` terms. */
export function containsTerm(text: string, term: string) {
  return isWordTerm(term) ? matchesWord(text, term) : text.toLowerCase().includes(term)
}

/**
 * Search terms of a query; "§ 5" becomes "§5", which only matches paragraph 5, and
 * "Abs. 3" / "Nr. 1" of a citation (a query with a §) become "abs3" / "nr1". Without a §, "gemäß Absatz 1"
 * stays words of the text. Book abbreviations like "co" match the book.
 */
export function parseQuery(query: string): string[] {
  const lower = query.toLowerCase()
  const citation = lower.includes("§")
  return lower
    .replace(/§\s*(\d+)/g, "§$1")
    .replace(/§(?!\d)/g, " ")
    .replace(/(?<![\p{L}\p{N}])(abs|nr)(?:atz)?\.?\s*(\d+)/gu, (match, part, n) => (citation ? ` ${part}${n} ` : match))
    .split(/\s+/)
    .filter(Boolean)
}

const CITATION_PART = /^(abs|nr)(\d+)$/

/** Whether the term is part of a citation ("§5", "abs3", "nr1") rather than a word of the text. */
export const isCitationTerm = (term: string) => term.startsWith("§") || CITATION_PART.test(term)

/** Whether the paragraph contains every term; "§5" and bare numbers match its number, "abs3" a paragraph with an Abs. 3. */
export function matchesParagraph(book: Book, paragraph: Paragraph, terms: string[], text = `${paragraph.title} ${paragraph.sections.join(" ")}`) {
  const haystack = `${book.abbreviation} ${text}`
  const number = String(paragraph.number)
  return terms.every((t) => {
    if (t.startsWith("§")) return t.slice(1) === number
    const part = CITATION_PART.exec(t)
    if (part) return part[1] === "nr" || Number(part[2]) <= paragraph.sections.length
    return t === number || containsTerm(haystack, t)
  })
}

export function matchesOffense(o: Offense, terms: string[]) {
  const [, , abs, nr] = o.id.split("-")
  return (
    terms.every((t) => {
      const part = CITATION_PART.exec(t)
      return !part || part[2] === (part[1] === "abs" ? abs : nr)
    }) && matchesParagraph(o.book, o.paragraph, terms, `${o.ref} ${o.title} ${o.paragraph.title} ${o.text}`)
  )
}
