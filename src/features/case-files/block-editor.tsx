import { useEffect, useLayoutEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode } from "react"
import {
  ArrowDownToLineIcon,
  ArrowLeftToLineIcon,
  ArrowRightToLineIcon,
  ArrowUpToLineIcon,
  CheckIcon,
  Columns3Icon,
  CopyIcon,
  GripVerticalIcon,
  HashIcon,
  ImageIcon,
  Heading1Icon,
  InfoIcon,
  ListChecksIcon,
  ListIcon,
  MinusIcon,
  PlusIcon,
  Repeat2Icon,
  Rows3Icon,
  Table2Icon,
  TextCursorInputIcon,
  Trash2Icon,
  TypeIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react"
import { cn } from "cn"
import { Hint } from "@/components/hint"
import { move, useReorder } from "@/components/use-reorder"
import { Checkbox } from "@/components/ui/checkbox"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Kbd } from "@/components/ui/kbd"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { removedToast } from "@/lib/undo"
import {
  blockOf,
  headerSrc,
  isTextish,
  markdownBlocks,
  NUMBER_PATTERN,
  NUMBER_TITLE,
  readBlocks,
  rowNumber,
  TEXT_TYPES,
  typeName,
  writeBlocks,
  type Block,
  type BlockType,
  type TextishBlock,
} from "./blocks"
import { caretOf, setCaret, textLength } from "./caret"
import { CHIP, FormatBar, RichInput } from "./rich-input"
import { formatAt, formatRich, plainText, splitRich, withoutBold, type Format } from "./rich-text"
import type { DocFormProps } from "./templates"
import { useColors } from "./use-case-files"

/** Where an own case file keeps its blocks. */
export const BLOCKS_KEY = "blocks"

const BLOCKS: { type: BlockType; icon: LucideIcon; description: string; shortcut?: string; keywords: string }[] = [
  { type: "section", icon: Heading1Icon, description: "Nummerierte Überschrift", shortcut: "#", keywords: "überschrift titel" },
  { type: "text", icon: TypeIcon, description: "Einfacher Absatz", keywords: "absatz" },
  { type: "bullet", icon: ListIcon, description: "Eine Zeile pro Punkt", shortcut: "-", keywords: "liste punkte" },
  { type: "check", icon: ListChecksIcon, description: "Punkte zum Abhaken", shortcut: "[]", keywords: "liste todo aufgabe haken" },
  { type: "table", icon: Table2Icon, description: "Eigene Spalten, Zeilen gezählt", shortcut: "/tabelle", keywords: "spalten zeilen" },
  { type: "fields", icon: TextCursorInputIcon, description: "Bezeichnung und Wert", keywords: "angaben label wert" },
  { type: "note", icon: InfoIcon, description: "Fett hervorgehobene Notiz", shortcut: ">", keywords: "notiz wichtig" },
  { type: "divider", icon: MinusIcon, description: "Horizontale Linie", shortcut: "---", keywords: "linie trenner" },
  { type: "header", icon: ImageIcon, description: "VPD-Header mit Titel", keywords: "bild banner kopf titelbild" },
]
const ICONS = Object.fromEntries(BLOCKS.map((b) => [b.type, b.icon])) as Record<BlockType, LucideIcon>

/** Typed at the start of a text, these turn it into another block. */
const SHORTCUTS: [prefix: string, type: BlockType][] = [
  ["--- ", "divider"],
  ["# ", "section"],
  ["- ", "bullet"],
  ["* ", "bullet"],
  ["[] ", "check"],
  ["[ ] ", "check"],
  ["> ", "note"],
  ["/tabelle ", "table"],
]

const SLASH = /^\/([^\s/]*)$/

function matches(query: string) {
  const q = query.toLowerCase()
  if (!q) return BLOCKS
  return BLOCKS.filter((b) => typeName(b.type).toLowerCase().includes(q) || b.keywords.includes(q)).sort(
    (a, b) => Number(typeName(b.type).toLowerCase().startsWith(q)) - Number(typeName(a.type).toLowerCase().startsWith(q)),
  )
}

type TableB = Extract<Block, { type: "table" }>
type FieldsB = Extract<Block, { type: "fields" }>

/** Where the cursor goes: a position, or a selection from and to. */
type Caret = "start" | "end" | number | readonly [number, number]

const insertAt =<T,>(items: readonly T[], index: number, item: T) => [...items.slice(0, index), item, ...items.slice(index)]

const newId = () => crypto.randomUUID()

/** The key of a block's first input; a divider has none. */
const inputKey = (b: Block) =>
  b.type === "table"
    ? `${b.id}:h0`
    : b.type === "fields"
      ? `${b.id}:k0`
      : b.type === "header"
        ? `${b.id}:title`
        : b.type === "divider"
          ? undefined
          : b.id

interface History {
  undo: string[]
  redo: string[]
  typed: { id: string; at: number }
}

