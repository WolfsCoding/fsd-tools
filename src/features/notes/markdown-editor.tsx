import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import {
  BoldIcon,
  CodeIcon,
  Columns2Icon,
  Heading2Icon,
  Heading3Icon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  ListChecksIcon,
  ListIcon,
  ListOrderedIcon,
  Maximize2Icon,
  Minimize2Icon,
  MinusIcon,
  PaintbrushIcon,
  PanelLeftIcon,
  PanelRightIcon,
  QuoteIcon,
  SquareCodeIcon,
  StrikethroughIcon,
  TableIcon,
} from "lucide-react"
import { cn } from "cn"
import { Hint } from "@/components/hint"
import { Markdown } from "@/features/fsu/markdown"
import { useFullscreen } from "@/hooks/use-fullscreen"

// Pasted reports: thick dividers, a plain line before quotes, and tables with framed cells
// whose rows alternate between two shades. Checklist items show their box instead of a bullet.
const REPORT = cn(
  "wrap-break-word prose-p:my-2 prose-img:my-2 prose-img:inline-block prose-code:text-[0.8em]",
  "[&_.task-list-item]:list-none [&_.task-list-item>input]:my-0 [&_.task-list-item>input]:-ml-5 [&_.task-list-item>input]:mr-1",
  "prose-hr:my-5 prose-hr:border-t-[3px] prose-hr:border-muted-foreground/25",
  "prose-blockquote:my-3 prose-blockquote:border-l-[3px] prose-blockquote:border-l-muted-foreground/25 prose-blockquote:pl-4 prose-blockquote:text-foreground",
  "prose-table:my-3 prose-table:border-separate prose-table:border-spacing-0 prose-table:overflow-hidden prose-table:rounded-md prose-table:ring-1 prose-table:ring-border",
  "prose-th:border-r prose-th:border-b prose-th:border-border prose-th:bg-muted/70 prose-th:py-2.5 prose-th:align-middle prose-th:text-foreground",
  "prose-td:border-r prose-td:border-b prose-td:border-border prose-td:py-2 prose-td:align-middle",
  "[&_tbody_tr:nth-child(odd)]:bg-muted/20 [&_tbody_tr:nth-child(even)]:bg-muted/50",
  "[&_td:last-child]:border-r-0 [&_th:last-child]:border-r-0 [&_tbody_tr:last-child>td]:border-b-0",
)

/** A note's Markdown/HTML as a report: dividers, quote lines and two-shaded tables. */
export function NoteMarkdown({ children, className }: { children: string; className?: string }) {
  return (
    <Markdown html className={cn(REPORT, className)}>
      {children}
    </Markdown>
  )
}

type View = "edit" | "split" | "preview"

const TABLE = "| Spalte | Spalte |\n| --- | --- |\n| `x` | `x` |"

/** What a toolbar button does to the text. */
type Edit =
  | { type: "wrap"; before: string; after: string; placeholder: string }
  | { type: "lines"; prefix: (i: number) => string; pattern: RegExp }
  | { type: "block"; text: string }

interface Action {
  label: string
  icon: typeof BoldIcon
  edit: Edit
  /** Runs it with Strg and this key. */
  shortcut?: string
}

const wrap = (before: string, after: string, placeholder: string): Edit => ({ type: "wrap", before, after, placeholder })
const lines = (prefix: string | ((i: number) => string), pattern: RegExp): Edit => ({
  type: "lines",
  prefix: typeof prefix === "string" ? () => prefix : prefix,
  pattern,
})
const block = (text: string): Edit => ({ type: "block", text })

