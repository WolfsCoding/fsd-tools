import { useLayoutEffect, useMemo, useRef, type RefObject } from "react"
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router"
import { BookOpenIcon, FileTextIcon, SearchXIcon } from "lucide-react"
import { NoResults } from "@/components/no-results"
import { SearchField } from "@/components/search-field"
import { SidePanel } from "@/components/side-panel"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  useRegisterCommands,
  type CommandGroupDef,
} from "@/hooks/use-command-palette"
import { useTabTitle } from "@/hooks/use-tabs"
import { FSU_BASE } from "./paths"
import { PostView } from "./post-view"
import { groupByCategory, posts } from "./posts"
import type { Post } from "./types"

const allGroups = groupByCategory(posts)

export function FsuPage() {
  const navigate = useNavigate()
  // The search lives in the URL (`?q=`), so it survives reloads and opening a post.
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get("q") ?? ""
  const setQuery = (q: string) => setSearchParams(q ? { q } : {}, { replace: true })
  const search = query ? `?${new URLSearchParams({ q: query })}` : ""
  const mainRef = useRef<HTMLElement>(null)
  const { pathname } = useLocation()

  // The scroll container outlives route changes, so start every post at the top.
  useLayoutEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [pathname])

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allGroups
    return groupByCategory(
      posts.filter((p) =>
        [p.title, p.category, p.content].some((v) =>
          v.toLowerCase().includes(q),
        ),
      ),
    )
  }, [query])

  const commandGroups = useMemo<CommandGroupDef[]>(
    () => [
      {
        heading: "FSU-Erklärungen",
        actionLabel: "Beitrag öffnen",
        items: allGroups.flatMap(([, items]) =>
          items.map((post) => ({
            id: `fsu:post:${post.id}`,
            label: post.title,
            keywords: [post.category],
            icon: FileTextIcon,
            hint: post.category || undefined,
            onSelect: () => navigate(`${FSU_BASE}/${post.id}`),
          })),
        ),
      },
    ],
    [navigate],
  )
  useRegisterCommands("fsu", commandGroups)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SidePanel
        title="Beiträge"
        mobileClassName="max-h-[40%] border-b"
      >
        <div className="p-4">
          <SearchField
            value={query}
            onChange={setQuery}
            aria-label="Beiträge durchsuchen"
            focusKey
          />
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {groups.map(([category, items]) => (
            <div key={category} className="mb-3 last:mb-0">
              <p className="px-2 pt-1 pb-1.5 text-xs font-medium text-muted-foreground">
                {category}
              </p>
              {items.map((post) => (
                <PostLink key={post.id} post={post} search={search} />
              ))}
            </div>
          ))}
          {query.trim() && groups.length === 0 && (
            <NoResults query={query} onReset={() => setQuery("")} />
          )}
        </nav>
      </SidePanel>

      <main ref={mainRef} className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <Routes>
          <Route
            index
            element={
              <IndexView
                firstId={groups[0]?.[1][0]?.id}
                search={search}
                query={query.trim()}
                onResetSearch={() => setQuery("")}
              />
            }
          />
          <Route
            path=":postId"
            element={<PostRoute query={query} scrollRef={mainRef} />}
          />
        </Routes>
      </main>
    </div>
  )
}

function PostLink({ post, search }: { post: Post; search: string }) {
  return (
    <NavLink
      to={{ pathname: `${FSU_BASE}/${post.id}`, search }}
      className="flex h-8 items-center gap-2 rounded-md px-2 text-sm text-foreground/80 outline-none hover:bg-accent/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-accent aria-[current=page]:font-medium aria-[current=page]:text-foreground"
    >
      <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{post.title}</span>
    </NavLink>
  )
}

/** Resolves `:postId`; unknown ids go back to the index. */
function PostRoute({
  query,
  scrollRef,
}: {
  query: string
  scrollRef: RefObject<HTMLElement | null>
}) {
  const { postId } = useParams()
  const post = posts.find((p) => p.id === postId)
  useTabTitle(post?.title)
  // Keyed so per-post state (active heading) starts fresh.
  return post ? (
    <PostView key={post.id} post={post} query={query} scrollRef={scrollRef} />
  ) : (
    <Navigate to={FSU_BASE} replace />
  )
}

function IndexView({
  firstId,
  search,
  query,
  onResetSearch,
}: {
  /** First post in sidebar order that matches the search. */
  firstId: string | undefined
  search: string
  query: string
  onResetSearch: () => void
}) {
  if (posts.length === 0) {
    return (
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BookOpenIcon />
          </EmptyMedia>
          <EmptyTitle>Noch keine Beiträge</EmptyTitle>
          <EmptyDescription>
            Beiträge werden als Markdown-Dateien in{" "}
            <code>src/features/fsu/posts</code> angelegt.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  if (!firstId) {
    return (
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchXIcon />
          </EmptyMedia>
          <EmptyTitle>Keine Treffer</EmptyTitle>
          <EmptyDescription>Kein Beitrag passt zu „{query}“.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" onClick={onResetSearch}>
            Suche zurücksetzen
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  // Open the first matching post in sidebar order, keeping the search.
  return <Navigate to={{ pathname: `${FSU_BASE}/${firstId}`, search }} replace />
}
