import { useCallback, useLayoutEffect, useMemo, useRef } from "react"
import { Navigate, NavLink, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router"
import { CalculatorIcon, ListIcon, ScaleIcon, StarIcon } from "lucide-react"
import { cn } from "cn"
import { Hint } from "@/components/hint"
import { NoResults } from "@/components/no-results"
import { SidePanel } from "@/components/side-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useRegisterCommands, type CommandGroupDef } from "@/hooks/use-command-palette"
import { useTabTitle } from "@/hooks/use-tabs"
import { useBookmarks } from "./bookmarks"
import { ChargeCalculator } from "./charge-calculator"
import { books } from "./data/books"
import type { Book, Chapter, Paragraph } from "./data/types"
import { citation, containsTerm, matchesParagraph, parseQuery } from "./offenses"
import { CopyCitation, Highlight, ParagraphNumber, ParagraphText } from "./paragraph-text"
import { LawBookNav } from "./law-book-nav"
import { PenaltyCatalog } from "./penalty-catalog"
import { calculatorPath, catalogPath, lawBookPath, paragraphAnchor } from "./paths"

/** Opened when no book is chosen: the one most needed on duty. */
const DEFAULT_BOOK = "co"

interface Hit {
  book: Book
  chapter: Chapter
  paragraph: Paragraph
}

/** Paragraphs of every book containing all terms: exact § number first, then title matches, then text matches. */
function search(terms: string[]): Hit[] {
  const ranked: { hit: Hit; rank: number }[] = []
  for (const book of books) {
    for (const chapter of book.chapters) {
      for (const paragraph of chapter.paragraphs) {
        if (!matchesParagraph(book, paragraph, terms)) continue
        const number = String(paragraph.number)
        const rank = terms.some((t) => t === number || t === `§${number}`) ? 0 : terms.some((t) => containsTerm(paragraph.title, t)) ? 1 : 2
        ranked.push({ hit: { book, chapter, paragraph }, rank })
      }
    }
  }
  return ranked.sort((a, b) => a.rank - b.rank).map((r) => r.hit)
}

function scrollToParagraph(bookId: string, number: number, behavior: ScrollBehavior = "smooth") {
  document.getElementById(paragraphAnchor(bookId, number))?.scrollIntoView({ behavior, block: "start" })
}

export function LawBookPage() {
  const navigate = useNavigate()
  // The search is part of the URL (`?q=`), so reloading and going back keep it, and every
  // link to a book or paragraph ends it.
  const [params, setParams] = useSearchParams()
  const query = params.get("q") ?? ""
  const setQuery = useCallback(
    (q: string) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (q) next.set("q", q)
          else next.delete("q")
          return next
        },
        { replace: true },
      ),
    [setParams],
  )
  const terms = useMemo(() => parseQuery(query), [query])

  const commandGroups = useMemo<CommandGroupDef[]>(
    () => [
      {
        heading: "Gesetzbuch",
        actionLabel: "Paragraph öffnen",
        items: [
          {
            id: "law-book:catalog",
            label: "Strafkatalog",
            keywords: ["Strafmaß", "Geldstrafe", "Bußgeld", "Criminal Offenses", "Ticket Offenses"],
            icon: ListIcon,
            onSelect: () => navigate(catalogPath()),
          },
          {
            id: "law-book:calculator",
            label: "Strafrechner",
            keywords: ["Straftaten", "Strafmaß", "Geldstrafe", "Rechner", "Summe"],
            icon: CalculatorIcon,
            onSelect: () => navigate(calculatorPath()),
          },
          ...books.flatMap((book) =>
            book.chapters.flatMap((chapter) =>
              chapter.paragraphs.map((p) => ({
                id: `law-book:${book.id}:${p.number}`,
                label: `§ ${p.number} ${book.abbreviation} ${p.title}`,
                keywords: [book.title, chapter.title],
                icon: ScaleIcon,
                hint: book.abbreviation,
                onSelect: () => navigate(lawBookPath(book.id, p.number)),
              })),
            ),
          ),
        ],
      },
    ],
    [navigate],
  )
  useRegisterCommands("law-book", commandGroups)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Routes>
        <Route index element={<Navigate to={lawBookPath(DEFAULT_BOOK)} replace />} />
        <Route path="strafkatalog" element={<PenaltyCatalog query={query} terms={terms} onQuery={setQuery} />} />
        <Route path="rechner" element={<ChargeCalculator />} />
        <Route path=":bookId/:paragraph?" element={<BookRoute query={query} terms={terms} onQuery={setQuery} />} />
      </Routes>
    </div>
  )
}

/** Resolves `:bookId`; unknown books go to the default one. */
function BookRoute({ query, terms, onQuery }: { query: string; terms: string[]; onQuery: (q: string) => void }) {
  const { bookId, paragraph } = useParams()
  const book = books.find((b) => b.id === bookId)
  useTabTitle(book ? `${book.title} (${book.abbreviation})` : undefined)
  if (!book) return <Navigate to={lawBookPath(DEFAULT_BOOK)} replace />
  const number = paragraph === undefined ? undefined : Number(paragraph)
  return <BookView book={book} paragraph={number} query={query} terms={terms} onQuery={onQuery} />
}

