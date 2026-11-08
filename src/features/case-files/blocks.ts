import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { headerImage } from "@/features/headers/paths"
import { banner, cell, checklist, bullets, doc, facts, section, type Colors } from "./markdown"
import { colorsOnly, parseRich, richHtml, richMarkdown } from "./rich-text"
import type { Value } from "./types"

/** Blocks holding one line of text, which can be turned into each other. */
export const TEXT_TYPES = ["section", "text", "bullet", "check", "note"] as const
export type TextType = (typeof TEXT_TYPES)[number]

const TextBlock = Schema.Struct({
  id: Schema.String,
  type: Schema.Literals(["text", "bullet", "note"]),
  text: Schema.String,
})
const SectionBlock = Schema.Struct({
  id: Schema.String,
  type: Schema.Literal("section"),
  text: Schema.String,
  /** Its own color of the heading; the one of the settings while unset. */
  color: Schema.optionalKey(Schema.String),
})
const CheckBlock = Schema.Struct({ id: Schema.String, type: Schema.Literal("check"), text: Schema.String, checked: Schema.Boolean })
const TableBlock = Schema.Struct({
  id: Schema.String,
  type: Schema.Literal("table"),
  columns: Schema.Array(Schema.String),
  rows: Schema.Array(Schema.Array(Schema.String)),
  /** False once the "#" column with the row numbers was removed; tables number their rows until then. */
  numbered: Schema.optionalKey(Schema.Boolean),
  /** Heading of the number column; "#" while unset or empty. */
  numberTitle: Schema.optionalKey(Schema.String),
  /** How the first row is numbered, e.g. "Nr. 1"; the rows after count on from it. "#1" while unset or empty. */
  numberPattern: Schema.optionalKey(Schema.String),
  /** How many of the columns come before the number column; it is the first while unset. */
  numberAt: Schema.optionalKey(Schema.Number),
})
const FieldsBlock = Schema.Struct({
  id: Schema.String,
  type: Schema.Literal("fields"),
  fields: Schema.Array(Schema.Struct({ label: Schema.String, value: Schema.String })),
})
const DividerBlock = Schema.Struct({ id: Schema.String, type: Schema.Literal("divider") })
/** A header image: the VPD header with this title, or an image link of its own. */
const HeaderBlock = Schema.Struct({
  id: Schema.String,
  type: Schema.Literal("header"),
  title: Schema.String,
  /** The `width` of the picture, e.g. "200px"; the banners' 800px while unset. */
  width: Schema.optionalKey(Schema.String),
})

/** A <details>: the summary shown, and the text that opens under it. */
const DetailsBlock = Schema.Struct({ id: Schema.String, type: Schema.Literal("details"), summary: Schema.String, text: Schema.String })

export const Block = Schema.Union([SectionBlock, TextBlock, CheckBlock, TableBlock, FieldsBlock, DividerBlock, HeaderBlock, DetailsBlock])
export type Block = typeof Block.Type
export type BlockType = Block["type"]
export type TextishBlock = Extract<Block, { type: TextType }>

const decodeBlocks = Schema.decodeUnknownOption(Schema.fromJsonString(Schema.Array(Block)))

/** The blocks of an own case file, stored as JSON in one value; none while nothing was written. */
export function readBlocks(value: Value | undefined): readonly Block[] {
  return typeof value === "string" ? Option.getOrElse(decodeBlocks(value), () => []) : []
}

export function writeBlocks(blocks: readonly Block[]): string {
  return JSON.stringify(blocks)
}

export const isTextish = (b: Block): b is TextishBlock => (TEXT_TYPES as readonly string[]).includes(b.type)

