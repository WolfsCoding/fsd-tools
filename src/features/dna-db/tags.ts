import { sameText, textKey } from "@/lib/text"
import { TAG_COLORS, type DnaEntry, type DnaTag, type TagColor, type TagPreset } from "./types"

export const TAG_COLOR_NAMES: Record<TagPreset, string> = {
  slate: "Grau",
  red: "Rot",
  amber: "Gelb",
  emerald: "Grün",
  sky: "Blau",
  violet: "Lila",
  pink: "Pink",
}

export function isTagPreset(color: TagColor): color is TagPreset {
  return (TAG_COLORS as readonly string[]).includes(color)
}

/** A typed hex color, e.g. "3B82F6" or "#38f", as "#rrggbb"; none for anything else. */
export function toHex(text: string) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text.trim())
  if (!m) return undefined
  const digits = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1]
  return `#${digits.toLowerCase()}`
}

/** Tag names are the same ignoring case and outer spaces. */
export function sameTag(a: string, b: string) {
  return sameText(a, b)
}

/** Every distinct tag across all entries (first spelling/color wins), sorted by name. */
export function collectTags(entries: DnaEntry[]): DnaTag[] {
  const byName = new Map<string, DnaTag>()
  for (const entry of entries) {
    for (const tag of entry.tags ?? []) {
      const key = textKey(tag.name)
      if (!byName.has(key)) byName.set(key, tag)
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
}
