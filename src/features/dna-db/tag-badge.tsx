import { useState, type CSSProperties } from "react"
import { cn } from "cn"
import { XIcon } from "lucide-react"
import { Hint } from "@/components/hint"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { isTagPreset, TAG_COLOR_NAMES, toHex } from "./tags"
import { TAG_COLORS, type DnaTag, type TagColor, type TagPreset } from "./types"

// Literal class names so Tailwind picks them up. The chips have the color of their dot.
const TAG_DOT: Record<TagPreset, string> = {
  slate: "bg-slate-400",
  red: "bg-red-400",
  amber: "bg-amber-400",
  emerald: "bg-emerald-400",
  sky: "bg-sky-400",
  violet: "bg-violet-400",
  pink: "bg-pink-400",
}

const TAG_BADGE: Record<TagPreset, string> = {
  slate: "bg-slate-400 text-slate-950",
  red: "bg-red-400 text-red-950",
  amber: "bg-amber-400 text-amber-950",
  emerald: "bg-emerald-400 text-emerald-950",
  sky: "bg-sky-400 text-sky-950",
  violet: "bg-violet-400 text-violet-950",
  pink: "bg-pink-400 text-pink-950",
}

/** Dark text on a light color, white on a dark one. */
function textOn(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) >= 128 ? "#1c1917" : "#fff"
}

const badgeStyle = (color: TagColor): CSSProperties | undefined =>
  isTagPreset(color) ? undefined : { background: color, color: textOn(color) }

export function TagDot({ color, className }: { color: TagColor; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("size-2 shrink-0 rounded-full", isTagPreset(color) && TAG_DOT[color], className)}
      style={isTagPreset(color) ? undefined : { background: color }}
    />
  )
}

export function TagBadge({
  tag,
  onRemove,
  onColorChange,
  onColorClose,
}: {
  tag: DnaTag
  onRemove?: () => void
  /** Clicking the name then picks another color. */
  onColorChange?: (color: TagColor) => void
  /** Where the cursor goes once the colors close; back to the name otherwise. */
  onColorClose?: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-sm px-2 text-xs font-semibold whitespace-nowrap",
        isTagPreset(tag.color) && TAG_BADGE[tag.color],
        onRemove && "pr-0.5",
      )}
      style={badgeStyle(tag.color)}
    >
      {onColorChange ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button type="button" aria-label={`Farbe von „${tag.name}“ ändern`} className="rounded-sm hover:underline">
              {tag.name}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-auto p-2"
            onOpenAutoFocus={(e) => {
              e.preventDefault()
              if (e.currentTarget instanceof HTMLElement) e.currentTarget.querySelector("input")?.focus()
            }}
            onCloseAutoFocus={(e) => {
              if (!onColorClose) return
              e.preventDefault()
              onColorClose()
            }}
          >
            <TagColorPicker
              value={tag.color}
              onChange={(color) => {
                onColorChange(color)
                setOpen(false)
              }}
            />
          </PopoverContent>
        </Popover>
      ) : (
        tag.name
      )}
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

/** The presets, and a field for any color as hex, set with Enter. */
export function TagColorPicker({ value, onChange }: { value: TagColor; onChange: (color: TagColor) => void }) {
  const [hex, setHex] = useState(isTagPreset(value) ? "" : value)
  const typed = toHex(hex)
  return (
    <div className="grid gap-2">
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
      <div className="flex items-center gap-2 px-1">
        <span
          aria-hidden
          className={cn("size-3.5 shrink-0 rounded-full border border-border", !typed && "border-dashed")}
          style={typed ? { background: typed } : undefined}
        />
        <input
          value={hex}
          onChange={(e) => setHex(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return
            e.preventDefault()
            if (typed) onChange(typed)
          }}
          placeholder="#3B82F6"
          aria-label="Eigene Farbe als Hex, mit Enter setzen"
          aria-invalid={!!hex.trim() && !typed}
          className="h-7 min-w-0 flex-1 rounded-md border bg-transparent px-2 font-mono text-xs outline-none placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-ring aria-invalid:text-destructive"
        />
      </div>
    </div>
  )
}