/** A new block of `type`, keeping the text where both have one. */
export function blockOf(type: BlockType, id: string, text = ""): Block {
  switch (type) {
    case "check":
      return { id, type, text, checked: false }
    case "table":
      return { id, type, columns: ["", ""], rows: [["", ""]] }
    case "fields":
      return { id, type, fields: [{ label: "", value: "" }] }
    case "divider":
      return { id, type }
    case "header":
      return { id, type, title: text }
    case "details":
      return { id, type, summary: text, text: "" }
    default:
      return { id, type, text }
  }
}

const TYPE_NAMES: Record<BlockType, string> = {
  section: "Abschnitt",
  text: "Text",
  bullet: "Aufzählung",
  check: "Checkliste",
  table: "Tabelle",
  fields: "Felder",
  note: "Hinweis",
  divider: "Trennlinie",
  header: "Header-Bild",
  details: "Aufklappbar",
}
export const typeName = (type: BlockType) => TYPE_NAMES[type]

/** How many of a table's columns come before its number column, within the columns there are. */
export const numberIndex = (b: Extract<Block, { type: "table" }>) => Math.min(Math.max(b.numberAt ?? 0, 0), b.columns.length)

export const NUMBER_TITLE = "#"
export const NUMBER_PATTERN = "#1"

/**
 * The number of row `i` (from 0) after `pattern`, the first row's: its first number counts up,
 * keeping leading zeros, so "Nr. 1" goes on with "Nr. 2" and "A-01" with "A-02". One without a
 * number stays the same in every row.
 */
export function rowNumber(pattern: string, i: number) {
  const first = pattern.trim() || NUMBER_PATTERN
  const m = /\d+/.exec(first)
  if (!m) return first
  return first.slice(0, m.index) + String(Number(m[0]) + i).padStart(m[0].length, "0") + first.slice(m.index + m[0].length)
}

/**
 * Blocks from pasted Markdown, as the case files write it: colored or `#` headings, quoted lines,
 * lists, tables, fields, rules, banner images and <details>. Rules around headings and images are
 * left out, since the Markdown of the blocks puts them there again. A heading in another color than
 * `headingColor`, the one of the settings, keeps its own.
 */
