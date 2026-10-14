import { useEffect, useRef, type ComponentProps } from "react"
import { SearchIcon } from "lucide-react"
import { cn } from "cn"
import { Input } from "@/components/ui/input"
import { usePane } from "@/hooks/use-pane"

function isEditable(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  )
}

/**
 * Search input with an icon. Escape clears it; with `focusKey`, "/" focuses it from
 * anywhere on the page (only give one visible field per page the shortcut). In the
 * split pane the shortcut is left to the main pane.
 */
export function SearchField({
  value,
  onChange,
  focusKey = false,
  className,
  placeholder = "Suchen…",
  onKeyDown,
  ...props
}: Omit<ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: string
  onChange: (value: string) => void
  /** Focuses the field when "/" is pressed outside of other inputs. */
  focusKey?: boolean
  "aria-label": string
}) {
  const ref = useRef<HTMLInputElement>(null)
  const pane = usePane()

  useEffect(() => {
    if (!focusKey || pane !== "main") return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey || isEditable(e.target)) return
      // Hidden fields (e.g. on a page in the background) have no layout box.
      if (!ref.current?.offsetParent) return
      e.preventDefault()
      ref.current.focus()
      ref.current.select()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [focusKey, pane])

  return (
    <div className={cn("relative flex-1", className)}>
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            e.preventDefault()
            e.stopPropagation()
            onChange("")
          }
          onKeyDown?.(e)
        }}
        placeholder={placeholder}
        className="pl-8 [&::-webkit-search-cancel-button]:hidden"
        {...props}
      />
    </div>
  )
}
