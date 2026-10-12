import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { Combobox, type ComboboxOption } from "@/components/combobox"
import { textKey } from "@/lib/text"
import { TagBadge, TagColorPicker } from "./tag-badge"
import { sameTag } from "./tags"
import type { DnaTag, TagColor } from "./types"

const NEW_HINT = "Neuer Tag"

/**
 * Chips plus the shared combobox. Typing suggests tags already used on other entries;
 * a name that matches one reuses its color, anything else is created with the color
 * picked below the field.
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
  const [newColor, setNewColor] = useState<TagColor>("sky")

  useEffect(() => {
    if (autoFocus) ref.current?.querySelector("input")?.focus()
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
    const tag = knownTags.find((t) => sameTag(t.name, tagName)) ?? { name: tagName.trim(), color: newColor }
    if (!value.some((t) => sameTag(t.name, tag.name))) onChange([...value, tag])
    setDraft("")
  }

  // After the combobox: it handles the keys of its open list itself.
  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.defaultPrevented) return
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
    <div ref={ref} className="grid gap-2" onKeyDown={handleKeyDown}>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((tag) => (
            <TagBadge key={tag.name} tag={tag} onRemove={() => onChange(value.filter((t) => t !== tag))} />
          ))}
        </div>
      )}
      <Combobox
        id={id}
        value={draft}
        onChange={setDraft}
        options={options}
        onPick={add}
        placeholder="Tag eingeben…"
        aria-label={id ? undefined : "Tag hinzufügen"}
      />
      {isNew && (
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="text-xs text-muted-foreground">Farbe für „{name}“</span>
          <TagColorPicker value={newColor} onChange={setNewColor} />
        </div>
      )}
    </div>
  )
}
