export interface Heading {
  /** Anchor id set on the rendered heading. */
  id: string
  /** Plain text without inline Markdown. */
  text: string
  depth: 2 | 3
  /** 1-based source line, matches the Markdown AST position. */
  line: number
}

function plainText(markdown: string) {
  return markdown
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .trim()
}

function slugify(text: string) {
  return (
    text
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "abschnitt"
  )
}

/** `##` and `###` headings of a post, for the table of contents. */
export function extractHeadings(content: string): Heading[] {
  const headings: Heading[] = []
  const used = new Map<string, number>()
  let inFence = false

  content.split(/\r?\n/).forEach((line, index) => {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence
    const match = !inFence && line.match(/^(#{2,3})\s+(.+?)\s*#*\s*$/)
    if (!match) return

    const text = plainText(match[2])
    const base = slugify(text)
    const count = used.get(base) ?? 0
    used.set(base, count + 1)
    headings.push({
      id: count ? `${base}-${count}` : base,
      text,
      depth: match[1].length as 2 | 3,
      line: index + 1,
    })
  })

  return headings
}
