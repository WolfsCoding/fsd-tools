import { useMemo } from "react"
import { NavLink, useLocation, useNavigate } from "react-router"
import { BackButton } from "@/components/explorer"
import { NoResults } from "@/components/no-results"
import { SearchField } from "@/components/search-field"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useTabTitle } from "@/hooks/use-tabs"
import type { Book, Chapter } from "./data/types"
import { formatDollar, matchesOffense, OFFENSES, penaltyNotes, type Offense } from "./offenses"
import { Highlight } from "./paragraph-text"
import { catalogPath, LAW_BOOK_BASE, lawBookPath, type BackState } from "./paths"

interface Group {
  book: Book
  chapter: Chapter
  offenses: Offense[]
}

/** The offenses by chapter, in the order of the books. */
function groupOffenses(offenses: Offense[]): Group[] {
  const groups: Group[] = []
  for (const o of offenses) {
    const last = groups.at(-1)
    if (last?.chapter === o.chapter) last.offenses.push(o)
    else groups.push({ book: o.book, chapter: o.chapter, offenses: [o] })
  }
  return groups
}

const chapterAnchor = (book: Book, chapter: Chapter) =>
  `catalog-${book.id}-${chapter.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`

/** Every chargeable offense of CO and TO with its fine range and notes, as one searchable table across the whole page. */
export function PenaltyCatalog({ query, terms, onQuery }: { query: string; terms: string[]; onQuery: (q: string) => void }) {
  useTabTitle("Strafkatalog")
  const navigate = useNavigate()
  const { search } = useLocation()
  const all = useMemo(() => groupOffenses(OFFENSES), [])
  const offenses = useMemo(() => (terms.length ? OFFENSES.filter((o) => matchesOffense(o, terms)) : OFFENSES), [terms])
  // A paragraph opened from here leads back here, with the search.
  const back: BackState = { back: { pathname: catalogPath(), search }, backLabel: "Zurück zum Strafkatalog" }

  return (
    <div className="min-h-0 min-w-0 flex-1 scroll-pt-6 overflow-y-auto">
      <div className="grid gap-6 px-6 py-8">
        <header className="grid gap-3 border-b pb-6">
          <div className="flex items-center gap-2">
            <BackButton to={LAW_BOOK_BASE} label="Alle Gesetzbücher" className="-ml-2" />
            <Badge variant="secondary" className="w-fit">
              CO · TO
            </Badge>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Strafkatalog</h1>
          <p className="text-sm text-muted-foreground">
            Alle Straftaten aus Criminal und Ticket Offenses mit ihrem Strafmaß. Ein Klick öffnet den Paragraphen.
          </p>
          <SearchField value={query} onChange={onQuery} focusKey aria-label="Strafkatalog durchsuchen" />
          <nav aria-label="Kapitel" className="flex flex-wrap gap-1.5">
            {all.map((g) => {
              const shown = offenses.filter((o) => o.chapter === g.chapter).length
              const anchor = chapterAnchor(g.book, g.chapter)
              return (
                <Button
                  key={anchor}
                  variant="outline"
                  size="xs"
                  disabled={!shown}
                  onClick={() => document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                >
                  <span className="font-medium text-amber-400">{g.book.abbreviation}</span>
                  {g.chapter.title}
                  <span className="text-muted-foreground tabular-nums">{shown}</span>
                </Button>
              )
            })}
          </nav>
        </header>

        {offenses.length === 0 ? (
          <NoResults query={query} onReset={() => onQuery("")} />
        ) : (
          <div className="grid gap-3">
            {terms.length > 0 && (
              <p className="text-sm text-muted-foreground">{offenses.length === 1 ? "1 Treffer" : `${offenses.length} Treffer`}</p>
            )}
            <div className="overflow-hidden rounded-lg border bg-card">
              {/* Fixed columns leave Tatbestand the rest, so below this width it scrolls instead of vanishing. */}
              <Table className="min-w-256 table-fixed">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-40">Paragraph</TableHead>
                    <TableHead>Tatbestand</TableHead>
                    <TableHead className="w-44">Kapitel</TableHead>
                    <TableHead className="w-28 text-right">Min.</TableHead>
                    <TableHead className="w-28 text-right">Max.</TableHead>
                    <TableHead className="w-64">Anmerkungen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {offenses.map((o, i) => {
                    const to = lawBookPath(o.book.id, o.paragraph.number)
                    // The first row of a chapter is the target of the chapter list.
                    const first = offenses[i - 1]?.chapter !== o.chapter
                    return (
                      <TableRow
                        key={o.id}
                        id={first ? chapterAnchor(o.book, o.chapter) : undefined}
                        // The URL has no search, so the paragraph shows instead of the results.
                        onClick={() => navigate(to, { state: back })}
                        className="cursor-pointer"
                      >
                        <TableCell className="align-top">
                          <NavLink
                            to={to}
                            state={back}
                            onClick={(e) => e.stopPropagation()}
                            className="font-medium text-amber-400 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {o.ref}
                          </NavLink>
                        </TableCell>
                        <TableCell className="align-top whitespace-normal">
                          <Highlight text={o.title} terms={terms} />
                        </TableCell>
                        <TableCell className="align-top whitespace-normal text-muted-foreground">{o.chapter.title}</TableCell>
                        <TableCell className="text-right align-top tabular-nums">{o.fine ? formatDollar(o.fine.min) : "–"}</TableCell>
                        <TableCell className="text-right align-top tabular-nums">{o.fine ? formatDollar(o.fine.max) : "–"}</TableCell>
                        <TableCell className="align-top whitespace-normal text-muted-foreground">
                          {penaltyNotes(o).map((note) => (
                            <p key={note}>{note}</p>
                          ))}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
