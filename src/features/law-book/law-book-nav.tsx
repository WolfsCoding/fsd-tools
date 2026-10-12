import { NavLink } from "react-router"
import { CalculatorIcon, ListIcon, StarOffIcon } from "lucide-react"
import { Hint } from "@/components/hint"
import { SearchField } from "@/components/search-field"
import { Button } from "@/components/ui/button"
import { useBookmarks } from "./bookmarks"
import { books } from "./data/books"
import { ParagraphNumber } from "./paragraph-text"
import { calculatorPath, catalogPath, lawBookPath } from "./paths"

/**
 * Search, the books, the Strafkatalog and Strafrechner, and the bookmarked paragraphs; top of
 * the side panel on every law book page. Links drop the search, as it's part of the URL.
 */
export function LawBookNav({
  active,
  query = "",
  onQuery,
  placeholder = "§ 5, Diebstahl, Geldstrafe…",
}: {
  /** The open book's id, "catalog" or "calculator". */
  active: string
  query?: string
  /** Without it there's no search field, e.g. on the Strafrechner. */
  onQuery?: (q: string) => void
  placeholder?: string
}) {
  const { bookmarks, remove } = useBookmarks()
  // While searching the books, the results replace the open book.
  const searchingBooks = active !== "catalog" && query.trim() !== ""
  return (
    <div className="grid gap-3 p-4">
      {onQuery && (
        <SearchField
          value={query}
          onChange={onQuery}
          focusKey
          placeholder={placeholder}
          aria-label={active === "catalog" ? "Strafkatalog durchsuchen" : "Gesetzbücher durchsuchen"}
        />
      )}
      <nav aria-label="Bücher" className="grid gap-1.5">
        <div className="grid grid-cols-4 gap-1.5">
          {books.map((b) => (
            <Button key={b.id} asChild size="sm" variant={b.id === active && !searchingBooks ? "default" : "outline"}>
              <NavLink to={lawBookPath(b.id)} title={b.title}>
                {b.abbreviation}
              </NavLink>
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <Button asChild size="sm" variant={active === "catalog" ? "default" : "outline"}>
            <NavLink to={catalogPath()} title="Alle Straftaten aus CO und TO mit Strafmaß">
              <ListIcon />
              Strafkatalog
            </NavLink>
          </Button>
          <Button asChild size="sm" variant={active === "calculator" ? "default" : "outline"}>
            <NavLink to={calculatorPath()} title="Straftaten zusammenrechnen, ohne Akte">
              <CalculatorIcon />
              Strafrechner
            </NavLink>
          </Button>
        </div>
      </nav>
      {bookmarks.length > 0 && (
        <nav aria-label="Favoriten" className="grid gap-0.5">
          <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">Favoriten</p>
          {bookmarks.map(({ id, book, paragraph }) => (
            <div key={id} className="group/bookmark flex items-center rounded-md hover:bg-accent/60">
              <NavLink
                to={lawBookPath(book.id, paragraph.number)}
                className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-sm text-foreground/80 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ParagraphNumber number={paragraph.number} className="w-10 shrink-0 text-xs" />
                <span className="w-6 shrink-0 text-xs text-muted-foreground">{book.abbreviation}</span>
                <span className="truncate">{paragraph.title}</span>
              </NavLink>
              <Hint label="Aus Favoriten entfernen">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => remove(id)}
                  aria-label={`§ ${paragraph.number} ${book.abbreviation} aus Favoriten entfernen`}
                  className="mr-1 text-muted-foreground opacity-0 group-hover/bookmark:opacity-100 focus-visible:opacity-100 hover:text-foreground"
                >
                  <StarOffIcon />
                </Button>
              </Hint>
            </div>
          ))}
        </nav>
      )}
    </div>
  )
}
