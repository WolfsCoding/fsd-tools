import { books } from "@/features/law-book/data/books"
import { lawBookPath } from "@/features/law-book/paths"

/** The parts of a Markdown (mdast) node these plugins read and write. */
interface MdNode {
  type: string
  value?: string
  url?: string
  title?: string | null
  children?: MdNode[]
  data?: { hName?: string }
}

/** Replaces each text node outside of `skip` nodes with what `split` makes of it. */
function mapText(node: MdNode, split: (text: string) => MdNode[], skip: Set<string>) {
  if (!node.children) return
  node.children = node.children.flatMap((child) => {
    if (child.type === "text") return split(child.value ?? "")
    if (!skip.has(child.type)) mapText(child, split, skip)
    return [child]
  })
}

/** Cuts `text` at each match of `pattern` and turns the matches into nodes. */
function splitAt(text: string, pattern: RegExp, toNode: (match: RegExpExecArray) => MdNode | null) {
  const nodes: MdNode[] = []
  let last = 0
  for (const match of text.matchAll(pattern)) {
    const node = toNode(match)
    if (!node) continue
    if (match.index > last) nodes.push({ type: "text", value: text.slice(last, match.index) })
    nodes.push(node)
    last = match.index + match[0].length
  }
  if (last === 0) return [{ type: "text", value: text }]
  if (last < text.length) nodes.push({ type: "text", value: text.slice(last) })
  return nodes
}

const byAbbreviation = new Map(books.map((b) => [b.abbreviation, b]))
const ABBR = books.map((b) => b.abbreviation).join("|")
const ABS = String.raw`(?:\s*Abs\.\s*\d+)?`
// "TO § 14", "TO § 14 Abs. 3", "§ 14 CO", "§ 14 Abs. 3 TO".
const CITATION = new RegExp(
  String.raw`\b(${ABBR})\s*§\s*(\d+)${ABS}|§\s*(\d+)${ABS}\s+(${ABBR})\b`,
  "g",
)

/** Links law citations like "§ 14 Abs. 3 TO" to the paragraph in the Gesetzbuch, if it exists. */
export function remarkLawLinks() {
  return (tree: MdNode) =>
    mapText(
      tree,
      (text) =>
        splitAt(text, CITATION, (match) => {
          const book = byAbbreviation.get(match[1] ?? match[4])
          const number = Number(match[2] ?? match[3])
          const paragraph = book?.chapters.flatMap((c) => c.paragraphs).find((p) => p.number === number)
          if (!book || !paragraph) return null
          return {
            type: "link",
            url: lawBookPath(book.id, number),
            title: `${book.abbreviation} § ${number} ${paragraph.title}`,
            children: [{ type: "text", value: match[0] }],
          }
        }),
      new Set(["link", "linkReference"]),
    )
}

/** Wraps every occurrence of `query` (ignoring case) in `<mark>`. */
export function remarkHighlight(query: string) {
  const q = query.trim()
  const pattern = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")
  return (tree: MdNode) => {
    if (!q) return
    mapText(
      tree,
      (text) =>
        splitAt(text, pattern, (match) => ({
          type: "highlight",
          data: { hName: "mark" },
          children: [{ type: "text", value: match[0] }],
        })),
      new Set(),
    )
  }
}
