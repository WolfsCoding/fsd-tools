import { useCallback, useEffect, useMemo } from "react"
import { readKeys, useLocalStorage } from "@/lib/local-storage"
import type { Note } from "./types"

export const NOTES_KEY = "notes:notes"
/** Pages of the earlier Notion-style notes; imported once as plain text. */
export const LEGACY_PAGES_KEY = "wiki:pages"
const NO_NOTES: Note[] = []

/** Checks imported data before it replaces the stored notes. */
export function isValidNotesData(data: Record<string, unknown>) {
  const notes = data[NOTES_KEY]
  return notes === undefined || (Array.isArray(notes) && notes.every(isNote))
}

function isNote(value: unknown): value is Note {
  if (typeof value !== "object" || value === null) return false
  const v = value as Record<string, unknown>
  return (
    ["id", "title", "createdAt", "updatedAt"].every((k) => typeof v[k] === "string") &&
    Array.isArray(v.pages) &&
    v.pages.length > 0 &&
    v.pages.every((p) => typeof p === "string") &&
    (v.pageBreaks === undefined ||
      (Array.isArray(v.pageBreaks) && v.pageBreaks.every((i) => Number.isInteger(i))))
  )
}

export function noteTitle(note: Note | undefined) {
  return note?.title.trim() || "Ohne Titel"
}

export function noteText(note: Note) {
  return note.pages.join("\n")
}

/**
 * Pages that start after a manual page break; the others continue the text of the one
 * before. Notes saved before text could flow back have no `pageBreaks`: there every page
 * keeps its own text.
 */
export function pageBreaks(note: Note) {
  return note.pageBreaks ?? note.pages.map((_, i) => i).slice(1)
}

export type NotePatch = Partial<Pick<Note, "title" | "pages" | "pageBreaks">>

function isSameContent(a: Note, b: Note) {
  const same = (x: unknown[], y: unknown[]) => x.length === y.length && x.every((v, i) => v === y[i])
  return a.title === b.title && same(a.pages, b.pages) && same(pageBreaks(a), pageBreaks(b))
}

const uid = () => crypto.randomUUID()
const now = () => new Date().toISOString()

export function useNotes() {
  const [notes, setNotes] = useLocalStorage<Note[]>(NOTES_KEY, NO_NOTES)

  useEffect(() => {
    const stored = readKeys([NOTES_KEY, LEGACY_PAGES_KEY])
    if (stored[NOTES_KEY] === undefined && Array.isArray(stored[LEGACY_PAGES_KEY])) {
      setNotes(fromLegacyPages(stored[LEGACY_PAGES_KEY]))
    }
  }, [setNotes])

  const sorted = useMemo(() => [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [notes])

  const createNote = useCallback(() => {
    const note: Note = { id: uid(), title: "", pages: [""], pageBreaks: [], createdAt: now(), updatedAt: now() }
    setNotes((prev) => [...prev, note])
    return note.id
  }, [setNotes])

  /** Applies `patch`, or what it returns for the stored note. Only real changes count as an edit. */
  const updateNote = useCallback(
    (id: string, patch: NotePatch | ((note: Note) => NotePatch)) =>
      setNotes((prev) =>
        prev.map((n) => {
          if (n.id !== id) return n
          const next = { ...n, ...(typeof patch === "function" ? patch(n) : patch) }
          return isSameContent(n, next) ? n : { ...next, updatedAt: now() }
        }),
      ),
    [setNotes],
  )

  /** Deletes the note right away; the returned function puts it back where it was. */
  const deleteNote = useCallback(
    (id: string) => {
      const index = notes.findIndex((n) => n.id === id)
      const note = notes[index]
      setNotes((prev) => prev.filter((n) => n.id !== id))
      return () =>
        setNotes((prev) =>
          !note || prev.some((n) => n.id === id) ? prev : [...prev.slice(0, index), note, ...prev.slice(index)],
        )
    },
    [notes, setNotes],
  )

  return { notes: sorted, createNote, updateNote, deleteNote }
}

interface LegacyNode {
  type?: string
  text?: string
  attrs?: Record<string, unknown>
  content?: LegacyNode[]
}

/** Keeps the text of the earlier rich pages; formatting, databases and the trash are dropped. */
function fromLegacyPages(pages: unknown[]): Note[] {
  return pages.flatMap((value) => {
    const p = value as Record<string, unknown>
    if (typeof p?.id !== "string" || p.deletedAt) return []
    const text = p.doc ? nodeText(p.doc as LegacyNode) : typeof p.content === "string" ? p.content : ""
    const created = typeof p.createdAt === "string" ? p.createdAt : now()
    return [
      {
        id: p.id,
        title: `${typeof p.icon === "string" ? `${p.icon} ` : ""}${typeof p.title === "string" ? p.title : ""}`.trim(),
        pages: [text.replace(/\n{3,}/g, "\n\n").trim()],
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
  if (node.type === "taskItem") return `${node.attrs?.checked ? "[x]" : "[ ]"} ${inner}`
  return inner
}
