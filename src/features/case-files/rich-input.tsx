import { useEffect, useLayoutEffect, useRef, useState, type ClipboardEvent, type CSSProperties, type HTMLAttributes, type KeyboardEvent, type ReactNode, type Ref } from "react"
import { BanIcon, BoldIcon, CodeIcon } from "lucide-react"
import { cn } from "cn"
import { Hint } from "@/components/hint"
import { caretOf, setCaret, textLength } from "./caret"
import { formatAt, formatRich, groups, parseRich, richMarkdown, sliceRuns, TEXT_COLORS, type Format, type Run } from "./rich-text"

/** Inline code, as the Markdown shows it once pasted; the same in the text and in the headings. */
export const CHIP = "inline-block rounded bg-muted px-1.5 font-mono text-[0.8em] leading-5"

/** The runs shown in `el`: its text, formatted by the elements around each piece. */
function readRuns(el: HTMLElement) {
  const runs: Run[] = []
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const run: Run = { text: n.textContent ?? "" }
    for (let p = n.parentElement; p && p !== el; p = p.parentElement) {
      if (p.tagName === "STRONG" || p.tagName === "B") run.bold = true
      if (p.tagName === "CODE") run.code = true
      run.color ??= p.dataset.color ?? p.getAttribute("color") ?? undefined
    }
    runs.push(run)
  }
  return runs
}

function runNode(r: Run) {
  let node: Node = document.createTextNode(r.text)
  if (r.bold) {
    const e = document.createElement("strong")
    e.append(node)
    node = e
  }
  if (r.color) {
    const e = document.createElement("span")
    e.dataset.color = r.color
    e.style.color = r.color
    e.append(node)
    node = e
  }
  return node
}

/** Shows the runs in `el`; code next to code is one chip, as in the Markdown. */
function renderRuns(el: HTMLElement, runs: readonly Run[]) {
  el.replaceChildren(
    ...groups(runs, (r) => (r.code ? "c" : "")).flatMap(([code, rs]) => {
      if (!code) return rs.map(runNode)
      const chip = document.createElement("code")
      chip.className = CHIP
      chip.append(...rs.map(runNode))
      return [chip]
    }),
  )
  // A line break at the end only shows with something after it.
  if (runs[runs.length - 1]?.text.endsWith("\n")) el.append(document.createElement("br"))
}

interface RichInputProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  value: string
  onChange: (value: string) => void
  placeholder: string
  inputRef: (el: HTMLElement | null) => void
  /** The text is code as a whole, put in inline code by the template: shown as code, written without its marks. */
  code?: boolean
}

/**
 * A text field showing its Markdown formatted: bold, code and colors. The browser only types
 * plain text into it; line breaks and pastes go through the runs.
 */
