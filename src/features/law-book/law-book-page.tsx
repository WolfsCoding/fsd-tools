import { useCallback, useLayoutEffect, useMemo, useRef, type ReactNode } from "react"
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from "react-router"
import { CalculatorIcon, ListIcon, ScaleIcon, StarIcon, StarOffIcon } from "lucide-react"
import { cn } from "cn"
import { BackButton, Explorer, EXPLORER_LIST, EXPLORER_ROW } from "@/components/explorer"
import { Hint } from "@/components/hint"
import { NoResults } from "@/components/no-results"
import { SearchField } from "@/components/search-field"
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
import { PenaltyCatalog } from "./penalty-catalog"
import { calculatorPath, catalogPath, LAW_BOOK_BASE, lawBookPath, paragraphAnchor, type BackState } from "./paths"

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
  // The search is part of the URL (`?q=`), so reloading and going back keep it. The hits keep it
  // in their links, so the paragraph opened from them marks the terms and leads back to the hits.
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
        <Route index element={<LawBookExplorer query={query} terms={terms} onQuery={setQuery} />} />
        <Route path="strafkatalog" element={<PenaltyCatalog query={query} terms={terms} onQuery={setQuery} />} />
        <Route path="rechner" element={<ChargeCalculator />} />
        <Route path=":bookId/:paragraph?" element={<BookRoute terms={terms} />} />
      </Routes>
    </div>
  )
}

const paragraphCount = (book: Book) => book.chapters.reduce((n, c) => n + c.paragraphs.length, 0)

/** The books, the Strafkatalog and Strafrechner, and the bookmarked paragraphs; searching shows the hits instead. */
function LawBookExplorer({ query, terms, onQuery }: { query: string; terms: string[]; onQuery: (q: string) => void }) {
  const bookmarks = useBookmarks()
  const searching = terms.length > 0
  const hits = useMemo(() => (searching ? search(terms) : []), [searching, terms])

  return (
    <Explorer
      title="Gesetzbücher"
      toolbar={
        <SearchField
          value={query}
          onChange={onQuery}
          focusKey
          placeholder="§ 5, Diebstahl, Geldstrafe…"
          aria-label="Gesetzbücher durchsuchen"
        />
      }
    >
      {searching ? (
        <SearchResults hits={hits} query={query} terms={terms} bookmarks={bookmarks} onReset={() => onQuery("")} />
      ) : (
        <div className="grid gap-4">
          <ExplorerSection title="Bücher">
            {books.map((b) => (
              <Link key={b.id} to={lawBookPath(b.id)} className={EXPLORER_ROW}>
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span className="w-7 shrink-0 text-xs font-semibold text-amber-400">{b.abbreviation}</span>
                  <span className="truncate">{b.title}</span>
                </span>
                <span className="text-xs text-muted-foreground/70">
                  {b.chapters.length} Kapitel · {paragraphCount(b)} Paragraphen
                </span>
              </Link>
            ))}
          </ExplorerSection>
          <ExplorerSection title="Werkzeuge">
            <Link to={catalogPath()} className={EXPLORER_ROW}>
              <span className="flex items-center gap-2 text-sm font-medium">
                <ListIcon className="size-4 shrink-0 text-muted-foreground" />
                Strafkatalog
              </span>
              <span className="text-xs text-muted-foreground/70">Alle Straftaten aus CO und TO mit Strafmaß</span>
            </Link>
            <Link to={calculatorPath()} className={EXPLORER_ROW}>
              <span className="flex items-center gap-2 text-sm font-medium">
                <CalculatorIcon className="size-4 shrink-0 text-muted-foreground" />
                Strafrechner
              </span>
              <span className="text-xs text-muted-foreground/70">Straftaten zusammenrechnen, ohne Akte</span>
            </Link>
          </ExplorerSection>
          {bookmarks.bookmarks.length > 0 && (
            <ExplorerSection title="Favoriten">
              {bookmarks.bookmarks.map(({ id, book, paragraph }) => (
                <div key={id} className="group/bookmark relative">
                  <Link to={lawBookPath(book.id, paragraph.number)} className={EXPLORER_ROW}>
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <ParagraphNumber number={paragraph.number} className="shrink-0 text-xs" />
                      <span className="shrink-0 text-xs text-muted-foreground">{book.abbreviation}</span>
                      <span className="truncate">{paragraph.title}</span>
                    </span>
                  </Link>
                  <Hint label="Aus Favoriten entfernen">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => bookmarks.remove(id)}
                      aria-label={`§ ${paragraph.number} ${book.abbreviation} aus Favoriten entfernen`}
                      className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground opacity-0 group-hover/bookmark:opacity-100 focus-visible:opacity-100 hover:text-foreground"
                    >
                      <StarOffIcon />
                    </Button>
                  </Hint>
                </div>
              ))}
            </ExplorerSection>
          )}
        </div>
      )}
    </Explorer>
  )
}

function ExplorerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-1.5">
      <h2 className="px-1 text-xs font-medium text-muted-foreground">{title}</h2>
      <nav aria-label={title} className={EXPLORER_LIST}>
        {children}
      </nav>
    </section>
  )
}

/** Resolves `:bookId`; unknown books go back to the explorer. */
function BookRoute({ terms }: { terms: string[] }) {
  const { bookId, paragraph } = useParams()
  const book = books.find((b) => b.id === bookId)
  useTabTitle(book ? `${book.title} (${book.abbreviation})` : undefined)
  if (!book) return <Navigate to={LAW_BOOK_BASE} replace />
  const number = paragraph === undefined ? undefined : Number(paragraph)
  return <BookView book={book} paragraph={number} terms={terms} />
}

function BookView({ book, paragraph, terms }: { book: Book; paragraph?: number; terms: string[] }) {
  const mainRef = useRef<HTMLElement>(null)
  const bookmarks = useBookmarks()
  // Opened from the hits, the search is still in the URL and leads back to them.
  const { search, state } = useLocation()
  const from = state as BackState | null

  // Opening a book starts at the top; opening a paragraph scrolls to it.
  useLayoutEffect(() => {
    if (paragraph === undefined) mainRef.current?.scrollTo({ top: 0 })
    else scrollToParagraph(book.id, paragraph, "instant")
  }, [book.id, paragraph])

  return (
    <main ref={mainRef} className="min-h-0 min-w-0 flex-1 scroll-pt-6 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <article>
          <header className="mb-6 grid gap-2 border-b pb-6">
            <div className="flex items-center gap-2">
              <BackButton
                to={from?.back ?? { pathname: LAW_BOOK_BASE, search }}
                label={from?.backLabel ?? (terms.length ? "Zurück zu den Treffern" : "Alle Gesetzbücher")}
                className="-ml-2"
              />
              <Badge variant="secondary" className="w-fit">
                {book.abbreviation}
              </Badge>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{book.title}</h1>
            {/* The chapters, now that the paragraph list is no longer beside the book. */}
            <nav aria-label="Kapitel" className="flex flex-wrap gap-1.5 pt-2">
              {book.chapters.map((chapter) => {
                const first = chapter.paragraphs[0]
                if (!first) return null
                return (
                  <Button key={chapter.title} asChild variant="outline" size="xs">
                    <NavLink
                      to={{ pathname: lawBookPath(book.id, first.number), search }}
                      state={from}
                      replace
                      onClick={() => {
                        // Same route again (after scrolling away) wouldn't scroll by itself.
                        if (first.number === paragraph) scrollToParagraph(book.id, first.number)
                      }}
                    >
                      {chapter.title}
                    </NavLink>
                  </Button>
                )
              })}
            </nav>
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
                    terms={terms}
                    active={p.number === paragraph}
                    bookmarked={bookmarks.has(book, p)}
                    onBookmark={() => bookmarks.toggle(book, p)}
                  />
                ))}
              </div>
            </section>
          ))}
        </article>
      </div>
    </main>
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
            to={`${lawBookPath(book.id, paragraph.number)}?${new URLSearchParams({ q: query })}`}
            bookmarked={bookmarks.has(book, paragraph)}
            onBookmark={() => bookmarks.toggle(book, paragraph)}
          />
        ))}
      </div>
    </section>
  )
}
