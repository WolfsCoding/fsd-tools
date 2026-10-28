import { useLayoutEffect, useMemo, useRef } from "react"
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from "react-router"
import { BookOpenIcon, FileTextIcon } from "lucide-react"
import { Explorer, EXPLORER_CARDS, EXPLORER_CARD } from "@/components/explorer"
import { NoResults } from "@/components/no-results"
import { SearchField } from "@/components/search-field"
import {
  Empty,
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
    <Routes>
      <Route index element={<PostList query={query} onQuery={setQuery} />} />
      <Route path=":postId" element={<PostRoute query={query} />} />
    </Routes>
  )
}

function PostList({ query, onQuery }: { query: string; onQuery: (q: string) => void }) {
  const search = query ? `?${new URLSearchParams({ q: query })}` : ""
  const groups = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    if (!words.length) return allGroups
    return groupByCategory(
      posts.filter((p) => {
        const text = `${p.title} ${p.category} ${p.content}`.toLowerCase()
        return words.every((w) => text.includes(w))
      }),
    )
  }, [query])

  if (posts.length === 0) {
    return (
      <Empty className="flex-1">
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

  return (
    <Explorer
      title="Beiträge"
      toolbar={
        <SearchField
          value={query}
          onChange={onQuery}
          aria-label="Beiträge durchsuchen"
          focusKey
        />
      }
    >
      <nav className="grid gap-4">
        {groups.map(([category, items]) => (
          <section key={category} className="grid gap-1.5">
            <p className="px-1 text-xs font-medium text-muted-foreground">
              {category}
            </p>
            <div className={EXPLORER_CARDS}>
              {items.map((post) => (
                <PostRow key={post.id} post={post} search={search} />
              ))}
            </div>
          </section>
        ))}
      </nav>
      {query.trim() && groups.length === 0 && (
        <NoResults query={query} onReset={() => onQuery("")} />
      )}
    </Explorer>
  )
}

function PostRow({ post, search }: { post: Post; search: string }) {
  return (
    <Link
      to={{ pathname: `${FSU_BASE}/${post.id}`, search }}
      className={EXPLORER_CARD}
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{post.title}</span>
      </span>
      <span className="truncate text-xs text-muted-foreground">
        {excerpt(post.content)}
      </span>
    </Link>
  )
}

/** The first line of prose, without markdown marks. */
function excerpt(markdown: string) {
  const line = markdown
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l && !/^(#|---|```|\||!\[|<)/.test(l))
  return line?.replace(/^([-*+>]|\d+\.)\s+/, "").replace(/[*_`]|\[([^\]]*)\]\([^)]*\)/g, "$1") ?? ""
}

/** Resolves `:postId`; unknown ids go back to the list. */
function PostRoute({ query }: { query: string }) {
  const { postId } = useParams()
  const post = posts.find((p) => p.id === postId)
  const mainRef = useRef<HTMLElement>(null)
  const { pathname } = useLocation()
  useTabTitle(post?.title)

  // The scroll container outlives moving to the next post, so start every post at the top.
  useLayoutEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [pathname])

  if (!post) return <Navigate to={FSU_BASE} replace />
  return (
    <main ref={mainRef} className="min-h-0 min-w-0 flex-1 overflow-y-auto">
      {/* Keyed so per-post state (active heading) starts fresh. */}
      <PostView key={post.id} post={post} query={query} scrollRef={mainRef} />
    </main>
  )
}
