import { useMemo } from "react"
import { NavLink, useNavigate } from "react-router"
import { NoResults } from "@/components/no-results"
import { SidePanel } from "@/components/side-panel"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useTabTitle } from "@/hooks/use-tabs"
import type { Book, Chapter } from "./data/types"
import { LawBookNav } from "./law-book-nav"
import { formatDollar, matchesOffense, OFFENSES, penaltyNotes, type Offense } from "./offenses"
import { Highlight } from "./paragraph-text"
import { lawBookPath } from "./paths"

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
  const all = useMemo(() => groupOffenses(OFFENSES), [])
  const offenses = useMemo(() => (terms.length ? OFFENSES.filter((o) => matchesOffense(o, terms)) : OFFENSES), [terms])

  return (
    <>
      <SidePanel title="Gesetzbücher" mobileClassName="max-h-[40%] border-b">
        <LawBookNav active="catalog" query={query} onQuery={onQuery} placeholder="Straftat, § 4 CO, Waffe…" />
        <nav aria-label="Kapitel" className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <p className="px-2 pb-2 text-sm font-medium">Strafkatalog</p>
          {all.map((g) => {
            const shown = offenses.filter((o) => o.chapter === g.chapter).length
            const anchor = chapterAnchor(g.book, g.chapter)
            return (
              <button
                key={anchor}
                type="button"
                disabled={!shown}
                onClick={() => document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-foreground/80 outline-none hover:bg-accent/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
              >
                <span className="w-8 shrink-0 text-xs font-medium text-amber-400">{g.book.abbreviation}</span>
                <span className="flex-1 truncate">{g.chapter.title}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{shown}</span>
              </button>
            )
          })}
        </nav>
      </SidePanel>

      <main className="min-h-0 min-w-0 flex-1 scroll-pt-6 overflow-y-auto">
        <div className="grid gap-6 px-6 py-8">
          <header className="grid gap-2 border-b pb-6">
            <Badge variant="secondary" className="w-fit">
              CO · TO
            </Badge>
            <h1 className="text-2xl font-semibold tracking-tight">Strafkatalog</h1>
            <p className="text-sm text-muted-foreground">
              Alle Straftaten aus Criminal und Ticket Offenses mit ihrem Strafmaß. Ein Klick öffnet den Paragraphen.
            </p>
          </header>

          {offenses.length === 0 ? (
            <NoResults query={query} onReset={() => onQuery("")} />
          ) : (
            <div className="grid gap-3">
              {terms.length > 0 && (
                <p className="text-sm text-muted-foreground">{offenses.length === 1 ? "1 Treffer" : `${offenses.length} Treffer`}</p>
              )}
              <div className="overflow-hidden rounded-lg border bg-card">
                <Table className="table-fixed">
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
                          onClick={() => navigate(to)}
                          className="cursor-pointer"
                        >
                          <TableCell className="align-top">
                            <NavLink
                              to={to}
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
      </main>
    </>
  )
}
