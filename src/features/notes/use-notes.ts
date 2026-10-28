import { useAtom } from "@effect/atom-react"
import * as Schema from "effect/Schema"
import { useCallback, useEffect, useMemo } from "react"
import { readKeys, stored, type StoredValue } from "@/lib/storage"
import { Note } from "./types"
import type { UpdateNotes } from "./note-list"

export const NOTES_KEY = "notes:notes"
/** Pages of the earlier Notion-style notes; imported once as plain text. */
export const LEGACY_PAGES_KEY = "wiki:pages"

/**
 * An earlier note: plain text on DIN A4 pages, `pageBreaks` holding the pages that start
 * after a manual break (all of them when missing). They read as Markdown now.
 */
const PagedNote = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  author: Schema.optionalKey(Schema.String),
  folderId: Schema.optionalKey(Schema.String),
  order: Schema.optionalKey(Schema.Number),
  createdAt: Schema.String,
  updatedAt: Schema.String,
  pages: Schema.Array(Schema.String),
  pageBreaks: Schema.optionalKey(Schema.Array(Schema.Number)),
})

/** Notes as stored, in either shape. */
const StoredNote = Schema.Union([Note, PagedNote])
type StoredNote = StoredValue<typeof StoredNote>

const NO_NOTES: StoredNote[] = []

export const notesAtom = stored(NOTES_KEY, Schema.Array(StoredNote), NO_NOTES)
export const legacyPagesAtom = stored(LEGACY_PAGES_KEY, Schema.Array(Schema.Unknown), [])

/** Joins the pages of an earlier note; text that flowed on to the next page joins up again. */
function toNote(note: StoredNote): Note {
  if ("content" in note) return note
  const { pages, pageBreaks, ...rest } = note
  const breaks = new Set(pageBreaks ?? pages.map((_, i) => i))
  return { ...rest, content: pages.reduce((text, page, i) => (i && breaks.has(i) ? `${text}\n\n${page}` : text + page), "") }
}

export function noteTitle(note: Note | undefined) {
  return note?.title.trim() || "Ohne Titel"
}

export function useNotes() {
  const [storedNotes, setStored] = useAtom(notesAtom)

  useEffect(() => {
    const data = readKeys([NOTES_KEY, LEGACY_PAGES_KEY])
    if (data[NOTES_KEY] === undefined && Array.isArray(data[LEGACY_PAGES_KEY])) {
      setStored(fromLegacyPages(data[LEGACY_PAGES_KEY]))
    }
  }, [setStored])

  const notes = useMemo(() => storedNotes.map(toNote), [storedNotes])

  const updateNotes = useCallback<UpdateNotes>(
    (change) => setStored((prev) => change(prev.map(toNote))),
    [setStored],
  )

  return { notes, updateNotes }
}

interface LegacyNode {
  type?: string
  text?: string
  attrs?: Record<string, unknown>
  content?: LegacyNode[]
}

/** Keeps the text of the earlier rich pages; formatting, databases and the trash are dropped. */
function fromLegacyPages(pages: unknown[]): Note[] {
  const now = new Date().toISOString()
  return pages.flatMap((value) => {
    const p = value as Record<string, unknown>
    if (typeof p?.id !== "string" || p.deletedAt) return []
    const text = p.doc ? nodeText(p.doc as LegacyNode) : typeof p.content === "string" ? p.content : ""
    const created = typeof p.createdAt === "string" ? p.createdAt : now
    return [
      {
        id: p.id,
        title: `${typeof p.icon === "string" ? `${p.icon} ` : ""}${typeof p.title === "string" ? p.title : ""}`.trim(),
        content: text.replace(/\n{3,}/g, "\n\n").trim(),
        createdAt: created,
        updatedAt: typeof p.updatedAt === "string" ? p.updatedAt : created,
      },
    ]
  })
}

const INLINE = new Set(["paragraph", "heading", "codeBlock", "summary", "detailsSummary"])

function nodeText(node: LegacyNode): string {
  if (node.type === "text") return node.text ?? ""
  if (node.type === "hardBreak") return "\n"
  if (node.type === "pageLink") return String(node.attrs?.title ?? "")
  const children = node.content ?? []
  if (INLINE.has(node.type ?? "")) return children.map(nodeText).join("")
  const inner = children.map(nodeText).join("\n")
  if (node.type === "listItem") return `- ${inner}`
  if (node.type === "taskItem") return `${node.attrs?.checked ? "- [x]" : "- [ ]"} ${inner}`
  return inner
}
