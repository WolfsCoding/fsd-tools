import { useMemo, useState, type ReactElement } from "react"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { books } from "@/features/law-book/data/books"
import { matchesOffense, OFFENSES, parseQuery, resolveOffense, type Offense } from "@/features/law-book/offenses"
import { Highlight, LawText, ParagraphText } from "@/features/law-book/paragraph-text"
import { useLocalStorage } from "@/lib/local-storage"

/** Offenses picked last, newest first; device-local, so not part of the backups. */
export const RECENT_OFFENSES_KEY = "gesetzbuch:recent-offenses"
const RECENT_MAX = 8
const NO_RECENT: unknown = []

/** cmdk needs unique values; a recent offense is also listed in its book. */
const RECENT_PREFIX = "recent:"

/** What an offense is: its reference, penalty, and the paragraph's wording with its section emphasized. */
export function OffenseDefinition({ offense, terms }: { offense: Offense; terms?: string[] }) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <p className="text-xs text-muted-foreground">
          {offense.book.title} · § {offense.paragraph.number} {offense.paragraph.title}
        </p>
        <p className="font-semibold">
          <span className="text-amber-400">{offense.ref}</span> {offense.title}
        </p>
      </div>
      <ParagraphText paragraph={offense.paragraph} active={offense.section} terms={terms} className="text-sm" />
    </div>
  )
}

/** Height of the list and the definition; fixed, so the popover doesn't resize (and move the items under the pointer) while the definition changes. */
const HEIGHT = "h-[min(28rem,60vh)]"

/**
 * Searchable list of every chargeable offense, opened by `children`; the ones picked last
 * come first while nothing is searched. The highlighted offense's definition is shown next
 * to the list, so it can be checked before picking.
 */
export function OffensePicker({ onPick, children }: { onPick: (offense: Offense) => void; children: ReactElement }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [active, setActive] = useState("")
  const [storedRecent, setRecent] = useLocalStorage(RECENT_OFFENSES_KEY, NO_RECENT)

  const terms = useMemo(() => parseQuery(query), [query])
  const shown = useMemo(() => (terms.length ? OFFENSES.filter((o) => matchesOffense(o, terms)) : OFFENSES), [terms])
  const recent = useMemo(
    () => (Array.isArray(storedRecent) && !terms.length ? [...new Set(storedRecent.flatMap((id) => resolveOffense(id) ?? []))] : []),
    [storedRecent, terms],
  )
  const groups = books
    .map((book) => [book, shown.filter((o) => o.book === book)] as const)
    .filter(([, items]) => items.length > 0)
  const activeId = active.startsWith(RECENT_PREFIX) ? active.slice(RECENT_PREFIX.length) : active
  const preview = shown.find((o) => o.id === activeId) ?? recent[0] ?? shown[0]

  const pick = (o: Offense) => {
    onPick(o)
    setRecent((prev: unknown) => [o.id, ...(Array.isArray(prev) ? prev : []).filter((id) => id !== o.id)].slice(0, RECENT_MAX))
    setOpen(false)
    setQuery("")
  }

  const item = (o: Offense, value: string) => (
    <CommandItem
      key={value}
      value={value}
      className="rounded-md data-[selected=false]:bg-transparent data-[selected=true]:bg-accent"
      onSelect={() => pick(o)}
    >
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="truncate">
          <span className="font-medium text-amber-400">{o.ref}</span> <Highlight text={o.title} terms={terms} />
        </span>
        <span className="truncate text-xs text-muted-foreground">
          <LawText text={o.excerpt} terms={terms} />
        </span>
      </span>
    </CommandItem>
  )

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setQuery("")
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-[min(48rem,calc(100vw-2rem))] gap-0 p-0">
        <Command shouldFilter={false} value={active} onValueChange={setActive} className="rounded-lg!">
          <CommandInput value={query} onValueChange={setQuery} placeholder="Straftat suchen – z. B. § 4 CO, Diebstahl, Waffen…" />
          <div className={`flex min-h-0 ${HEIGHT}`}>
            <CommandList className="max-h-none min-w-0 flex-1 scroll-py-1">
              <CommandEmpty>Keine Straftat gefunden.</CommandEmpty>
              {recent.length > 0 && (
                <CommandGroup heading="Zuletzt verwendet">{recent.map((o) => item(o, RECENT_PREFIX + o.id))}</CommandGroup>
              )}
              {groups.map(([book, items]) => (
                <CommandGroup key={book.id} heading={book.title}>
                  {items.map((o) => item(o, o.id))}
                </CommandGroup>
              ))}
            </CommandList>
            {preview && (
              <aside className="hidden w-80 shrink-0 overflow-y-auto border-l p-3 sm:block">
                <OffenseDefinition offense={preview} terms={terms} />
              </aside>
            )}
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
