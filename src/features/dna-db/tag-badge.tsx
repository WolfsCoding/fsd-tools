import { cn } from "cn"
import { XIcon } from "lucide-react"
import { Hint } from "@/components/hint"
import { TAG_COLOR_NAMES } from "./tags"
import { TAG_COLORS, type DnaTag, type TagColor } from "./types"

// Literal class names so Tailwind picks them up.
const TAG_DOT: Record<TagColor, string> = {
  slate: "bg-slate-400",
  red: "bg-red-400",
  amber: "bg-amber-400",
  emerald: "bg-emerald-400",
  sky: "bg-sky-400",
  violet: "bg-violet-400",
  pink: "bg-pink-400",
}

const TAG_BADGE: Record<TagColor, string> = {
  slate: "bg-slate-600 text-white",
  red: "bg-red-600 text-white",
  amber: "bg-amber-500 text-amber-950",
  emerald: "bg-emerald-600 text-white",
  sky: "bg-sky-600 text-white",
  violet: "bg-violet-600 text-white",
  pink: "bg-pink-600 text-white",
}

export function TagDot({ color, className }: { color: TagColor; className?: string }) {
  return (
    <span aria-hidden className={cn("size-2 shrink-0 rounded-full", TAG_DOT[color], className)} />
  )
}

export function TagBadge({
  tag,
  onRemove,
}: {
  tag: DnaTag
  onRemove?: () => void
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-sm px-2 text-xs font-semibold whitespace-nowrap",
        TAG_BADGE[tag.color],
        onRemove && "pr-0.5",
      )}
    >
      {tag.name}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Tag „${tag.name}“ entfernen`}
          className="rounded-sm p-0.5 opacity-70 hover:bg-black/15 hover:opacity-100"
        >
          <XIcon className="size-3" />
        </button>
      )}
    </span>
  )
}

export function TagColorPicker({
  value,
  onChange,
}: {
  value: TagColor
  onChange: (color: TagColor) => void
}) {
  return (
    <div role="radiogroup" aria-label="Farbe" className="flex items-center gap-1">
      {TAG_COLORS.map((color) => (
        <Hint key={color} label={TAG_COLOR_NAMES[color]}>
          <button
            type="button"
            role="radio"
            aria-checked={value === color}
            aria-label={TAG_COLOR_NAMES[color]}
            onClick={() => onChange(color)}
            className={cn(
              "flex size-6 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring",
              value === color && "ring-2 ring-foreground/40",
            )}
          >
            <TagDot color={color} className="size-3.5" />
          </button>
        </Hint>
      ))}
    </div>
  )
}