function BookView({
  book,
  paragraph,
  query,
  terms,
  onQuery,
}: {
  book: Book
  paragraph?: number
  query: string
  terms: string[]
  onQuery: (q: string) => void
}) {
  const mainRef = useRef<HTMLElement>(null)
  const searching = terms.length > 0
  const hits = useMemo(() => (searching ? search(terms) : []), [searching, terms])
  const bookmarks = useBookmarks()

  // Opening a book starts at the top; opening a paragraph scrolls to it.
  useLayoutEffect(() => {
    if (searching) return
    if (paragraph === undefined) mainRef.current?.scrollTo({ top: 0 })
    else scrollToParagraph(book.id, paragraph, "instant")
  }, [book.id, paragraph, searching])

  return (
    <>
      <SidePanel title="Gesetzbücher" mobileClassName="max-h-[40%] border-b">
        <LawBookNav active={book.id} query={query} onQuery={onQuery} />
        <nav aria-label="Paragraphen" className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <p className="px-2 pb-2 text-sm font-medium">{book.title}</p>
          {book.chapters.map((chapter) => (
            <div key={chapter.title} className="mb-3 last:mb-0">
              <p className="px-2 pt-1 pb-1.5 text-xs font-medium text-muted-foreground">{chapter.title}</p>
              {chapter.paragraphs.map((p) => (
                <NavLink
                  key={p.number}
                  to={lawBookPath(book.id, p.number)}
                  onClick={() => {
                    // Same route again (after scrolling away) wouldn't scroll by itself.
                    if (p.number === paragraph && !searching) scrollToParagraph(book.id, p.number)
                  }}
                  className="flex h-8 items-center gap-2 rounded-md px-2 text-sm text-foreground/80 outline-none hover:bg-accent/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-accent aria-[current=page]:font-medium aria-[current=page]:text-foreground"
                >
                  <ParagraphNumber number={p.number} className="w-10 shrink-0 text-xs" />
                  <span className="truncate">{p.title}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </SidePanel>

      <main ref={mainRef} className="min-h-0 min-w-0 flex-1 scroll-pt-6 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-8">
          {searching ? (
            <SearchResults hits={hits} query={query} terms={terms} bookmarks={bookmarks} onReset={() => onQuery("")} />
          ) : (
            <article>
              <header className="mb-6 grid gap-2 border-b pb-6">
                <Badge variant="secondary" className="w-fit">
                  {book.abbreviation}
                </Badge>
                <h1 className="text-2xl font-semibold tracking-tight">{book.title}</h1>
              </header>
              {book.chapters.map((chapter) => (
                <section key={chapter.title} className="mb-10 last:mb-0">
                  <h2 className="mb-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">{chapter.title}</h2>
                  <div className="grid gap-3">
                    {chapter.paragraphs.map((p) => (
                      <ParagraphCard
                        key={p.number}
                        book={book}
                        paragraph={p}
                        active={p.number === paragraph}
                        bookmarked={bookmarks.has(book, p)}
                        onBookmark={() => bookmarks.toggle(book, p)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </article>
          )}
        </div>
      </main>
    </>
  )
}

function ParagraphCard({
  book,
  paragraph,
  terms = [],
  context,
  to,
  active,
  bookmarked,
  onBookmark,
}: {
  book: Book
  paragraph: Paragraph
  terms?: string[]
  /** e.g. "CO · Severe Crimes"; only in search results. */
  context?: string
  /** Makes the whole card a link, e.g. in search results; its buttons still work. */
  to?: string
  active?: boolean
  bookmarked: boolean
  onBookmark: () => void
}) {
  const title = (
    <>
      <ParagraphNumber number={paragraph.number} /> <Highlight text={paragraph.title} terms={terms} />
    </>
  )
  const cite = citation(book, paragraph)
  return (
    <div
      id={context ? undefined : paragraphAnchor(book.id, paragraph.number)}
      className={cn(
        "relative grid gap-3 rounded-lg border bg-card p-4",
        active && "border-amber-400/40",
        to && "has-[h3>a:hover]:border-foreground/20",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="grid min-w-0 flex-1 gap-1">
          {context && <p className="text-xs text-muted-foreground">{context}</p>}
          <h3 className="text-base font-semibold">
            {to ? (
              // The link stretches over the card; the buttons sit above it.
              <NavLink
                to={to}
                className="outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-ring"
              >
                {title}
              </NavLink>
            ) : (
              title
            )}
          </h3>
        </div>
        <div className="relative z-10 -my-1 flex shrink-0 items-center gap-0.5">
          <CopyCitation text={cite} onHover={false} />
          <Hint label={bookmarked ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onBookmark}
              aria-pressed={bookmarked}
              aria-label={`${cite} als Favorit`}
              className={cn("text-muted-foreground hover:text-foreground", bookmarked && "text-amber-400 hover:text-amber-300")}
            >
              <StarIcon className={cn(bookmarked && "fill-current")} />
            </Button>
          </Hint>
        </div>
      </div>
      <ParagraphText paragraph={paragraph} book={book} terms={terms} className="text-sm text-foreground/85" />
    </div>
  )
}

function SearchResults({
  hits,
  query,
  terms,
  bookmarks,
  onReset,
}: {
  hits: Hit[]
  query: string
  terms: string[]
  bookmarks: ReturnType<typeof useBookmarks>
  onReset: () => void
}) {
  if (hits.length === 0) return <NoResults query={query} onReset={onReset} />
  return (
    <section>
      <p className="mb-4 text-sm text-muted-foreground">{hits.length === 1 ? "1 Treffer" : `${hits.length} Treffer`}</p>
      <div className="grid gap-3">
        {hits.map(({ book, chapter, paragraph }) => (
          <ParagraphCard
            key={`${book.id}-${paragraph.number}`}
            book={book}
            paragraph={paragraph}
            terms={terms}
            context={`${book.abbreviation} · ${chapter.title}`}
            to={lawBookPath(book.id, paragraph.number)}
            bookmarked={bookmarks.has(book, paragraph)}
            onBookmark={() => bookmarks.toggle(book, paragraph)}
          />
        ))}
      </div>
    </section>
  )
}
