import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react"
import { createPortal } from "react-dom"
import { Link } from "react-router"
import { ChevronLeftIcon, PlusIcon, PrinterIcon, Trash2Icon } from "lucide-react"
import { Hint } from "@/components/hint"
import { Button } from "@/components/ui/button"
import { removedToast } from "@/lib/undo"
import { NotePagination } from "./note-pagination"
import { NOTES_BASE } from "./paths"
import type { Note } from "./types"
import { pageBreaks, type NotePatch } from "./use-notes"

/** 210 × 297 mm at 96 dpi. */
const SHEET_WIDTH_PX = (210 / 25.4) * 96
const SHEET_HEIGHT_PX = (297 / 25.4) * 96
/** Height of the title row above and the toolbar below the sheet (h-9), and the gaps to them (gap-4). */
const BAR_PX = 36
const GAP_PX = 16

// DIN A4. The hidden measuring sheet uses the same classes.
const SHEET =
  "relative h-[297mm] w-[210mm] shrink-0 rounded-2xl border-2 border-dashed bg-card p-6 text-card-foreground"
// The line height splits the sheet's inner height (297mm minus border-2 and p-6) into
// exactly 48 lines (≈ 22px), so the last line ends flush with the bottom padding.
const LINES = "font-sans text-[11pt]/[calc((297mm_-_4px_-_3rem)/48)]"
const TEXT = `block size-full resize-none overflow-hidden bg-transparent ${LINES} outline-none placeholder:text-muted-foreground`
// Same box and wrapping as a sheet on screen, black on white.
const PRINT_SHEET = `h-[297mm] w-[210mm] overflow-hidden border-2 border-transparent bg-white p-6 break-words whitespace-pre-wrap text-black ${LINES} break-after-page last:break-after-auto`
// While a note is open, printing shows only its sheets, one per paper page.
const PRINT_CSS = `@media print {
  @page { size: A4; margin: 0 }
  html, body { background: white !important }
  body > :not([data-note-print]) { display: none !important }
}`

interface Caret {
  page: number
  pos: number
}

/** The sheets of a note and where manual page breaks start a new run of text. */
interface Layout {
  pages: string[]
  breaks: number[]
}

/** First page of each run of text; a run continues over sheets until the next manual page break. */
function runStarts({ pages, breaks }: Layout) {
  return [...new Set([0, ...breaks])].filter((i) => i >= 0 && i < pages.length).sort((a, b) => a - b)
}

function toRuns(layout: Layout) {
  const starts = runStarts(layout)
  return starts.map((a, r) => layout.pages.slice(a, starts[r + 1] ?? layout.pages.length))
}

function fromRuns(runs: string[][]): Layout {
  const breaks: number[] = []
  let count = 0
  for (const [r, run] of runs.entries()) {
    if (r > 0) breaks.push(count)
    count += run.length
  }
  return { pages: runs.flat(), breaks }
}