/** Keeps `state` to go back to before a change; typing on in the same block within a second stays one step. */
function record(h: History, state: string, typing?: string) {
  const now = Date.now()
  if (!typing || typing !== h.typed.id || now - h.typed.at > 1000) h.undo.push(state)
  h.typed = { id: typing ?? "", at: now }
  h.redo = []
}
/** Shown while the page is empty. */
const START: Block[] = [{ id: "start", type: "text", text: "" }]

// The blocks look like their Markdown once pasted (see NoteMarkdown): quoted lines, inline code
// for values, thick rules and two-shaded tables.
const QUOTE = "border-l-[3px] border-l-muted-foreground/25 pl-4 text-sm leading-6"
const RULE = "border-t-[3px] border-muted-foreground/25"
const CHIP_INPUT = cn(CHIP, "field-sizing-content max-w-full min-w-[3ch] outline-none placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-ring")
/** Where the + and the handle sit, level with the first line of each block. */
const GUTTER_TOP: Record<BlockType, string> = {
  section: "top-0",
  text: "top-0",
  bullet: "top-0",
  check: "top-0",
  note: "top-0",
  table: "top-2.5",
  fields: "top-0",
  divider: "-top-0.5",
  header: "top-2",
}

const hasContent = (b: Block) =>
  isTextish(b)
    ? !!b.text.trim()
    : b.type === "table"
      ? [...b.columns, ...b.rows.flat()].some((c) => c.trim())
      : b.type === "fields"
        ? b.fields.some((f) => f.label.trim() || f.value.trim())
        : b.type === "header"
          ? !!b.title.trim()
          : false

/**
 * An own case file built from blocks, like a Notion page: every line is a block, "/" or a
 * shortcut turns it into another one, and the handle next to it moves, copies or removes it.
 */
