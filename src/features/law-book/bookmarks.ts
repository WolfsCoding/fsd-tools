import { useCallback, useMemo } from "react"
import { useLocalStorage } from "@/lib/local-storage"
import { removedToast } from "@/lib/undo"
import { books } from "./data/books"
import type { Book, Paragraph } from "./data/types"

export const BOOKMARKS_KEY = "gesetzbuch:bookmarks"

const NONE: unknown = []

/** A bookmarked paragraph, stored as "<book>-<§>", e.g. "to-14". */
export interface Bookmark {
  id: string
  book: Book
  paragraph: Paragraph
}

export const bookmarkId = (book: Book, paragraph: Paragraph) => `${book.id}-${paragraph.number}`

function findBookmark(id: string): Bookmark | undefined {
  const [bookId, number] = id.split("-")
  const book = books.find((b) => b.id === bookId)
  const paragraph = book?.chapters.flatMap((c) => c.paragraphs).find((p) => String(p.number) === number)
  return book && paragraph ? { id, book, paragraph } : undefined
}

/** The bookmarked paragraphs in the order they were added; ids no longer in the books are skipped. */
export function useBookmarks() {
  const [stored, setStored] = useLocalStorage(BOOKMARKS_KEY, NONE)
  const ids = useMemo(() => (Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : []), [stored])
  const bookmarks = useMemo(() => ids.flatMap((id) => findBookmark(id) ?? []), [ids])

  const update = useCallback(
    (fn: (ids: string[]) => string[]) =>
      setStored((prev: unknown) => fn(Array.isArray(prev) ? prev.filter((id): id is string => typeof id === "string") : [])),
    [setStored],
  )

  const has = useCallback((book: Book, paragraph: Paragraph) => ids.includes(bookmarkId(book, paragraph)), [ids])

  const toggle = useCallback(
    (book: Book, paragraph: Paragraph) => {
      const id = bookmarkId(book, paragraph)
      update((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]))
    },
    [update],
  )

  /** Removes a bookmark from the list, with "Rückgängig" putting it back at its place. */
  const remove = useCallback(
    (id: string) => {
      const index = ids.indexOf(id)
      const before = ids[index - 1]
      update((prev) => prev.filter((b) => b !== id))
      removedToast("Favorit", () =>
        update((prev) => {
          if (prev.includes(id)) return prev
          // After the one it followed, if that's still there; else at its old index.
          const at = before !== undefined && prev.includes(before) ? prev.indexOf(before) + 1 : Math.min(index, prev.length)
          return [...prev.slice(0, at), id, ...prev.slice(at)]
        }),
      )
    },
    [ids, update],
  )

  return { bookmarks, has, toggle, remove }
}
