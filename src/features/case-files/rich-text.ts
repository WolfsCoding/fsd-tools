// The text of a block is Markdown with a few inline formats: **bold**, `code` and
// <font color="…">colors</font>, which the homestate editor renders; <strong>, <b> and <code> are
// read as well. While editing it is read as runs of text with one format each; positions count
// the characters of the text alone.

/** A piece of text with one format. */
export interface Run {
  text: string
  bold?: boolean
  code?: boolean
  /** Any HTML color, e.g. "#34D399" or "white". */
  color?: string
}

/** A format to set on a part of the text; `color: null` takes the color away. */
export interface Format {
  bold?: boolean
  code?: boolean
  color?: string | null
}

/** The colors offered for text, next to any other one typed in. */
export const TEXT_COLORS = ["#fff", "#34D399", "#FBBF24", "#F87171"]

const CODE = /^`([^`\n]+)`/
const CODE_TAG = /^<code>([\s\S]*?)<\/code>/i
const BOLD = /^\*\*(?=\S)([\s\S]*?\S)\*\*/
const STRONG = /^<(strong|b)>([\s\S]*?)<\/\1>/i
const FONT = /^<font\s+color=(["']?)([^"'\s>]+)\1\s*>([\s\S]*?)<\/font>/i

/** The runs of a Markdown text; what isn't one of the formats stays as it is written. */
export function parseRich(markdown: string): Run[] {
  const runs: Run[] = []
  /** `html` inside a <code> tag, whose text is HTML: only tags and entities count there. */
  const walk = (s: string, style: Omit<Run, "text">, html = false) => {
    let plain = ""
    const flush = () => {
      if (plain) runs.push({ text: html ? unescape(plain) : plain, ...style })
      plain = ""
    }
    for (let i = 0; i < s.length; ) {
      const rest = s.slice(i)
      let m: RegExpExecArray | null
      if (!style.code && (m = CODE.exec(rest))) {
        flush()
        runs.push({ text: m[1], ...style, code: true })
      } else if (!style.code && (m = CODE_TAG.exec(rest))) {
        flush()
        walk(m[1], { ...style, code: true }, true)
      } else if (!style.bold && !html && (m = BOLD.exec(rest))) {
        flush()
        walk(m[1], { ...style, bold: true })
      } else if (!style.bold && (m = STRONG.exec(rest))) {
        flush()
        walk(m[2], { ...style, bold: true }, html)
      } else if (!style.color && (m = FONT.exec(rest))) {
        flush()
        walk(m[3], { ...style, color: m[2] }, html)
      } else {
        plain += s[i++]
        continue
      }
      i += m[0].length
    }
    flush()
  }
  walk(markdown, {})
  return merge(runs)
}

/**
 * The Markdown of runs: a color around bold around code, whitespace kept outside the marks.
 * Code in one color and weight is a `code` span; code in several is a <code> tag with the
 * colors inside, since nothing inside a code span is formatted.
 */
export function richMarkdown(runs: readonly Run[]): string {
  const units = groups(merge(runs), (r) => (r.code ? "c" : "")).flatMap(([code, rs]): Run[] => {
    if (!code) return rs
    const { text: _, ...first } = rs[0]
    if (rs.some((r) => !!r.bold !== !!first.bold || r.color !== first.color)) return [{ text: codeTag(rs) }]
    return [{ ...first, code: false, text: marked("`", rs.map((r) => r.text).join("").replace(/`/g, "'")) }]
  })
  return groups(units, (r) => r.color ?? "")
    .map(([color, inColor]) => {
      const inner = groups(inColor, (r) => (r.bold ? "b" : ""))
        .map(([bold, inBold]) => {
          const text = inBold.map((r) => r.text).join("")
          return bold ? marked("**", text) : text
        })
        .join("")
      return color ? `<font color="${color}">${inner}</font>` : inner
    })
    .join("")
}

/**
 * The HTML of runs, for where Markdown isn't read, e.g. the <summary> of a <details>; line
 * breaks become spaces.
 */
export function richHtml(runs: readonly Run[]): string {
  return groups(merge(runs), (r) => (r.code ? "c" : ""))
    .map(([code, rs]) => (code ? codeTag(rs) : rs.map(htmlRun).join("")))
    .join("")
    .replace(/\s*\n\s*/g, " ")
}

/** The HTML of runs for the clipboard, with its line breaks. */
export function clipboardHtml(runs: readonly Run[]) {
  const lines: Run[][] = [[]]
  for (const r of runs)
    r.text.split("\n").forEach((text, i) => {
      if (i) lines.push([])
      lines[lines.length - 1].push({ ...r, text })
    })
  return lines.map(richHtml).join("<br>")
}

