import { sameText, textKey } from "@/lib/text"
import { TAG_COLORS, type DnaEntry, type DnaTag, type TagColor } from "./types"

export const TAG_COLOR_NAMES: Record<TagColor, string> = {
  slate: "Grau",
  red: "Rot",
  amber: "Gelb",
  emerald: "Grün",
  sky: "Blau",
  violet: "Lila",
  pink: "Pink",
}

export function isTagColor(value: unknown): value is TagColor {
  return TAG_COLORS.includes(value as TagColor)
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