export function RichInput({ value, onChange, placeholder, inputRef, code, className, onKeyDown, onPaste, ...props }: RichInputProps) {
  const el = useRef<HTMLDivElement>(null)
  /** The value the text shows, so typing doesn't render it again under the cursor. */
  const shown = useRef<string>(null)
  const show = (node: HTMLElement, runs: readonly Run[]) => renderRuns(node, code ? runs.map((r) => ({ ...r, code: true })) : runs)

  useLayoutEffect(() => {
    const node = el.current
    if (!node || shown.current === value) return
    const caret = document.activeElement === node ? caretOf(node) : null
    show(node, parseRich(value))
    shown.current = value
    if (caret) setCaret(node, Math.min(caret.start, textLength(node)), Math.min(caret.end, textLength(node)))
  })

  function emit(runs: readonly Run[]) {
    const md = richMarkdown(code ? runs.map((r) => ({ ...r, code: false })) : runs)
    shown.current = md
    onChange(md)
  }

  function insert(node: HTMLElement, added: Run[]) {
    const { start, end } = caretOf(node)
    const runs = readRuns(node)
    const next = [...sliceRuns(runs, 0, start), ...added, ...sliceRuns(runs, end)]
    show(node, next)
    setCaret(node, start + added.reduce((n, r) => n + r.text.length, 0))
    emit(next)
  }

  return (
    <div
      ref={(node) => {
        el.current = node
        inputRef(node)
      }}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      role="textbox"
      aria-multiline
      data-block-input
      data-placeholder={placeholder}
      data-empty={value ? undefined : ""}
      onInput={(e) => {
        const node = e.currentTarget
        const runs = readRuns(node)
        emit(runs)
        // Text typed at the edge of the code lands outside it; it is put back in.
        if (!code || ![...node.childNodes].some((n) => n.nodeType === Node.TEXT_NODE)) return
        const caret = caretOf(node)
        show(node, runs)
        setCaret(node, caret.start, caret.end)
      }}
      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
        onKeyDown?.(e)
        if (e.defaultPrevented || e.key !== "Enter" || !e.shiftKey) return
        e.preventDefault()
        const { start } = caretOf(e.currentTarget)
        const before = sliceRuns(readRuns(e.currentTarget), start - 1, start)[0]
        insert(e.currentTarget, [{ ...before, text: "\n" }])
      }}
      onPaste={(e: ClipboardEvent<HTMLDivElement>) => {
        onPaste?.(e)
        if (e.defaultPrevented) return
        e.preventDefault()
        insert(e.currentTarget, parseRich(e.clipboardData.getData("text/plain")))
      }}
      className={cn(
        "min-w-[1ch] whitespace-pre-wrap break-words outline-none before:pointer-events-none before:text-muted-foreground/60 data-empty:before:content-[attr(data-placeholder)]",
        className,
      )}
      {...props}
    />
  )
}

/**
 * A rich text field with its own format bar over the selected text, and Strg+B and Strg+E.
 * `singleLine` keeps it to one line, like an input.
 */
export function RichField({
  value,
  onChange,
  inputRef,
  onKeyDown,
  singleLine,
  code,
  ...props
}: Omit<RichInputProps, "inputRef"> & { inputRef?: (el: HTMLElement | null) => void; singleLine?: boolean }) {
  const el = useRef<HTMLElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  /** The selected text, and where the bar goes: above it, in the window. */
  const [selection, setSelection] = useState<{ start: number; end: number; left: number; top: number } | null>(null)
  /** The selection to put back once a format is shown. */
  const reselect = useRef<[number, number]>(null)

  useEffect(() => {
    const onSelect = () => {
      const active = document.activeElement
      // The color field of the bar takes the cursor while the selection is kept.
      if (bar.current?.contains(active)) return
      const sel = getSelection()
      if (!el.current || active !== el.current || !sel?.rangeCount || sel.isCollapsed) return setSelection(null)
      const at = sel.getRangeAt(0).getBoundingClientRect()
      setSelection({ ...caretOf(el.current), left: at.left, top: at.top - 6 })
    }
    document.addEventListener("selectionchange", onSelect)
    // The bar stays with the text while the page scrolls.
    document.addEventListener("scroll", onSelect, true)
    return () => {
      document.removeEventListener("selectionchange", onSelect)
      document.removeEventListener("scroll", onSelect, true)
    }
  }, [])

  useLayoutEffect(() => {
    const node = el.current
    if (reselect.current && node) {
      node.focus()
      setCaret(node, ...reselect.current)
      reselect.current = null
    }
    // A transformed parent, e.g. a dialog, moves a fixed element with it; the bar is moved back over the text.
    const b = bar.current
    if (!b || !selection) return
    const box = b.getBoundingClientRect()
    b.style.left = `${parseFloat(b.style.left) + selection.left - box.left}px`
    b.style.top = `${parseFloat(b.style.top) + selection.top - box.bottom}px`
  })

  function format(f: Format, start: number, end: number) {
    reselect.current = [start, end]
    onChange(formatRich(value, start, end, f))
  }

  return (
    <>
      <RichInput
        {...props}
        code={code}
        value={value}
        // A pasted line break would end the line early.
        onChange={(v) => onChange(singleLine ? v.replace(/\s*\n\s*/g, " ") : v)}
        inputRef={(node) => {
          el.current = node
          inputRef?.(node)
        }}
        onKeyDown={(e) => {
          onKeyDown?.(e)
          if (e.defaultPrevented) return
          const key = e.key.toLowerCase()
          if (singleLine && e.key === "Enter") return e.preventDefault()
          if (!(e.ctrlKey || e.metaKey) || (key !== "b" && key !== "e")) return
          // Code as a whole has nothing to switch to code.
          if (code && key === "e") return e.preventDefault()
          e.preventDefault()
          const { start, end } = caretOf(e.currentTarget)
          if (start === end) return
          const now = formatAt(value, start, end)
          format(key === "b" ? { bold: !now.bold } : { code: !now.code }, start, end)
        }}
      />
      {selection && (
        <FormatBar
          ref={bar}
          format={formatAt(value, selection.start, selection.end)}
          bold
          code={!code}
          onFormat={(f) => format(f, selection.start, selection.end)}
          style={{ position: "fixed", left: selection.left, top: selection.top }}
        />
      )}
    </>
  )
}

