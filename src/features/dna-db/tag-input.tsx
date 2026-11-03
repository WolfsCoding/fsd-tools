import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { Combobox, type ComboboxOption } from "@/components/combobox"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { textKey } from "@/lib/text"
import { TagBadge, TagColorPicker } from "./tag-badge"
import { sameTag } from "./tags"
import type { DnaTag, TagColor } from "./types"

const NEW_HINT = "Neuer Tag"
/** What the color of a new tag starts at. */
const NEW_COLOR: TagColor = "sky"

/**
 * Chips plus the shared combobox. Typing suggests tags already used on other entries;
 * a name that matches one reuses its color. Anything else asks for its color first, in a
 * dropdown under the field with the cursor in its hex field. Clicking a chip changes its color.
 */
export function TagInput({
  id,
  value,
  onChange,
  knownTags,
  autoFocus,
}: {
  id?: string
  value: DnaTag[]
  onChange: (tags: DnaTag[]) => void
  /** Tags from all entries, offered as suggestions. */
  knownTags: DnaTag[]
  autoFocus?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState("")
  /** The name of a new tag while its color is asked for. */
  const [naming, setNaming] = useState<string>()
  const focusInput = () => ref.current?.querySelector("input")?.focus()

  useEffect(() => {
    if (autoFocus) focusInput()
  }, [autoFocus])

  const name = draft.trim()
  const known = knownTags.find((t) => sameTag(t.name, name))
  const isAdded = value.some((t) => sameTag(t.name, name))
  const isNew = !!name && !known && !isAdded
  // The one typed exactly goes first, so Enter picks it; a new name comes last.
  const options: ComboboxOption[] = [
    ...knownTags
      .filter((t) => !value.some((v) => sameTag(v.name, t.name)) && textKey(t.name).includes(textKey(name)))
      .sort((a, b) => Number(!sameTag(b.name, name)) - Number(!sameTag(a.name, name)))
      .map((t) => t.name),
    ...(isNew ? [{ value: name, hint: NEW_HINT, create: true }] : []),
  ]

  function add(tagName: string) {
    const known = knownTags.find((t) => sameTag(t.name, tagName))
    if (!known) return setNaming(tagName.trim())
    if (!value.some((t) => sameTag(t.name, known.name))) onChange([...value, known])
    setDraft("")
  }

  function create(color: TagColor) {
    if (naming && !value.some((t) => sameTag(t.name, naming))) onChange([...value, { name: naming, color }])
    setNaming(undefined)
    setDraft("")
  }

  // After the combobox: it handles the keys of its open list itself.
  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    // Keys on the chips, and in the colors through their popovers, come here too; only the field's count.
    if (e.defaultPrevented || !(e.target instanceof HTMLInputElement) || !ref.current?.contains(e.target)) return
    if (e.key === "Enter" || e.key === ",") {
      // An empty field lets Enter through so it still submits the surrounding form.
      if (!name) {
        if (e.key === ",") e.preventDefault()
        return
      }
      e.preventDefault()
      if (!isAdded) add(name)
      else setDraft("")
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div onKeyDown={handleKeyDown}>
      {/* Escape or a click elsewhere leaves the name in the field, to be added again with Enter. */}
      <Popover open={naming !== undefined} onOpenChange={(open) => !open && setNaming(undefined)}>
        <PopoverAnchor asChild>
          {/* One box like an input: the chips, then the text typed after them. */}
          <div
            ref={ref}
            onClick={(e) => e.target === e.currentTarget && focusInput()}
            className="flex min-h-9 cursor-text flex-wrap items-center gap-1 rounded-lg border border-input px-1.5 py-1 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"
          >
            {value.map((tag) => (
              <TagBadge
                key={tag.name}
                tag={tag}
                onRemove={() => onChange(value.filter((t) => t !== tag))}
                onColorChange={(color) => onChange(value.map((t) => (t === tag ? { ...t, color } : t)))}
                onColorClose={focusInput}
              />
            ))}
            <div className="min-w-32 flex-1">
              <Combobox
                id={id}
                value={draft}
                onChange={setDraft}
                options={options}
                onPick={add}
                placeholder="Tag eingeben…"
                aria-label={id ? undefined : "Tag hinzufügen"}
                className="h-6 rounded-none border-0 bg-transparent px-1 shadow-none focus-visible:ring-0 dark:bg-transparent"
              />
            </div>
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="start"
          className="w-(--radix-popover-trigger-width) gap-2 p-2"
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            if (e.currentTarget instanceof HTMLElement) e.currentTarget.querySelector("input")?.focus()
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault()
            focusInput()
          }}
        >
          <p className="px-1 text-xs text-muted-foreground">Farbe für „{naming}“</p>
          <TagColorPicker value={NEW_COLOR} onChange={create} />
        </PopoverContent>
      </Popover>
    </div>
  )
}
