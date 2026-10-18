import { useEffect, useRef, type ComponentProps, type ReactNode } from "react"
import { ListFilterIcon, SearchIcon } from "lucide-react"
import { cn } from "cn"
import { Hint } from "@/components/hint"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { usePane } from "@/hooks/use-pane"

function isEditable(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  )
}

/**
 * The search input used everywhere: an icon, "Suchen…", and the full width of its row.
 * `filters` (dropdown items) go in a menu behind a button grouped with the input.
 * Escape clears it; with `focusKey`, "/" focuses it from anywhere on the page (only give
 * one visible field per page the shortcut). In the split pane the shortcut is left to the
 * main pane.
 */
export function SearchField({
  value,
  onChange,
  focusKey = false,
  filters,
  filtered = false,
  className,
  onKeyDown,
  ...props
}: Omit<ComponentProps<"input">, "value" | "onChange" | "placeholder"> & {
  value: string
  onChange: (value: string) => void
  /** Focuses the field when "/" is pressed outside of other inputs. */
  focusKey?: boolean
  /** Items of the filter menu, e.g. `DropdownMenuCheckboxItem`s. */
  filters?: ReactNode
  /** Marks the filter button while a filter is on. */
  filtered?: boolean
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
    <ButtonGroup className={cn("w-full min-w-0 flex-1", className)}>
      <InputGroup>
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
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
          placeholder="Suchen…"
          className="[&::-webkit-search-cancel-button]:hidden"
          {...props}
        />
      </InputGroup>
      {filters && <FilterMenu filtered={filtered}>{filters}</FilterMenu>}
    </ButtonGroup>
  )
}

/** The filter button and its menu; on its own where there is no search field. */
export function FilterMenu({ filtered, children }: { filtered: boolean; children: ReactNode }) {
  return (
    <DropdownMenu>
      <Hint label="Filter">
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="relative" aria-label="Filter">
            <ListFilterIcon />
            {filtered && <span aria-hidden className="absolute top-1 right-1 size-1.5 rounded-full bg-foreground" />}
          </Button>
        </DropdownMenuTrigger>
      </Hint>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Filter</DropdownMenuLabel>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
