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
  slate: "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  red: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  sky: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  violet: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  pink: "border-pink-500/30 bg-pink-500/10 text-pink-700 dark:text-pink-300",
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
        "inline-flex h-5 items-center gap-1 rounded-full border px-2 text-xs font-medium whitespace-nowrap",
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
          className="rounded-full p-0.5 opacity-70 hover:bg-foreground/10 hover:opacity-100"
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