// `null` separates groups.
const ACTIONS: (Action | null)[] = [
  { label: "Fett (Strg+B)", shortcut: "b", icon: BoldIcon, edit: wrap("**", "**", "fett") },
  { label: "Kursiv (Strg+I)", shortcut: "i", icon: ItalicIcon, edit: wrap("_", "_", "kursiv") },
  { label: "Durchgestrichen", icon: StrikethroughIcon, edit: wrap("~~", "~~", "durchgestrichen") },
  { label: "Überschrift", icon: Heading2Icon, edit: lines("## ", /^## /) },
  { label: "Kleine Überschrift", icon: Heading3Icon, edit: lines("### ", /^### /) },
  // In the theme's blue, like the section titles of the reports.
  { label: "Farbige Überschrift", icon: PaintbrushIcon, edit: wrap("<font color=#3574f0><b>", "</b></font>", "Überschrift") },
  null,
  { label: "Zitat", icon: QuoteIcon, edit: lines("> ", /^> ?/) },
  { label: "Code", icon: CodeIcon, edit: wrap("`", "`", "Code") },
  { label: "Codeblock", icon: SquareCodeIcon, edit: wrap("```\n", "\n```", "Code") },
  { label: "Link (Strg+K)", shortcut: "k", icon: LinkIcon, edit: wrap("[", "](https://)", "Text") },
  { label: "Bild", icon: ImageIcon, edit: wrap("![", "](https://)", "Bild") },
  { label: "Tabelle", icon: TableIcon, edit: block(TABLE) },
  { label: "Trennlinie", icon: MinusIcon, edit: block("---") },
  null,
  { label: "Liste", icon: ListIcon, edit: lines("- ", /^- (?!\[)/) },
  { label: "Nummerierte Liste", icon: ListOrderedIcon, edit: lines((i) => `${i + 1}. `, /^\d+\. /) },
  { label: "Checkliste", icon: ListChecksIcon, edit: lines("- [ ] ", /^- \[[ x]\] /) },
]

/**
 * Markdown/HTML with a toolbar for the usual formatting, and its preview next to it.
 * The toolbar edits through the browser, so Strg+Z undoes it like typing.
 */
export function MarkdownEditor({
  id,
  value,
  onChange,
  onSubmit,
  fullscreen: fullscreenProp,
  onFullscreenChange,
  fullscreenClassName = "fixed inset-4 z-50 bg-background shadow-2xl shadow-black/50",
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  /** Strg+Enter, e.g. to save. */
  onSubmit?: () => void
  /** Set to control "Vollbild" from outside, e.g. so a dialog can grow while it's on. */
  fullscreen?: boolean
  onFullscreenChange?: (fullscreen: boolean) => void
  /** Where "Vollbild" puts the editor; by default over the whole window. */
  fullscreenClassName?: string
}) {
  const textRef = useRef<HTMLTextAreaElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<View>("split")
  const rootRef = useRef<HTMLDivElement>(null)
  const [ownFullscreen, setOwnFullscreen] = useFullscreen(rootRef)
  const fullscreen = fullscreenProp ?? ownFullscreen
  const setFullscreen = (on: boolean) => (onFullscreenChange ?? setOwnFullscreen)(on)

  useEffect(() => {
    if (!fullscreen) return
    const exit = onFullscreenChange ?? setOwnFullscreen
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && exit(false)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [fullscreen, onFullscreenChange, setOwnFullscreen])

  /** Replaces `from`–`to` with `text`, then selects `select`. */
  function replace(from: number, to: number, text: string, select: [number, number]) {
    const el = textRef.current
    if (!el) return
    el.focus()
    el.setSelectionRange(from, to)
    // Through the browser, so it lands in the undo history; it fires the change event itself.
    if (!document.execCommand("insertText", false, text)) onChange(value.slice(0, from) + text + value.slice(to))
    requestAnimationFrame(() => el.setSelectionRange(...select))
  }

  /** Runs a toolbar action on the selection. */
  function apply(edit: Edit) {
    const el = textRef.current
    if (!el) return
    const { selectionStart: s, selectionEnd: e } = el

    if (edit.type === "wrap") {
      // Takes the marks away again if they are around the selection already.
      const { before, after, placeholder } = edit
      const selected = value.slice(s, e)
      if (value.slice(s - before.length, s) === before && value.slice(e, e + after.length) === after) {
        return replace(s - before.length, e + after.length, selected, [s - before.length, e - before.length])
      }
      const text = selected || placeholder
      return replace(s, e, before + text + after, [s + before.length, s + before.length + text.length])
    }

    if (edit.type === "lines") {
      // Each selected line gets the prefix, or loses it when all of them have it.
      const start = value.lastIndexOf("\n", s - 1) + 1
      const found = value.indexOf("\n", e)
      const end = found === -1 ? value.length : found
      const lines = value.slice(start, end).split("\n")
      const strip = lines.every((l) => edit.pattern.test(l))
      const text = lines.map((l, i) => (strip ? l.replace(edit.pattern, "") : edit.prefix(i) + l)).join("\n")
      return replace(start, end, text, [start, start + text.length])
    }

    // A block on lines of its own at the cursor.
    const before = value.slice(0, e)
    const lead = !before || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n"
    const text = `${lead}${edit.text}\n\n`
    replace(e, e, text, [e + text.length, e + text.length])
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (!e.ctrlKey && !e.metaKey) return
    const action = ACTIONS.find((a) => a?.shortcut === e.key.toLowerCase())
    if (action) {
      e.preventDefault()
      apply(action.edit)
    } else if (e.key === "Enter" && onSubmit) {
      e.preventDefault()
      onSubmit()
    }
  }

  // Keeps the preview at the same place as the text, by share of the way down.
  function syncScroll() {
    const el = textRef.current
    const preview = previewRef.current
    if (!el || !preview || view !== "split") return
    const share = el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight)
    preview.scrollTop = share * (preview.scrollHeight - preview.clientHeight)
  }

  return (
    <div
      ref={rootRef}
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border bg-background/50",
        fullscreen && fullscreenClassName,
      )}
    >
      <div role="toolbar" aria-label="Formatierung" className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 px-1.5 py-1">
        {ACTIONS.map((a, i) =>
          a ? (
            <Tool key={a.label} label={a.label} icon={a.icon} run={() => apply(a.edit)} disabled={view === "preview"} />
          ) : (
            <span key={i} className="mx-1 h-4 w-px bg-border" />
          ),
        )}
        <div className="ml-auto flex items-center gap-0.5">
          <Tool label="Nur Text" icon={PanelLeftIcon} run={() => setView("edit")} active={view === "edit"} />
          <Tool label="Text und Vorschau" icon={Columns2Icon} run={() => setView("split")} active={view === "split"} />
          <Tool label="Nur Vorschau" icon={PanelRightIcon} run={() => setView("preview")} active={view === "preview"} />
          <span className="mx-1 h-4 w-px bg-border" />
          <Tool
            label={fullscreen ? "Vollbild beenden (Esc)" : "Vollbild"}
            icon={fullscreen ? Minimize2Icon : Maximize2Icon}
            run={() => setFullscreen(!fullscreen)}
            active={fullscreen}
          />
        </div>
      </div>

      <div
        className={cn(
          "grid min-h-0",
          fullscreen ? "flex-1" : "h-[65vh]",
          view === "split" ? "grid-cols-1 grid-rows-2 lg:grid-cols-2 lg:grid-rows-1" : "grid-cols-1",
        )}
      >
        <textarea
          id={id}
          ref={textRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onScroll={syncScroll}
          placeholder="# Überschrift&#10;&#10;Text, **fett**, <b>HTML</b>…"
          spellCheck
          className={cn(
            "size-full resize-none bg-transparent px-3 py-2.5 font-mono text-[13px]/relaxed outline-none placeholder:text-muted-foreground",
            view === "preview" && "hidden",
          )}
        />
        <div
          ref={previewRef}
          aria-label="Vorschau"
          className={cn(
            "min-h-0 overflow-y-auto px-5 py-4",
            view === "split" && "border-t lg:border-t-0 lg:border-l",
            view === "edit" && "hidden",
          )}
        >
          {value.trim() ? (
            <NoteMarkdown>{value}</NoteMarkdown>
          ) : (
            <p className="text-sm text-muted-foreground italic">Vorschau</p>
          )}
        </div>
      </div>
    </div>
  )
}

interface ToolProps {
  label: string
  icon: typeof BoldIcon
  run: () => void
}

function Tool({
  label,
  icon: Icon,
  run,
  active = false,
  disabled = false,
}: ToolProps & { active?: boolean; disabled?: boolean }) {
  return (
    <Hint label={label}>
      <button
        type="button"
        onClick={run}
        disabled={disabled}
        aria-label={label}
        aria-pressed={active || undefined}
        // Keeps the selection in the text while clicking.
        onMouseDown={(e) => e.preventDefault()}
        className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 aria-pressed:bg-primary/15 aria-pressed:text-primary [&_svg]:size-4"
      >
        <Icon />
      </button>
    </Hint>
  )
}
