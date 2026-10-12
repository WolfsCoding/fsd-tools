import { useRef, useState } from "react"
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react"
import { cn } from "cn"
import { Input } from "@/components/ui/input"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { useListbox } from "@/components/use-listbox"

/**
 * A suggestion, optionally with a hint shown (and searched) next to it, e.g. the name of a DNA-ID.
 * `create` marks an option that adds something new (e.g. "Neuer Tag"); it shows a plus instead of a check.
 */
export type ComboboxOption = string | { value: string; hint?: string; create?: boolean }

const optionValue = (o: ComboboxOption) => (typeof o === "string" ? o : o.value)
const optionHint = (o: ComboboxOption) => (typeof o === "string" ? undefined : o.hint)
const optionCreates = (o: ComboboxOption) => typeof o !== "string" && !!o.create

/**
 * A text input with a list of suggestions; any other text can be typed too.
 * Suggestions ending in a space (e.g. "Zelle ") are meant to be completed by hand.
 */
export function Combobox({
  id,
  value,
  onChange,
  options,
  placeholder,
  onPick,
  all,
  className,
  "aria-label": ariaLabel,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  options: ComboboxOption[]
  placeholder?: string
  /** Called after an option is picked from the list. */
  onPick?: (option: string) => void
  /** Lists every option (scrolling), e.g. a fixed catalog, instead of only the first few. */
  all?: boolean
  /** Classes for the input, e.g. to fit it into a table cell. */
  className?: string
  "aria-label"?: string
}) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Everything while the value is empty or one of the options, else what matches the typed text.
  const q = value.trim().toLowerCase()
  // Long lists of earlier entries only show the first few.
  const shown = (
    !q || options.some((o) => optionValue(o).trim().toLowerCase() === q)
      ? options
      : options.filter((o) => `${optionValue(o)} ${optionHint(o) ?? ""}`.toLowerCase().includes(q))
  ).slice(0, all ? undefined : 8)

  function pick(option: string) {
    onChange(option)
    onPick?.(option)
    setOpen(false)
    inputRef.current?.focus()
  }

  const list = useListbox({
    options: shown,
    open,
    onOpen: () => setOpen(true),
    onPick: (o) => pick(optionValue(o)),
    onClose: () => setOpen(false),
  })

  return (
    <Popover open={open && shown.length > 0} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div ref={anchorRef} className="relative">
          <Input
            ref={inputRef}
            id={id}
            {...list.inputProps}
            value={value}
            onChange={(e) => {
              onChange(e.target.value)
              list.reset()
              setOpen(true)
            }}
            onClick={() => setOpen(true)}
            placeholder={placeholder}
            aria-label={ariaLabel}
            className={cn("pr-8", className)}
          />
          {options.length > 0 && (
            <button
              type="button"
              tabIndex={-1}
              aria-label="Vorschläge anzeigen"
              onClick={() => {
                setOpen((o) => !o)
                inputRef.current?.focus()
              }}
              className="absolute inset-y-0 right-0 flex w-8 items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <ChevronsUpDownIcon className="size-3.5" />
            </button>
          )}
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) gap-0 p-1"
        // Typing goes on in the input while the list is open.
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          if (anchorRef.current?.contains(e.target as Node)) e.preventDefault()
        }}
      >
        <div {...list.listProps} className={cn(all && "max-h-72 overflow-y-auto")}>
          {shown.map((o, i) => {
            const option = optionValue(o)
            const hint = optionHint(o)
            return (
              <button
                key={option}
                {...list.optionProps(i)}
                type="button"
                tabIndex={-1}
                onClick={() => pick(option)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                  i === list.index && "bg-accent",
                )}
              >
                <span className="flex-1 truncate">{option.endsWith(" ") ? `${option.trim()} …` : option}</span>
                {hint && <span className="shrink-0 truncate text-xs text-muted-foreground">{hint}</span>}
                {optionCreates(o) ? (
                  <PlusIcon className="size-3.5 text-muted-foreground" />
                ) : (
                  option === value && <CheckIcon className="size-3.5 text-muted-foreground" />
                )}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