/** Formats the selected text: bold, code and a color, of the offered ones or any typed in. */
export function FormatBar({
  format,
  bold,
  code = true,
  onFormat,
  style,
  ref,
}: {
  format: { bold: boolean; code: boolean; color?: string }
  /** False where the text is bold as a whole. */
  bold: boolean
  /** False where the text is code as a whole. */
  code?: boolean
  onFormat: (format: Format) => void
  style: CSSProperties
  ref: Ref<HTMLDivElement>
}) {
  return (
    <div
      ref={ref}
      style={style}
      // Pressing a button keeps the text selected; only the color field takes the cursor.
      onMouseDown={(e) => e.target instanceof HTMLInputElement || e.preventDefault()}
      className="absolute z-50 flex -translate-y-full items-center gap-0.5 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
    >
      {bold && (
        <Tool label="Fett (Strg+B)" active={format.bold} onClick={() => onFormat({ bold: !format.bold })}>
          <BoldIcon className="size-3.5" />
        </Tool>
      )}
      {code && (
        <Tool label="Code (Strg+E)" active={format.code} onClick={() => onFormat({ code: !format.code })}>
          <CodeIcon className="size-3.5" />
        </Tool>
      )}
      <span className="mx-1 h-4 w-px bg-border" />
      <Tool label="Ohne Farbe" active={!format.color} onClick={() => onFormat({ color: null })}>
        <BanIcon className="size-3.5" />
      </Tool>
      {TEXT_COLORS.map((c) => (
        <Tool key={c} label={c} active={format.color?.toLowerCase() === c.toLowerCase()} onClick={() => onFormat({ color: c })}>
          <span className="size-3.5 rounded-full border border-border" style={{ background: c }} />
        </Tool>
      ))}
      <ColorInput onPick={(color) => onFormat({ color })} className="ml-1 w-20" />
    </div>
  )
}

/** A field for any HTML color, set with Enter; shown in its color once it is one. */
export function ColorInput({ onPick, className }: { onPick: (color: string) => void; className?: string }) {
  const [color, setColor] = useState("")
  const typed = color.trim()
  const valid = !!typed && CSS.supports("color", typed)
  return (
    <input
      value={color}
      onChange={(e) => setColor(e.target.value)}
      onKeyDown={(e) => {
        if (e.key !== "Enter") return
        e.preventDefault()
        if (valid) onPick(typed)
      }}
      placeholder="#Farbe"
      aria-label="Eigene Farbe, mit Enter setzen"
      className={cn(
        "h-6 rounded border bg-transparent px-1.5 font-mono text-xs outline-none placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-ring",
        typed && !valid && "text-destructive",
        className,
      )}
      style={valid ? { color: typed } : undefined}
    />
  )
}

function Tool({ label, active, onClick, children }: { label: string; active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Hint label={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        onClick={onClick}
        className={cn(
          "flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground",
          active && "bg-accent text-foreground",
        )}
      >
        {children}
      </button>
    </Hint>
  )
}