export function markdownBlocks(markdown: string, newId: () => string, headingColor: string): Block[] {
  const lines = markdown
    .replace(/<!--[\s\S]*?-->/g, "")
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^>\s?/, "").trim())
  const out: Block[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const prev = out[out.length - 1]
    /** Right under the line before, with no empty line between them. */
    const glued = i > 0 && !!lines[i - 1]
    if (!line || /^<\/?center>$/i.test(line)) continue
    const img = /<img\s[^>]*src="([^"]+)"/i.exec(line) ?? /^!\[[^\]]*\]\(([^)\s]+)/.exec(line)
    if (img) {
      const width = /\swidth="([^"]+)"/i.exec(line)?.[1]
      out.push({ id: newId(), type: "header", title: img[1], ...(width && { width }) })
      continue
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      out.push({ id: newId(), type: "divider" })
      continue
    }
    const font = /^<font\s+color=(["']?)([^"'\s>]+)\1[^>]*>\s*<(b|strong)>(.*)<\/\3>\s*<\/font>$/i.exec(line)
    const heading = font?.[4] ?? /^#{1,6}\s+(.*)$/.exec(line)?.[1]
    if (heading !== undefined) {
      const text = colorsOnly(heading.replace(/`/g, "").trim().replace(/^\d+\.\s*/, "")).replace(/:$/, "")
      const color = font?.[2]
      out.push({ id: newId(), type: "section", text, ...(color && color.toLowerCase() !== headingColor.toLowerCase() && { color }) })
      continue
    }
    if (/^<details\b/i.test(line)) {
      // Up to the closing tag, the summary on the way; what is left are the lines of the text.
      const body: string[] = []
      let rest = line.replace(/^<details[^>]*>/i, "")
      let summary = ""
      for (;;) {
        rest = rest.replace(/<summary>([\s\S]*?)<\/summary>/i, (_, s: string) => ((summary ||= s.trim()), ""))
        const end = /<\/details>/i.exec(rest)
        const kept = (end ? rest.slice(0, end.index) : rest).trim()
        if (kept) body.push(kept)
        if (end || i + 1 >= lines.length) break
        rest = lines[++i]
      }
      out.push({ id: newId(), type: "details", summary: richMarkdown(parseRich(summary)), text: body.join("\n") })
      continue
    }
    if (line.startsWith("|")) {
      const rows: string[][] = []
      for (; lines[i]?.startsWith("|"); i++) {
        const cells = tableCells(lines[i])
        if (!cells.every((c) => /^:?-+:?$/.test(c))) rows.push(cells)
      }
      i--
      if (rows.length) out.push(tableOf(newId(), rows))
      continue
    }
    const check = /^[-*+]\s+\[([ xX])\]\s+(.*)$/.exec(line)
    if (check) {
      out.push({ id: newId(), type: "check", text: check[2], checked: check[1] !== " " })
      continue
    }
    const bullet = /^[-*+]\s+(.*)$/.exec(line)
    if (bullet) {
      out.push({ id: newId(), type: "bullet", text: bullet[1] })
      continue
    }
    const field = /^\*\*(.+?):\*\*\s*(.+)$/.exec(line)
    if (field) {
      const f = { label: field[1].trim(), value: field[2].trim().replace(/^`([^`]*)`$/, "$1") }
      if (glued && prev?.type === "fields") out[out.length - 1] = { ...prev, fields: [...prev.fields, f] }
      else out.push({ id: newId(), type: "fields", fields: [f] })
      continue
    }
    const note = /^\*\*([^*]+)\*\*$/.exec(line)
    if (note) {
      out.push({ id: newId(), type: "note", text: note[1] })
      continue
    }
    if (glued && prev?.type === "text") out[out.length - 1] = { ...prev, text: `${prev.text}\n${line}` }
    else out.push({ id: newId(), type: "text", text: line })
  }
  return out.filter((b, i) => {
    if (b.type !== "divider") return true
    const before = out[i - 1]?.type
    const after = out[i + 1]?.type
    return !!before && !!after && before !== "header" && before !== "divider" && after !== "section" && after !== "header"
  })
}

/** The cells of a Markdown table row, without the inline code the case files put around them. */
function tableCells(row: string) {
  return row
    .replace(/^\||\|$/g, "")
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/^`([^`]*)`$/, "$1").replace(/\\\|/g, "|"))
}

/** A table block from the header and the rows; a first column counting up like the numbering becomes it. */
function tableOf(id: string, rows: string[][]): Block {
  const width = Math.max(...rows.map((r) => r.length))
  const [head, ...body] = rows.map((r) => Array.from({ length: width }, (_, j) => r[j] ?? ""))
  const first = body[0]?.[0] ?? ""
  if (width > 1 && /\d/.test(first) && body.every((r, i) => r[0] === rowNumber(first, i)))
    return { id, type: "table", columns: head.slice(1), rows: body.map((r) => r.slice(1)), numberTitle: head[0], numberPattern: first }
  return { id, type: "table", columns: head, rows: body.length ? body : [head.map(() => "")], numbered: false }
}

/** The picture of a header block: its own link, else the VPD header with its title. */
export const headerSrc = (title: string) => (/^https?:\/\//.test(title.trim()) ? title.trim() : headerImage(title.trim()))

/** What the Markdown needs from the reader. */
interface Style {
  colors: Colors
  fill: (text: string) => string
}

/**
 * The blocks in the shape of the other case files: every Abschnitt a numbered, colored heading
 * with what follows it, the parts divided by rules. What comes before the first Abschnitt is
 * written without a heading.
 */
export function blocksMarkdown(blocks: readonly Block[], r: Style) {
  const parts: { title?: string; color?: string; blocks: Block[] }[] = [{ blocks: [] }]
  for (const b of blocks) {
    if (b.type === "section") parts.push({ title: b.text, color: b.color, blocks: [] })
    // A header image stands on its own between rules, like the banners of the other case files.
    else if (b.type === "header") parts.push({ blocks: [b] }, { blocks: [] })
    else parts[parts.length - 1].blocks.push(b)
  }
  let n = 0
  return doc(
    ...parts.flatMap((p) => {
      const body = partBody(p.blocks, r)
      if (p.title === undefined) return body ? [body] : []
      const title = `${++n}. ${r.fill(p.title).replace(/:$/, "") || "Abschnitt"}:`
      return [section({ colors: { ...r.colors, heading: p.color ?? r.colors.heading } }, title, body).trimEnd()]
    }),
  )
}

function partBody(blocks: Block[], r: Style) {
  const chunks: string[] = []
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]
    // A run of points makes one list.
    if (b.type === "bullet" || b.type === "check") {
      const run: Block[] = []
      while (blocks[i]?.type === b.type) run.push(blocks[i++])
      i--
      const filled = run.flatMap((x) => {
        const text = "text" in x ? r.fill(x.text).replace(/\s*\n\s*/g, " ") : ""
        return text ? [{ text, checked: x.type === "check" && x.checked }] : []
      })
      if (filled.length)
        chunks.push(
          b.type === "bullet" ? bullets(filled.map((x) => x.text)) : checklist(filled.map((x) => ({ label: x.text, checked: x.checked }))),
        )
      continue
    }
    const chunk = blockMarkdown(b, r)
    if (chunk) chunks.push(chunk)
  }
  return chunks.join("\n\n")
}

function blockMarkdown(b: Block, r: Style) {
  switch (b.type) {
    case "text": {
      const text = r.fill(b.text)
      return text && text.split("\n").map((l) => (l.trim() ? `> ${l.trim()}` : ">")).join("\n")
    }
    case "note": {
      const text = r.fill(b.text).replace(/\s*\n\s*/g, " ")
      return text && `> **${text}**`
    }
    case "details": {
      // The summary is HTML, which Markdown isn't read in; the text after an empty line is Markdown again.
      const summary = `> <details><summary>${richHtml(parseRich(r.fill(b.summary))) || "Details"}</summary>`
      const lines = r.fill(b.text).split("\n").filter((l) => l.trim())
      if (!lines.length) return b.summary.trim() ? `${summary}</details>` : ""
      return [summary, ">", ...lines.map((l) => `> ${l.trim()}`), ">", "> </details>"].join("\n")
    }
    case "divider":
      return "---"
    case "header": {
      const title = r.fill(b.title).trim()
      return title && banner(headerSrc(title), b.width)
    }
    case "table": {
      const rows = b.rows.filter((row) => row.some((c) => c.trim()))
      const headers = b.columns.map((c, i) => r.fill(c) || `Spalte ${i + 1}`)
      const cells = rows.map((row) => row.map((c) => cell(r.fill(c) || "N/A")))
      const numbered = b.numbered !== false
      const at = numberIndex(b)
      const withNumber = (xs: string[], n: string) => (numbered ? [...xs.slice(0, at), n, ...xs.slice(at)] : xs)
      const all = withNumber(headers, r.fill(b.numberTitle ?? "").trim() || NUMBER_TITLE)
      const line = (xs: string[]) => `> | ${xs.join(" | ")} |`
      return [
        line(all),
        line(all.map(() => "---")),
        ...cells.map((row, i) => line(withNumber(row, cell(rowNumber(r.fill(b.numberPattern ?? ""), i))))),
      ].join("\n")
    }
    case "fields":
      return facts(
        b.fields
          .filter((f) => f.label.trim() || f.value.trim())
          .map((f) => [(r.fill(f.label).replace(/:$/, "") || "Feld").toLocaleUpperCase("de-DE"), r.fill(f.value) || "N/A"]),
      )
    default:
      return ""
  }
}
