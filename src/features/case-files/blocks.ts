import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { headerImage } from "@/features/headers/paths"
import { banner, cell, checklist, bullets, doc, facts, section, type Colors } from "./markdown"
import type { Value } from "./types"

/** Blocks holding one line of text, which can be turned into each other. */
export const TEXT_TYPES = ["section", "text", "bullet", "check", "note"] as const
export type TextType = (typeof TEXT_TYPES)[number]

const TextBlock = Schema.Struct({
  id: Schema.String,
  type: Schema.Literals(["section", "text", "bullet", "note"]),
  text: Schema.String,
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
})
const FieldsBlock = Schema.Struct({
  id: Schema.String,
  type: Schema.Literal("fields"),
  fields: Schema.Array(Schema.Struct({ label: Schema.String, value: Schema.String })),
})
const DividerBlock = Schema.Struct({ id: Schema.String, type: Schema.Literal("divider") })
/** A header image: the VPD header with this title, or an image link of its own. */
const HeaderBlock = Schema.Struct({ id: Schema.String, type: Schema.Literal("header"), title: Schema.String })

export const Block = Schema.Union([TextBlock, CheckBlock, TableBlock, FieldsBlock, DividerBlock, HeaderBlock])
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
}
export const typeName = (type: BlockType) => TYPE_NAMES[type]

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
  const parts: { title?: string; blocks: Block[] }[] = [{ blocks: [] }]
  for (const b of blocks) {
    if (b.type === "section") parts.push({ title: b.text, blocks: [] })
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
      return [section(r, title, body).trimEnd()]
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
    case "divider":
      return "---"
    case "header": {
      const title = r.fill(b.title).trim()
      return title && banner(headerSrc(title))
    }
    case "table": {
      const rows = b.rows.filter((row) => row.some((c) => c.trim()))
      const headers = b.columns.map((c, i) => r.fill(c) || `Spalte ${i + 1}`)
      const cells = rows.map((row) => row.map((c) => cell(r.fill(c) || "N/A")))
      const numbered = b.numbered !== false
      const all = numbered ? [r.fill(b.numberTitle ?? "").trim() || NUMBER_TITLE, ...headers] : headers
      const line = (xs: string[]) => `> | ${xs.join(" | ")} |`
      return [
        line(all),
        line(all.map(() => "---")),
        ...cells.map((row, i) => line(numbered ? [cell(rowNumber(r.fill(b.numberPattern ?? ""), i)), ...row] : row)),
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