export function BlockEditor({ values, onChange, onUpdate }: DocFormProps) {
  const { colors } = useColors()
  const stored = readBlocks(values[BLOCKS_KEY])
  const blocks = stored.length ? stored : START
  /** Earlier and undone states of the blocks, for Strg+Z and Strg+Y; the last change typed. */
  const history = useRef<History>({ undo: [], redo: [], typed: { id: "", at: 0 } })
  function set(next: readonly Block[], typing?: string) {
    record(history.current, writeBlocks(stored), typing)
    onChange(BLOCKS_KEY, writeBlocks(next))
  }
  /** Goes back one change, or forward again after going back. */
  function undo(redo: boolean) {
    const h = history.current
    const [from, to] = redo ? [h.redo, h.undo] : [h.undo, h.redo]
    const state = from.pop()
    if (state === undefined) return
    to.push(writeBlocks(stored))
    h.typed = { id: "", at: 0 }
    const restored = readBlocks(state)
    // The cursor goes to the first block that changed, or the last one if the change was at the end;
    // it mustn't be lost with a removed block, or the next Strg+Z goes to the browser.
    const changed = restored.find((b, i) => JSON.stringify(b) !== JSON.stringify(stored[i])) ?? restored[restored.length - 1]
    const key = changed && inputKey(changed)
    if (key) focusAfter(key, "end")
    else root.current?.focus()
    setSlash(null)
    onChange(BLOCKS_KEY, state)
  }
  const reorder = useReorder((from, to) => set(move([...blocks], from, to)))
  const [slash, setSlash] = useState<{ id: string; active: number } | null>(null)
  const [menu, setMenu] = useState<string | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const refs = useRef(new Map<string, HTMLElement>())
  /** Where the cursor goes after the next change. */
  const focusNext = useRef<{ key: string; at: Caret } | null>(null)
  /** The text selected in a block, which the format bar formats; where it is in the block's row. */
  const [selection, setSelection] = useState<{ id: string; start: number; end: number; left: number; top: number } | null>(null)
  const formatBar = useRef<HTMLDivElement>(null)

  function focus(key: string, at: Caret = "start") {
    const el = refs.current.get(key)
    if (!el) return
    el.focus()
    if (typeof at === "object") setCaret(el, at[0], at[1])
    else setCaret(el, at === "start" ? 0 : at === "end" ? textLength(el) : at)
  }

  useLayoutEffect(() => {
    const next = focusNext.current
    if (!next) return
    focusNext.current = null
    focus(next.key, next.at)
  })

  useEffect(() => {
    const onSelect = () => {
      const el = document.activeElement
      // The color field of the bar takes the cursor while the selection is kept.
      if (formatBar.current?.contains(el)) return
      const id = el instanceof HTMLElement ? el.dataset.formatId : undefined
      const sel = getSelection()
      const row = el?.closest("[data-block-row]")
      if (!id || !sel?.rangeCount || sel.isCollapsed || !row || !(el instanceof HTMLElement)) return setSelection(null)
      const at = sel.getRangeAt(0).getBoundingClientRect()
      const box = row.getBoundingClientRect()
      setSelection({ id, ...caretOf(el), left: Math.max(at.left - box.left, 0), top: at.top - box.top - 6 })
    }
    document.addEventListener("selectionchange", onSelect)
    return () => document.removeEventListener("selectionchange", onSelect)
  }, [])

  const ref = (key: string) => (el: HTMLElement | null) => {
    if (el) refs.current.set(key, el)
    else refs.current.delete(key)
  }
  const focusAfter = (key: string, at: Caret = "start") => (focusNext.current = { key, at })
  /** `typing` names the block typed in; changes to the same one a moment apart undo together. */
  const replace = (id: string, next: Block | Block[], typing?: string) => set(blocks.flatMap((b) => (b.id === id ? next : [b])), typing)
  const update = <B extends Block,>(b: B, patch: Partial<B>, typing?: string) => replace(b.id, { ...b, ...patch }, typing)

  function insertAfter(i: number, b: Block) {
    set([...blocks.slice(0, i + 1), b, ...blocks.slice(i + 1)])
  }

  /** Turns `b` into a block of `type`, keeping `text` where the new one has text. */
  function convert(b: Block, type: BlockType, md = "", at: "start" | "end" = "start") {
    setSlash(null)
    // An Abschnitt is written as code, a Hinweis as bold, so their text can't have those.
    const text = type === "section" || type === "header" ? plainText(md) : type === "note" ? withoutBold(md) : md
    if (type === "divider") {
      const after = blockOf("text", newId(), text)
      focusAfter(after.id)
      return replace(b.id, [blockOf("divider", b.id), after])
    }
    focusAfter(inputKey(blockOf(type, b.id)) ?? b.id, at)
    replace(b.id, blockOf(type, b.id, text))
  }

  /** Removes `b`; one with content can be put back from the toast. */
  function remove(b: Block) {
    const i = blocks.indexOf(b)
    set(blocks.filter((x) => x !== b))
    if (hasContent(b))
      removedToast(typeName(b.type), () =>
        onUpdate(BLOCKS_KEY, (v) => {
          const now = readBlocks(v)
          return writeBlocks([...now.slice(0, i), b, ...now.slice(i)])
        }),
      )
  }

  function addRow(b: TableB) {
    focusAfter(`${b.id}:${b.rows.length}:0`)
    update(b, { rows: [...b.rows, b.columns.map(() => "")] })
  }

  function addColumn(b: TableB) {
    focusAfter(`${b.id}:h${b.columns.length}`)
    update(b, { columns: [...b.columns, ""], rows: b.rows.map((row) => [...row, ""]) })
  }

  function addField(b: FieldsB, at = b.fields.length) {
    focusAfter(`${b.id}:k${at}`)
    update(b, { fields: [...b.fields.slice(0, at), { label: "", value: "" }, ...b.fields.slice(at)] })
  }

  function duplicate(b: Block) {
    const copy = { ...structuredClone(b), id: newId() }
    if (isTextish(copy)) focusAfter(copy.id, "end")
    insertAfter(blocks.indexOf(b), copy)
  }

  /** Moves the cursor to the input before or after `el`; false if there is none. */
  function moveFocus(el: HTMLElement, by: -1 | 1) {
    const all = [...(root.current?.querySelectorAll<HTMLElement>("[data-block-input]") ?? [])]
    const next = all[all.indexOf(el) + by]
    if (!next) return false
    next.focus()
    setCaret(next, by < 0 ? textLength(next) : 0)
    return true
  }

  /** Sets `format` on the selected text of `b`, which stays selected. */
  function applyFormat(b: TextishBlock, format: Format, start: number, end: number) {
    focusAfter(b.id, [start, end])
    update(b, { text: formatRich(b.text, start, end, format) })
  }

  function changeText(b: TextishBlock, text: string) {
    if (b.type === "text") {
      const hit = SHORTCUTS.find(([prefix]) => text.startsWith(prefix))
      // Pasted text may follow the shortcut, so the cursor stays behind it.
      if (hit) return convert(b, hit[1], text.slice(hit[0].length), "end")
      setSlash(SLASH.test(text) ? { id: b.id, active: 0 } : null)
    }
    update(b, { text }, b.id)
  }

  /** Pasted Markdown of several lines becomes its blocks, put in where the cursor is. */
  function paste(e: ClipboardEvent<HTMLDivElement>, b: TextishBlock, i: number) {
    const text = e.clipboardData.getData("text/plain")
    if (!text.includes("\n")) return
    const parsed = markdownBlocks(text, newId)
    // Plain lines stay text, as typed.
    if (!parsed.length || (parsed.length === 1 && parsed[0].type === "text")) return
    e.preventDefault()
    const { start, end } = caretOf(e.currentTarget)
    const [before, after] = splitRich(b.text, start, end)
    const last = parsed[parsed.length - 1]
    if (isTextish(last)) focusAfter(last.id, "end")
    setSlash(null)
    set([
      ...blocks.slice(0, i),
      ...(before.trim() && !SLASH.test(before) ? [{ ...b, text: before }] : []),
      ...parsed,
      ...(after.trim() ? [{ ...b, id: newId(), text: after }] : []),
      ...blocks.slice(i + 1),
    ])
  }

  function textKeyDown(e: KeyboardEvent<HTMLDivElement>, b: TextishBlock, i: number, items: typeof BLOCKS | null) {
    const el = e.currentTarget
    if (items && slash) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault()
        if (items.length) setSlash({ ...slash, active: (slash.active + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length })
        return
      }
      if ((e.key === "Enter" || e.key === "Tab") && items.length) {
        e.preventDefault()
        return convert(b, items[Math.min(slash.active, items.length - 1)].type)
      }
      if (e.key === "Escape") {
        e.preventDefault()
        return setSlash(null)
      }
    }
    const { start, end } = caretOf(el)
    const list = b.type === "bullet" || b.type === "check"
    const key = e.key.toLowerCase()
    if ((e.ctrlKey || e.metaKey) && (key === "b" || key === "e")) {
      e.preventDefault()
      if (start === end || b.type === "section" || (key === "b" && b.type === "note")) return
      const now = formatAt(b.text, start, end)
      return applyFormat(b, key === "b" ? { bold: !now.bold } : { code: !now.code }, start, end)
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      // Enter on an empty point ends the list.
      if (list && !b.text) return convert(b, "text")
      const [head, tail] = splitRich(b.text, start, end)
      const after = blockOf(list ? b.type : "text", newId(), tail)
      focusAfter(after.id)
      set([...blocks.slice(0, i), { ...b, text: head }, after, ...blocks.slice(i + 1)])
    } else if (e.key === "Backspace" && start === 0 && end === 0) {
      // At the start a block first becomes text, then joins the one before.
      if (b.type !== "text") {
        e.preventDefault()
        return convert(b, "text", b.text)
      }
      const prev = blocks[i - 1]
      if (!prev) return
      if (isTextish(prev)) {
        e.preventDefault()
        focusAfter(prev.id, plainText(prev.text).length)
        set([...blocks.slice(0, i - 1), { ...prev, text: prev.text + b.text }, ...blocks.slice(i + 1)])
      } else if (prev.type === "divider") {
        e.preventDefault()
        focusAfter(b.id)
        set(blocks.filter((x) => x !== prev))
      } else if (!b.text) {
        e.preventDefault()
        moveFocus(el, -1)
        set(blocks.filter((x) => x !== b))
      }
    } else if ((e.key === "ArrowUp" && start === 0) || (e.key === "ArrowDown" && end === textLength(el))) {
      if (moveFocus(el, e.key === "ArrowUp" ? -1 : 1)) e.preventDefault()
    }
  }

  function addAtEnd() {
    const last = blocks[blocks.length - 1]
    if (last?.type === "text" && !last.text) return refs.current.get(last.id)?.focus()
    const b = blockOf("text", newId())
    focusAfter(b.id)
    set([...blocks, b])
  }

  let number = 0

  return (
    <div
      ref={root}
      // Takes the cursor after an undo leaves no input to put it in, so Strg+Z still lands here.
      tabIndex={-1}
      className="outline-none"
      onKeyDown={(e) => {
        const key = e.key.toLowerCase()
        if (!(e.ctrlKey || e.metaKey) || e.altKey || (key !== "z" && key !== "y")) return
        // The browser's own undo would only reach into the field with the cursor.
        e.preventDefault()
        undo(key === "y" || e.shiftKey)
      }}
    >
      {blocks.map((b, i) => {
        const prevType = blocks[i - 1]?.type
        const nextType = blocks[i + 1]?.type
        const first = prevType !== b.type
        const last = nextType !== b.type
        const query = b.type === "text" && slash?.id === b.id ? SLASH.exec(b.text)?.[1] : undefined
        const items = query === undefined ? null : matches(query)
        if (b.type === "section") number++

        const area = (className: string, placeholder: string) =>
          isTextish(b) && (
            <RichInput
              inputRef={ref(b.id)}
              data-format-id={b.type === "section" ? undefined : b.id}
              value={b.text}
              placeholder={placeholder}
              aria-label={typeName(b.type)}
              onChange={(text) => changeText(b, text)}
              onKeyDown={(e) => textKeyDown(e, b, i, items)}
              onPaste={(e) => paste(e, b, i)}
              className={className}
            />
          )

        let body: ReactNode
        switch (b.type) {
          case "section":
            body = (
              <div className={cn(QUOTE, "flex flex-wrap items-baseline gap-1")} style={{ color: colors.heading }}>
                <code className={cn(CHIP, "select-none")}>{number}.</code>
                <code className={cn(CHIP, "flex max-w-full items-baseline")}>
                  {area("max-w-full before:text-current/50", "Abschnitt")}:
                </code>
              </div>
            )
            break
          case "text":
            body = (
              <Popover open={!!items} onOpenChange={(open) => !open && setSlash(null)}>
                <PopoverAnchor asChild>
                  {/* An empty line has no quote in the Markdown, so it shows none until it is written in. */}
                  <div className={cn(QUOTE, !b.text && "border-l-transparent focus-within:border-l-muted-foreground/25")}>
                    {area(
                      cn(blocks.length > 1 && "before:opacity-0 focus:before:opacity-100"),
                      "Tippe / für Bausteine oder schreib einfach los",
                    )}
                  </div>
                </PopoverAnchor>
                {items && slash && (
                  <PopoverContent
                    align="start"
                    className="w-80 gap-0 p-1"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    onCloseAutoFocus={(e) => e.preventDefault()}
                    onInteractOutside={(e) => {
                      if (e.target instanceof Node && refs.current.get(b.id)?.contains(e.target)) e.preventDefault()
                    }}
                  >
                    <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                      {query ? (
                        <>
                          Bausteine für <span className="text-foreground">/{query}</span>
                        </>
                      ) : (
                        "Bausteine"
                      )}
                    </p>
                    {items.length ? (
                      items.map((m, k) => (
                        <button
                          key={m.type}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onMouseEnter={() => setSlash({ id: b.id, active: k })}
                          onClick={() => convert(b, m.type)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                            k === Math.min(slash.active, items.length - 1) && "bg-accent",
                          )}
                        >
                          <m.icon className="size-4 shrink-0 text-muted-foreground" />
                          <span>{typeName(m.type)}</span>
                          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{m.description}</span>
                          {m.shortcut && <Kbd>{m.shortcut}</Kbd>}
                        </button>
                      ))
                    ) : (
                      <p className="py-6 text-center text-sm text-muted-foreground">Keine Treffer</p>
                    )}
                  </PopoverContent>
                )}
              </Popover>
            )
            break
          case "bullet":
          case "check":
            body = (
              <div className={cn(QUOTE, "flex items-start")}>
                <span className="flex h-6 w-7 shrink-0 items-center pl-1.5">
                  {b.type === "check" ? (
                    <Checkbox
                      checked={b.checked}
                      onCheckedChange={(c) => update(b, { checked: c === true })}
                      aria-label="Abhaken"
                      className="size-3.5 [&_svg]:size-3!"
                    />
                  ) : (
                    <span className="size-1.5 rounded-full bg-muted-foreground/60" />
                  )}
                </span>
                {area("", b.type === "check" ? "Aufgabe" : "Punkt")}
              </div>
            )
            break
          case "note":
            body = <div className={cn(QUOTE, "font-semibold")}>{area("", "Hinweis")}</div>
            break
          case "divider":
            body = (
              <div className="py-2">
                <hr className={RULE} />
              </div>
            )
            break
          case "header": {
            const title = (
              <input
                ref={ref(`${b.id}:title`)}
                data-block-input
                value={b.title}
                placeholder="Titel oder Bild-Link"
                aria-label="Titel des Header-Bilds"
                onChange={(e) => update(b, { title: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return
                  e.preventDefault()
                  const after = blockOf("text", newId())
                  focusAfter(after.id)
                  insertAfter(i, after)
                }}
                className="h-8 w-72 max-w-full rounded-md border bg-popover px-2.5 text-center text-sm shadow-md outline-none placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-ring"
              />
            )
            // The input stays in place when the picture comes in, so typing the title goes on.
            body = (
              <div className="relative">
                {b.title.trim() ? (
                  <img src={headerSrc(b.title)} width={b.width ?? 800}alt={`Header-Bild: ${b.title.trim()}`} className="mx-auto max-w-full" />
                ) : (
                  <div className="flex h-28 justify-center rounded-md border border-dashed pt-6 text-muted-foreground">
                    <ImageIcon className="size-4" />
                  </div>
                )}
                {/* Over the picture only while the pointer or the cursor is on it. */}
                <div
                  className={cn(
                    "absolute inset-x-0 bottom-5 flex justify-center",
                    b.title.trim() && "bottom-0 translate-y-1/2 opacity-0 group-focus-within/block:opacity-100 group-hover/block:opacity-100",
                  )}
                >
                  {title}
                </div>
              </div>
            )
            break
          }
          case "table":
            body = <TableBlock block={b} inputRef={ref} onChange={(patch) => update(b, patch, b.id)} focus={focus} focusAfter={focusAfter} />
            break
          case "fields":
            body = (
              <FieldsBlock block={b} inputRef={ref} onChange={(patch) => update(b, patch, b.id)} focus={focus} onAddField={(at) => addField(b, at)} />
            )
            break
        }

        return (
          <div
            key={b.id}
            {...reorder.row(i)}
            className={cn(
              "group/block my-3",
              // A list is one quote, its points without space between them.
              (b.type === "bullet" || b.type === "check") && !first && "mt-0",
              (b.type === "bullet" || b.type === "check") && !last && "mb-0",
              reorder.rowClass(i),
            )}
          >
            {/* Every Abschnitt after the first, and a header image, are set off by a rule, as in the Markdown. */}
            {i > 0 && (b.type === "section" || b.type === "header" || prevType === "header") && <hr className={cn(RULE, "my-5 ml-12")} />}
            <div data-block-row className="relative pl-12">
              <div
                className={cn(
                  "absolute left-0 flex gap-0.5 opacity-0 transition-opacity group-focus-within/block:opacity-100 group-hover/block:opacity-100",
                  menu === b.id && "opacity-100",
                  GUTTER_TOP[b.type],
                )}
              >
                <Hint label="Baustein darunter einfügen">
                  <button
                    type="button"
                    aria-label="Baustein darunter einfügen"
                    onClick={() => {
                      const nb = blockOf("text", newId(), "/")
                      focusAfter(nb.id, "end")
                      setSlash({ id: nb.id, active: 0 })
                      insertAfter(i, nb)
                    }}
                    className="flex h-6 w-5 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <PlusIcon className="size-3.5" />
                  </button>
                </Hint>
                {/* Not modal: a modal menu would take back the focus its items move to a new row or block. */}
                <DropdownMenu modal={false} open={menu === b.id} onOpenChange={(open) => setMenu(open ? b.id : null)}>
                  <Hint label="Ziehen zum Verschieben, klicken für Menü">
                    {/* A press may start a drag, so the menu opens on the click instead of the trigger's pointerdown. */}
                    <button
                      type="button"
                      aria-label={`${typeName(b.type)}: Menü`}
                      {...reorder.handle(i)}
                      onClick={() => setMenu(b.id)}
                      className={cn(
                        "relative flex h-6 w-5 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground active:cursor-grabbing",
                        menu === b.id && "bg-accent text-foreground",
                      )}
                    >
                      <GripVerticalIcon className="size-3.5" />
                      <DropdownMenuTrigger asChild>
                        <span aria-hidden className="pointer-events-none absolute inset-0" />
                      </DropdownMenuTrigger>
                    </button>
                  </Hint>
                  <DropdownMenuContent align="start" className="w-52" onCloseAutoFocus={(e) => e.preventDefault()}>
                    <DropdownMenuLabel>{typeName(b.type)}</DropdownMenuLabel>
                    <DropdownMenuItem onSelect={() => duplicate(b)}>
                      <CopyIcon /> Duplizieren
                    </DropdownMenuItem>
                    {b.type === "table" && (
                      <>
                        <DropdownMenuItem onSelect={() => addRow(b)}>
                          <Rows3Icon /> Zeile hinzufügen
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => addColumn(b)}>
                          <Columns3Icon /> Spalte hinzufügen
                        </DropdownMenuItem>
                      </>
                    )}
                    {b.type === "fields" && (
                      <DropdownMenuItem onSelect={() => addField(b)}>
                        <PlusIcon /> Feld hinzufügen
                      </DropdownMenuItem>
                    )}
                    {isTextish(b) && (
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          <Repeat2Icon /> Umwandeln in
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-44">
                          {TEXT_TYPES.map((t) => {
                            const Icon = ICONS[t]
                            return (
                              <DropdownMenuItem key={t} onSelect={() => convert(b, t, b.text, "end")}>
                                <Icon /> {typeName(t)}
                                {t === b.type && <CheckIcon className="ml-auto" />}
                              </DropdownMenuItem>
                            )
                          })}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => remove(b)}>
                      <Trash2Icon /> Löschen
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {body}
              {selection?.id === b.id && isTextish(b) && (
                <FormatBar
                  ref={formatBar}
                  format={formatAt(b.text, selection.start, selection.end)}
                  bold={b.type !== "note"}
                  onFormat={(format) => applyFormat(b, format, selection.start, selection.end)}
                  style={{ left: selection.left, top: selection.top }}
                />
              )}
            </div>
          </div>
        )
      })}
      {/* Clicking below the last block writes on. */}
      <div className="h-10 cursor-text" onClick={addAtEnd} />
    </div>
  )
}

