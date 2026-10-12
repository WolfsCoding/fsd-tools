import type { Post } from "./types"

/*
 * Posts are the Markdown files in ./posts, bundled at build time.
 * Each file starts with frontmatter:
 *
 *   ---
 *   title: Drogenanalyse
 *   category: Labor
 *   order: 1          (optional)
 *   ---
 */
const files = import.meta.glob<string>("./posts/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
})

function parsePost(path: string, raw: string): Post {
  const id = path.slice(path.lastIndexOf("/") + 1, -".md".length)
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  const meta: Record<string, string> = {}
  for (const line of match?.[1].split(/\r?\n/) ?? []) {
    const sep = line.indexOf(":")
    if (sep > 0) meta[line.slice(0, sep).trim()] = line.slice(sep + 1).trim()
  }
  // A missing title shouldn't take the whole app down; the file name stands in.
  if (!meta.title) console.warn(`FSU post "${path}" has no title in its frontmatter`)

  const order = Number(meta.order)
  return {
    id,
    title: meta.title || id,
    category: meta.category ?? "",
    order: meta.order && Number.isFinite(order) ? order : undefined,
    content: match ? raw.slice(match[0].length) : raw,
  }
}

function compare(a: Post, b: Post) {
  return (
    (a.order ?? Infinity) - (b.order ?? Infinity) ||
    a.title.localeCompare(b.title, "de")
  )
}

export const posts: Post[] = Object.entries(files).map(([path, raw]) =>
  parsePost(path, raw),
)

/** Posts grouped by category (uncategorized last), sorted by order then title. */
export function groupByCategory(list: Post[]): [string, Post[]][] {
  const groups = new Map<string, Post[]>()
  for (const post of list) {
    groups.set(post.category, [...(groups.get(post.category) ?? []), post])
  }
  const named = [...groups.entries()]
    .filter(([category]) => category)
    .sort(([a], [b]) => a.localeCompare(b, "de"))
  const uncategorized = groups.get("")
  return [
    ...named,
    ...(uncategorized ? [["Ohne Kategorie", uncategorized] as [string, Post[]]] : []),
  ].map(([category, items]) => [category, [...items].sort(compare)])
}

/** Every post in sidebar order, for previous/next links. */
export const orderedPosts = groupByCategory(posts).flatMap(([, items]) => items)
