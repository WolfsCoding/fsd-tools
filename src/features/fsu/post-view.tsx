import { useEffect, useMemo, useRef, useState, type RefObject } from "react"
import { Link, useLocation } from "react-router"
import { ChevronLeftIcon, ChevronRightIcon, TableOfContentsIcon } from "lucide-react"
import { cn } from "cn"
import { BackButton } from "@/components/explorer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { extractHeadings, type Heading } from "./headings"
import { Markdown } from "./markdown"
import { FSU_BASE } from "./paths"
import { orderedPosts } from "./posts"
import type { Post } from "./types"

export function PostView({
  post,
  query,
  scrollRef,
}: {
  post: Post
  /** Search term; its matches are marked and the first one is scrolled into view. */
  query: string
  /** The scrolling element around the post, observed for the active heading. */
  scrollRef: RefObject<HTMLElement | null>
}) {
  const articleRef = useRef<HTMLElement>(null)
  const { search } = useLocation()
  const headings = useMemo(() => extractHeadings(post.content), [post.content])
  const headingIds = useMemo(
    () => new Map(headings.map((h) => [h.line, h.id])),
    [headings],
  )
  const activeId = useActiveHeading(headings, scrollRef)
  const showToc = headings.length > 1

  const index = orderedPosts.findIndex((p) => p.id === post.id)
  const previous = orderedPosts[index - 1]
  const next = orderedPosts[index + 1]

  // Runs after the scroll to the top that opening a post does, then jumps to the first match.
  useEffect(() => {
    if (!query.trim()) return
    articleRef.current?.querySelector("mark")?.scrollIntoView({ block: "center" })
  }, [query])

  return (
    <div className="mx-auto flex max-w-5xl gap-10 px-8 py-8">
      <article ref={articleRef} className="min-w-0 max-w-3xl flex-1">
        <header className="mb-8 grid gap-3 border-b pb-6">
          <div className="flex items-center gap-2">
            <BackButton to={{ pathname: FSU_BASE, search }} label="Alle Beiträge" className="-ml-2" />
            {post.category && (
              <Badge variant="secondary" className="w-fit">
                {post.category}
              </Badge>
            )}
          </div>
          <div className="flex items-start gap-3">
            <h1 className="flex-1 text-2xl font-semibold tracking-tight">{post.title}</h1>
            {showToc && <TocPopover headings={headings} activeId={activeId} />}
          </div>
        </header>
        <Markdown headingIds={headingIds} highlight={query}>
          {post.content}
        </Markdown>

        {(previous || next) && (
          <nav aria-label="Weitere Beiträge" className="mt-12 grid gap-3 border-t pt-6 sm:grid-cols-2">
            {previous && <PostNavLink post={previous} search={search} direction="previous" />}
            {next && <PostNavLink post={next} search={search} direction="next" />}
          </nav>
        )}
      </article>
      {showToc && (
        <aside className="hidden w-52 shrink-0 xl:block">
          <nav
            aria-label="Inhalt"
            className="sticky top-0 max-h-[calc(100svh-10rem)] overflow-y-auto"
          >
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Auf dieser Seite
            </p>
            <HeadingList headings={headings} activeId={activeId} />
          </nav>
        </aside>
      )}
    </div>
  )
}

/** The table of contents below `xl`, where there's no room for it next to the post. */
function TocPopover({ headings, activeId }: { headings: Heading[]; activeId: string | undefined }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button ref={triggerRef} variant="outline" size="sm" className="shrink-0 xl:hidden">
          <TableOfContentsIcon /> Inhalt
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="max-h-[60svh] overflow-y-auto"
        // Refocusing the button must not scroll back up to it.
        onCloseAutoFocus={(e) => {
          e.preventDefault()
          triggerRef.current?.focus({ preventScroll: true })
        }}
      >
        <nav aria-label="Inhalt">
          <HeadingList headings={headings} activeId={activeId} onSelect={() => setOpen(false)} />
        </nav>
      </PopoverContent>
    </Popover>
  )
}

function HeadingList({
  headings,
  activeId,
  onSelect,
}: {
  headings: Heading[]
  activeId: string | undefined
  onSelect?: () => void
}) {
  return (
    <ul className="grid gap-0.5 border-l text-sm">
      {headings.map((h) => (
        <li key={h.id}>
          {/* A button, not `#id` links, so the URL keeps pointing at the post. */}
          <button
            type="button"
            onClick={() => {
              onSelect?.()
              document
                .getElementById(h.id)
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }}
            aria-current={h.id === activeId ? "location" : undefined}
            className={cn(
              "-ml-px block w-full cursor-pointer border-l text-left border-transparent py-1 pr-2 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
              h.depth === 3 ? "pl-6" : "pl-3",
              "aria-[current=location]:border-sidebar-primary aria-[current=location]:text-foreground",
            )}
          >
            {h.text}
          </button>
        </li>
      ))}
    </ul>
  )
}

function PostNavLink({
  post,
  search,
  direction,
}: {
  post: Post
  /** Keeps the search of the current URL. */
  search: string
  direction: "previous" | "next"
}) {
  const previous = direction === "previous"
  return (
    <Link
      to={{ pathname: `${FSU_BASE}/${post.id}`, search }}
      className={cn(
        "grid gap-1 rounded-lg border p-4 outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring",
        previous ? "justify-items-start" : "justify-items-end text-right sm:col-start-2",
      )}
    >
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        {previous && <ChevronLeftIcon className="size-3.5" />}
        {previous ? "Vorheriger Beitrag" : "Nächster Beitrag"}
        {!previous && <ChevronRightIcon className="size-3.5" />}
      </span>
      <span className="text-sm font-medium">{post.title}</span>
    </Link>
  )
}

/** Id of the last heading scrolled past the top of the container (the first one before that). */
function useActiveHeading(
  headings: Heading[],
  scrollRef: RefObject<HTMLElement | null>,
) {
  const [activeId, setActiveId] = useState(headings[0]?.id)

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    const update = () => {
      const top = container.getBoundingClientRect().top + 24
      const atBottom =
        container.scrollTop + container.clientHeight >= container.scrollHeight - 2
      let current = headings[0]?.id
      for (const h of headings) {
        const el = document.getElementById(h.id)
        if (el && (atBottom || el.getBoundingClientRect().top <= top)) {
          current = h.id
        }
      }
      setActiveId(current)
    }

    update()
    container.addEventListener("scroll", update, { passive: true })
    return () => container.removeEventListener("scroll", update)
  }, [headings, scrollRef])

  return activeId
}