/** A small ×, shown while the pointer is over its `group`. Left out of Tab, which goes from value to value. */
function RemoveButton({ label, onClick, className }: { label: string; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      onClick={onClick}
      aria-label={label}
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground/70 opacity-0 hover:bg-accent hover:text-foreground",
        className,
      )}
    >
      <XIcon className="size-3" />
    </button>
  )
}

interface PartProps<B extends Block> {
  block: B
  inputRef: (key: string) => (el: HTMLInputElement | null) => void
  onChange: (patch: Partial<B>) => void
  /** Puts the cursor into an input of the block now. */
  focus: (key: string, at?: "start" | "end") => void
}

const TH = "relative border-r border-b border-border bg-muted/70 px-3 py-2.5 text-left align-middle font-semibold last:border-r-0"
const TD = "relative border-r border-b border-border px-3 py-2 align-middle last:border-r-0 group-last/row:border-b-0"

/** A table with columns of its own; its rows are numbered like every table of the case files, unless that column was removed. */
function TableBlock({
  block: { id, columns, rows, numbered = true, numberTitle, numberPattern },
  inputRef,
  onChange,
  focus,
  focusAfter,
}: PartProps<TableB> & { focusAfter: (key: string) => void }) {
  /** The cell the context menu was opened on: row -1 is the header, column -1 the numbers. */
  const [at, setAt] = useState({ r: -1, c: -1 })
  const setCell = (r: number, c: number, v: string) =>
    onChange({ rows: rows.map((row, i) => (i === r ? row.map((x, j) => (j === c ? v : x)) : row)) })
  const insertRow = (r: number, c: number) => {
    focusAfter(`${id}:${r}:${Math.max(c, 0)}`)
    onChange({ rows: insertAt(rows, r, columns.map(() => "")) })
  }
  const insertColumn = (c: number) => {
    focusAfter(`${id}:h${c}`)
    onChange({ columns: insertAt(columns, c, ""), rows: rows.map((row) => insertAt(row, c, "")) })
  }
  const removeRow = (r: number) => onChange({ rows: rows.filter((_, i) => i !== r) })
  const removeColumn = (c: number) => onChange({ columns: columns.filter((_, j) => j !== c), rows: rows.map((row) => row.filter((_, j) => j !== c)) })
  /** Enter goes down the column, adding a row below the last one. */
  const down = (e: KeyboardEvent<HTMLInputElement>, r: number, c: number) => {
    if (e.key !== "Enter") return
    e.preventDefault()
    if (r + 1 >= rows.length) return insertRow(rows.length, c)
    focus(`${id}:${r + 1}:${c}`)
  }
  const cellMenu = (r: number, c: number) => ({ onContextMenu: () => setAt({ r, c }) })
  // The numbers can always go; the last column of values stays.
  const canRemoveColumn = at.c < 0 ? numbered : columns.length > 1

  return (
    <div className={cn(QUOTE, "leading-normal")}>
      {/* The padding keeps the table's ring from being cut off by the scrolling. */}
      <div className="overflow-x-auto p-px">
        {/* Not modal, so the cursor can go into the row or column it adds. */}
        <ContextMenu modal={false}>
          <ContextMenuTrigger asChild>
            <table className="w-full border-separate border-spacing-0 overflow-hidden rounded-md ring-1 ring-border">
              <thead>
                <tr>
                  {numbered && (
                    <th className={TH} {...cellMenu(-1, -1)}>
                      <input
                        ref={inputRef(`${id}:nh`)}
                        data-block-input
                        value={numberTitle ?? NUMBER_TITLE}
                        placeholder={NUMBER_TITLE}
                        aria-label="Titel der Nummerierung"
                        onChange={(e) => onChange({ numberTitle: e.target.value })}
                        className="field-sizing-content min-w-[1ch] bg-transparent outline-none placeholder:text-muted-foreground/60"
                      />
                    </th>
                  )}
                  {columns.map((col, c) => (
                    <th key={c} className={cn(TH, "group/col")} {...cellMenu(-1, c)}>
                      <input
                        ref={inputRef(`${id}:h${c}`)}
                        data-block-input
                        value={col}
                        placeholder={`Spalte ${c + 1}`}
                        aria-label={`Spalte ${c + 1}`}
                        onChange={(e) => onChange({ columns: columns.map((x, j) => (j === c ? e.target.value : x)) })}
                        onKeyDown={(e) => down(e, -1, c)}
                        className="w-full min-w-16 bg-transparent outline-none placeholder:text-muted-foreground/60"
                      />
                      {columns.length > 1 && (
                        <RemoveButton
                          label={`Spalte ${c + 1} entfernen`}
                          onClick={() => removeColumn(c)}
                          className="absolute top-1/2 right-1 -translate-y-1/2 group-hover/col:opacity-100"
                        />
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, r) => (
                  <tr key={r} className="group/row odd:bg-muted/20 even:bg-muted/50">
                    {numbered && (
                      <td className={TD} {...cellMenu(r, -1)}>
                        {/* The first row's number is the pattern the others count on from. */}
                        {r === 0 ? (
                          <Hint label="Muster der Nummerierung, z. B. Nr. 1">
                            <input
                              ref={inputRef(`${id}:n`)}
                              data-block-input
                              value={numberPattern ?? NUMBER_PATTERN}
                              placeholder={NUMBER_PATTERN}
                              aria-label="Muster der Nummerierung"
                              onChange={(e) => onChange({ numberPattern: e.target.value })}
                              className={CHIP_INPUT}
                            />
                          </Hint>
                        ) : (
                          <code className={CHIP}>{rowNumber(numberPattern ?? "", r)}</code>
                        )}
                      </td>
                    )}
                    {row.map((v, c) => (
                      <td key={c} className={TD} {...cellMenu(r, c)}>
                        {/* The whole cell puts the cursor into its value. */}
                        <label className="flex cursor-text">
                          <input
                            ref={inputRef(`${id}:${r}:${c}`)}
                            data-block-input
                            value={v}
                            placeholder="N/A"
                            aria-label={`${columns[c] || `Spalte ${c + 1}`} (Zeile ${r + 1})`}
                            onChange={(e) => setCell(r, c, e.target.value)}
                            onKeyDown={(e) => down(e, r, c)}
                            className={CHIP_INPUT}
                          />
                        </label>
                        {rows.length > 1 && c === row.length - 1 && (
                          <RemoveButton
                            label={`Zeile ${r + 1} entfernen`}
                            onClick={() => removeRow(r)}
                            className="absolute top-1/2 right-1 -translate-y-1/2 group-hover/row:opacity-100"
                          />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-52" onCloseAutoFocus={(e) => e.preventDefault()}>
            {at.r >= 0 && (
              <ContextMenuItem onSelect={() => insertRow(at.r, at.c)}>
                <ArrowUpToLineIcon /> Zeile darüber einfügen
              </ContextMenuItem>
            )}
            <ContextMenuItem onSelect={() => insertRow(at.r + 1, at.c)}>
              <ArrowDownToLineIcon /> Zeile darunter einfügen
            </ContextMenuItem>
            {at.c >= 0 && (
              <ContextMenuItem onSelect={() => insertColumn(at.c)}>
                <ArrowLeftToLineIcon /> Spalte links einfügen
              </ContextMenuItem>
            )}
            <ContextMenuItem onSelect={() => insertColumn(at.c + 1)}>
              <ArrowRightToLineIcon /> Spalte rechts einfügen
            </ContextMenuItem>
            {!numbered && (
              <ContextMenuItem onSelect={() => onChange({ numbered: true })}>
                <HashIcon /> Nummerierung einfügen
              </ContextMenuItem>
            )}
            {((at.r >= 0 && rows.length > 1) || canRemoveColumn) && <ContextMenuSeparator />}
            {at.r >= 0 && rows.length > 1 && (
              <ContextMenuItem variant="destructive" onSelect={() => removeRow(at.r)}>
                <Trash2Icon /> Zeile löschen
              </ContextMenuItem>
            )}
            {canRemoveColumn && (
              <ContextMenuItem variant="destructive" onSelect={() => (at.c < 0 ? onChange({ numbered: false }) : removeColumn(at.c))}>
                <Trash2Icon /> Spalte löschen
              </ContextMenuItem>
            )}
          </ContextMenuContent>
        </ContextMenu>
      </div>
    </div>
  )
}

/** Labels with their values, written as `**LABEL:** \`value\`` lines. */
function FieldsBlock({
  block: { id, fields },
  inputRef,
  onChange,
  focus,
  onAddField,
}: PartProps<FieldsB> & { onAddField: (at: number) => void }) {
  const setField = (i: number, patch: Partial<(typeof fields)[number]>) =>
    onChange({ fields: fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) })

  return (
    <div className={QUOTE}>
      {fields.map((f, i) => (
        <div key={i} className="group/field flex min-h-6 flex-wrap items-center gap-x-1">
          <span className="flex items-baseline font-semibold">
            <input
              ref={inputRef(`${id}:k${i}`)}
              data-block-input
              value={f.label}
              placeholder="Bezeichnung"
              aria-label={`Bezeichnung von Feld ${i + 1}`}
              onChange={(e) => setField(i, { label: e.target.value })}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return
                e.preventDefault()
                focus(`${id}:v${i}`, "end")
              }}
              className="field-sizing-content min-w-[2ch] bg-transparent uppercase outline-none placeholder:font-normal placeholder:text-muted-foreground/60 placeholder:normal-case"
            />
            :
          </span>
          <input
            ref={inputRef(`${id}:v${i}`)}
            data-block-input
            value={f.value}
            placeholder="N/A"
            aria-label={f.label || `Feld ${i + 1}`}
            onChange={(e) => setField(i, { value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return
              e.preventDefault()
              onAddField(i + 1)
            }}
            className={CHIP_INPUT}
          />
          {fields.length > 1 && (
            <RemoveButton
              label={`Feld ${i + 1} entfernen`}
              onClick={() => onChange({ fields: fields.filter((_, j) => j !== i) })}
              className="group-hover/field:opacity-100"
            />
          )}
        </div>
      ))}
    </div>
  )
}