const codeTag = (runs: readonly Run[]) => `<code>${runs.map(htmlRun).join("")}</code>`

function htmlRun(r: Run) {
  const text = escape(r.text)
  const bold = r.bold ? `<strong>${text}</strong>` : text
  return r.color ? `<font color="${r.color}">${bold}</font>` : bold
}

// Markdown is still read between HTML tags, so its marks are written as entities too.
const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;" }
const escape = (text: string) => text.replace(/[&<>`*_~\\[\]|]/g, (c) => ENTITIES[c] ?? `&#${c.charCodeAt(0)};`)
const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', nbsp: " " }
const unescape = (html: string) =>
  html.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|nbsp);/gi, (m, e: string) =>
    e[0] === "#" ? String.fromCodePoint(Number(e[1] === "x" || e[1] === "X" ? `0${e.slice(1)}` : e.slice(1))) : (NAMED[e.toLowerCase()] ?? m),
  )

export const plainText = (markdown: string) => parseRich(markdown).map((r) => r.text).join("")

/** The runs between two positions. */
export function sliceRuns(runs: readonly Run[], start: number, end = Infinity): Run[] {
  const out: Run[] = []
  let at = 0
  for (const r of runs) {
    const from = Math.max(start - at, 0)
    const to = Math.min(end - at, r.text.length)
    if (from < to) out.push({ ...r, text: r.text.slice(from, to) })
    at += r.text.length
  }
  return out
}

/** The Markdown text cut in two: before `start` and after `end`. */
export function splitRich(markdown: string, start: number, end = start): [string, string] {
  const runs = parseRich(markdown)
  return [richMarkdown(sliceRuns(runs, 0, start)), richMarkdown(sliceRuns(runs, end))]
}

/** The Markdown text with `format` set between two positions. */
export function formatRich(markdown: string, start: number, end: number, format: Format) {
  const runs = parseRich(markdown)
  const { color, ...rest } = format
  const formatted = sliceRuns(runs, start, end).map((r) => ({
    ...r,
    ...rest,
    color: color === null ? undefined : (color ?? r.color),
  }))
  return richMarkdown([...sliceRuns(runs, 0, start), ...formatted, ...sliceRuns(runs, end)])
}

/** The format all of the text between two positions has. */
export function formatAt(markdown: string, start: number, end: number) {
  const picked = sliceRuns(parseRich(markdown), start, end)
  const color = picked[0]?.color
  return {
    bold: picked.length > 0 && picked.every((r) => r.bold),
    code: picked.length > 0 && picked.every((r) => r.code),
    color: picked.every((r) => r.color === color) ? color : undefined,
  }
}

/** The Markdown text without bold, e.g. for a Hinweis, which is bold as a whole. */
export const withoutBold = (markdown: string) => richMarkdown(parseRich(markdown).map((r) => ({ ...r, bold: false })))

/** The Markdown text with only its colors, e.g. for an Abschnitt, which is bold code as a whole. */
export const colorsOnly = (markdown: string) => richMarkdown(parseRich(markdown).map(({ text, color }) => ({ text, color })))

/** Text between two marks; spaces at its ends stay outside, where the Markdown needs them. */
function marked(mark: string, text: string) {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text)!
  return m[2] ? `${m[1]}${mark}${m[2]}${mark}${m[3]}` : text
}

const same = (a: Run, b: Run) => !!a.bold === !!b.bold && !!a.code === !!b.code && a.color === b.color

/** Runs without empty ones, neighbors of the same format joined. */
function merge(runs: readonly Run[]): Run[] {
  const out: Run[] = []
  for (const r of runs) {
    if (!r.text) continue
    const last = out[out.length - 1]
    if (last && same(last, r)) out[out.length - 1] = { ...last, text: last.text + r.text }
    else out.push({ text: r.text, ...(r.bold ? { bold: true } : {}), ...(r.code ? { code: true } : {}), ...(r.color ? { color: r.color } : {}) })
  }
  return out
}

/** Neighbors with the same key, together. */
export function groups<T>(items: readonly T[], key: (item: T) => string): [string, T[]][] {
  const out: [string, T[]][] = []
  for (const item of items) {
    const k = key(item)
    const last = out[out.length - 1]
    if (last && last[0] === k) last[1].push(item)
    else out.push([k, [item]])
  }
  return out
}