/** A note as DIN A4 sheets, one at a time. Text that doesn't fit a sheet flows onto the next. */
export function NoteEditor({
  note,
  onChange,
  autoFocusTitle = false,
}: {
  note: Note
  /** A patch, or a function that builds one from the latest stored note (e.g. for undo). */
  onChange: (patch: NotePatch | ((note: Note) => NotePatch)) => void
  /** Focuses the title field, e.g. for a note that was just created. */
  autoFocusTitle?: boolean
}) {
  const areaRef = useRef<HTMLDivElement>(null)
  const mirrorRef = useRef<HTMLTextAreaElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const pendingFocus = useRef<Caret | null>(null)
  const [zoom, setZoom] = useState(1)
  const [current, setCurrent] = useState(0)
  // Clamped so deleting the last sheet never leaves us on one that no longer exists.
  const page = Math.min(current, note.pages.length - 1)
  const layout: Layout = { pages: note.pages, breaks: pageBreaks(note) }

  // Scales the sheet to fit the area between title and toolbar, so nothing scrolls.
  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    const observer = new ResizeObserver(([{ contentRect }]) =>
      setZoom(
        Math.min(
          1,
          contentRect.width / SHEET_WIDTH_PX,
          (contentRect.height - 2 * (BAR_PX + GAP_PX)) / SHEET_HEIGHT_PX,
        ),
      ),
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    const caret = pendingFocus.current
    if (!caret || caret.page !== page) return
    pendingFocus.current = null
    textRef.current?.focus()
    textRef.current?.setSelectionRange(caret.pos, caret.pos)
  })

  /** Length of the longest start of `text` that fits one sheet, ending at a word break if possible. */
  function fittingLength(text: string) {
    const mirror = mirrorRef.current
    if (!mirror) return text.length
    const fits = (n: number) => {
      mirror.value = text.slice(0, n)
      // +1: a full sheet fills the height exactly, and both values are rounded.
      return mirror.scrollHeight <= mirror.clientHeight + 1
    }
    if (fits(text.length)) return text.length
    let lo = 0
    let hi = text.length
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2)
      if (fits(mid)) lo = mid
      else hi = mid - 1
    }
    // The first character that doesn't fit is already a break.
    if (text[lo] === "\n" || text[lo] === " ") return Math.max(lo, 1)
    const wordBreak = Math.max(text.lastIndexOf("\n", lo - 1), text.lastIndexOf(" ", lo - 1))
    return Math.max(wordBreak > 0 ? wordBreak + 1 : lo, 1)
  }

  /**
   * Fills the sheets of each run of text again, so text moves on to the next sheet when
   * it doesn't fit and flows back when there is room. `changed` is the only sheet whose
   * text changed; sheets after it still fit and are kept once the layout reaches them.
   * Without `changed`, every sheet is laid out.
   */
  function reflow(input: Layout, changed: number | null, caret: Caret | null) {
    const { pages } = input
    const out: string[] = []
    const breaks: number[] = []
    let moved: Caret | null = null
    const starts = runStarts(input)
    starts.forEach((a, r) => {
      const b = starts[r + 1] ?? pages.length
      if (r > 0) breaks.push(out.length)
      const base = out.length
      // The sheet before the changed one may take text back from it.
      const s = changed === null ? a : Math.max(a, changed - 1)
      const inRun = caret && caret.page >= a && caret.page < b
      if (changed !== null && (b <= s || a > changed)) {
        out.push(...pages.slice(a, b))
        if (inRun) moved = { page: base + caret.page - a, pos: caret.pos }
        return
      }

      out.push(...pages.slice(a, s))
      const text = pages.slice(s, b).join("")
      // Where the unchanged sheets after `changed` start in `text`.
      const kept = new Map<number, number>()
      let offset = 0
      for (let j = s; j < b; j++) {
        if (changed !== null && j > changed && !kept.has(offset)) kept.set(offset, j)
        offset += pages[j].length
      }
      const chunks: number[] = []
      let pos = 0
      do {
        const j = kept.get(pos)
        if (j !== undefined) {
          for (const p of pages.slice(j, b)) {
            chunks.push(pos)
            out.push(p)
            pos += p.length
          }
          break
        }
        const n = fittingLength(text.slice(pos))
        chunks.push(pos)
        out.push(text.slice(pos, pos + n))
        pos += n
      } while (pos < text.length)

      if (inRun && caret.page < s) moved = { page: base + caret.page - a, pos: caret.pos }
      else if (inRun) {
        const at = pages.slice(s, caret.page).join("").length + caret.pos
        // At a sheet boundary the cursor stays at the end of the earlier sheet.
        const k = Math.max(
          chunks.findIndex((start, i) => at >= start && at <= (chunks[i + 1] ?? text.length)),
          0,
        )
        moved = { page: base + s - a + k, pos: at - chunks[k] }
      }
    })
    return { pages: out, breaks, caret: moved as Caret | null }
  }

  // Fits text that was written elsewhere (e.g. imported) onto sheets when the note opens.
  useLayoutEffect(() => {
    const result = reflow(layout, null, null)
    const same = (a: unknown[], b: unknown[]) => a.length === b.length && a.every((v, i) => v === b[i])
    if (!same(result.pages, layout.pages) || !same(result.breaks, layout.breaks)) {
      onChange({ pages: result.pages, pageBreaks: result.breaks })
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- only once per note
  }, [note.id])

  /** Shows sheet `caret.page` and puts the cursor at `caret.pos` once it renders. */
  function focusAt(caret: Caret) {
    pendingFocus.current = caret
    setCurrent(caret.page)
  }

  function setLayout(next: Layout, changed: number, caret: Caret) {
    const result = reflow(next, changed, caret)
    focusAt(result.caret ?? caret)
    onChange({ pages: result.pages, pageBreaks: result.breaks })
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget
    if (el.selectionStart !== el.selectionEnd) return
    const atStart = el.selectionStart === 0
    const atEnd = el.selectionStart === el.value.length
    const { pages, breaks } = layout
    const i = page
    const edit = (j: number, text: string) => pages.map((p, k) => (k === j ? text : p))

    if (e.key === "Backspace" && atStart && i > 0) {
      // Removes the page break before this sheet, or the last character of the sheet before.
      e.preventDefault()
      const caret = { page: i - 1, pos: pages[i - 1].length }
      if (breaks.includes(i)) setLayout({ pages, breaks: breaks.filter((b) => b !== i) }, i, caret)
      else if (pages[i - 1]) {
        setLayout({ pages: edit(i - 1, pages[i - 1].slice(0, -1)), breaks }, i - 1, { ...caret, pos: caret.pos - 1 })
      }
    } else if (e.key === "Delete" && atEnd && i < pages.length - 1) {
      e.preventDefault()
      const caret = { page: i, pos: pages[i].length }
      if (breaks.includes(i + 1)) setLayout({ pages, breaks: breaks.filter((b) => b !== i + 1) }, i + 1, caret)
      else setLayout({ pages: edit(i + 1, pages[i + 1].slice(1)), breaks }, i + 1, caret)
    } else if ((e.key === "ArrowUp" || e.key === "ArrowLeft") && atStart && i > 0) {
      e.preventDefault()
      focusAt({ page: i - 1, pos: pages[i - 1].length })
    } else if ((e.key === "ArrowDown" || e.key === "ArrowRight") && atEnd && i < pages.length - 1) {
      e.preventDefault()
      focusAt({ page: i + 1, pos: 0 })
    }
  }

  /** Starts a new sheet after a manual page break. */
  function addPage() {
    focusAt({ page: note.pages.length, pos: 0 })
    onChange({ pages: [...note.pages, ""], pageBreaks: [...layout.breaks, note.pages.length] })
  }

  function deletePage(i: number) {
    const { pages, breaks } = layout
    const removed = pages[i]
    const startsRun = i === 0 || breaks.includes(i)
    const wholeRun = i + 1 >= pages.length || breaks.includes(i + 1)
    const next = breaks.flatMap((b) => (b < i ? [b] : b > i ? [b - 1] : []))
    // The rest of a run whose first sheet goes keeps the page break in front of it.
    if (i > 0 && startsRun && !wholeRun) next.push(i)
    setLayout(
      { pages: pages.filter((_, j) => j !== i), breaks: next.sort((a, b) => a - b) },
      i,
      { page: Math.min(i, pages.length - 2), pos: 0 },
    )
    if (!removed.trim()) return

    // Where the text was: its own run, the start of a run, or the middle of one.
    const runIndex = runStarts(layout).filter((a) => a < i).length
    const runStart = runStarts(layout)[runIndex - 1] ?? 0
    const offset = pages.slice(runStart, i).join("").length
    removedToast(`Seite ${i + 1}`, () => {
      onChange((latest) => {
        const runs = toRuns({ pages: latest.pages, breaks: pageBreaks(latest) })
        let at: number
        if (startsRun && wholeRun) {
          at = Math.min(runIndex, runs.length)
          runs.splice(at, 0, [removed])
        } else if (startsRun) {
          at = Math.min(runIndex, runs.length - 1)
          runs[at] = [removed + runs[at].join("")]
        } else {
          at = Math.min(runIndex - 1, runs.length - 1)
          const text = runs[at].join("")
          const cut = Math.min(offset, text.length)
          runs[at] = [text.slice(0, cut) + removed + text.slice(cut)]
        }
        const restored = fromRuns(runs)
        const first = runStarts(restored)[at]
        // Without the editor (another note is open) the sheets are filled when this one opens again.
        const result = mirrorRef.current ? reflow(restored, first, null) : restored
        return { pages: result.pages, pageBreaks: result.breaks }
      })
      setCurrent(i)
    })
  }

  return (
    <div ref={areaRef} className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-hidden p-6">
      <div style={{ width: SHEET_WIDTH_PX * zoom }} className="flex h-9 shrink-0 items-center">
        <input
          value={note.title}
          onChange={(e) => onChange({ title: e.target.value })}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return
            e.preventDefault()
            textRef.current?.focus()
          }}
          autoFocus={autoFocusTitle}
          placeholder="Ohne Titel"
          aria-label="Titel"
          className="h-9 w-full min-w-0 rounded-md bg-transparent px-2 text-lg font-semibold outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        />
      </div>

      <div style={{ zoom }} className="relative">
        <div className={SHEET}>
          <textarea
            ref={textRef}
            value={note.pages[page]}
            onChange={(e) => {
              const pages = note.pages.map((p, j) => (j === page ? e.target.value : p))
              setLayout({ pages, breaks: layout.breaks }, page, { page, pos: e.target.selectionStart })
            }}
            onKeyDown={handleKeyDown}
            placeholder={page === 0 ? "Schreib los…" : undefined}
            aria-label={`Seite ${page + 1}`}
            spellCheck
            className={TEXT}
          />
        </div>

        {/* Measures how much text fits on a sheet. The wrapper keeps it out of the layout,
            since the sheet's own `relative` would override `absolute`. */}
        <div aria-hidden className="pointer-events-none invisible absolute top-0 left-0 h-0 overflow-hidden">
          <div className={SHEET}>
            <textarea ref={mirrorRef} tabIndex={-1} readOnly className={TEXT} />
          </div>
        </div>
      </div>

      {/* As wide as the sheet, so the pagination lines up with its right edge. */}
      <div style={{ width: SHEET_WIDTH_PX * zoom }} className="flex h-9 shrink-0 items-center gap-2">
        <Hint label="Alle Notizen">
          <Button variant="outline" size="icon" asChild className="border-dashed md:hidden">
            <Link to={NOTES_BASE} aria-label="Alle Notizen">
              <ChevronLeftIcon />
            </Link>
          </Button>
        </Hint>
        {/* The span keeps the tooltip working while the button is disabled. */}
        <Hint label="Seite löschen">
          <span className="flex">
            <Button
              variant="outline"
              size="icon"
              className="border-dashed"
              onClick={() => deletePage(page)}
              disabled={note.pages.length === 1}
              aria-label={`Seite ${page + 1} löschen`}
            >
              <Trash2Icon />
            </Button>
          </span>
        </Hint>
        <Hint label="Seite hinzufügen">
          <Button variant="outline" size="icon" className="border-dashed" onClick={addPage} aria-label="Seite hinzufügen">
            <PlusIcon />
          </Button>
        </Hint>
        <Hint label="Drucken / als PDF">
          <Button
            variant="outline"
            size="icon"
            className="border-dashed"
            onClick={() => window.print()}
            aria-label="Drucken / als PDF"
          >
            <PrinterIcon />
          </Button>
        </Hint>
        <div className="ml-auto">
          <NotePagination
            page={page + 1}
            pages={note.pages.length}
            onPageChange={(p) => focusAt({ page: p - 1, pos: 0 })}
          />
        </div>
      </div>

      {createPortal(
        <div data-note-print className="hidden print:block">
          <style>{PRINT_CSS}</style>
          {note.pages.map((p, i) => (
            <div key={i} className={PRINT_SHEET}>
              {p}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}
