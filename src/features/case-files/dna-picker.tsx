import { useRef, useState } from "react"
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react"
import { cn } from "cn"
import { Input } from "@/components/ui/input"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { useListbox } from "@/components/use-listbox"
import type { DnaEntry, DnaEntryInput } from "@/features/dna-db/types"
import { toId, useDnaEntries } from "@/features/dna-db/use-dna-entries"
import { sameText } from "@/lib/text"
import { entryRef, findById, findEntry, firstRef, looksLikeId, personLabel, TRACE_LABELS, type TraceKind } from "./traces"
import { IdTag, WithIds } from "./with-ids"

/** How many matching entries are listed. */
const SHOWN = 8

/** One option of the list: an entry, a name entered elsewhere, or a new entry (by name, or as an ID of a kind). */
type Option = { entry: DnaEntry } | { name: string } | { create: TraceKind | "name" }

/**
 * A person or ID of the DNA database, picked from it: shows the person and ID ("Max Muster
 * (D-0042)"), lists the entries matching what is typed (by name or ID) and offers to add a new
 * one. Typed text that isn't picked is discarded when the field is left; left empty, the value
 * is cleared.
 */
export function DnaPicker({
  id,
  value,
  onChange,
  kinds,
  names,
  extra = [],
  show,
  placeholder,
  className,
  "aria-label": ariaLabel,
}: {
  id?: string
  /** The stored ID, or the name of a person without one (with `names`). */
  value: string
  /** The value to store and the entry it belongs to (none when cleared). */
  onChange: (value: string, entry?: DnaEntry) => void
  /** Which IDs are stored, the preferred one first; e.g. a suspect's DNA-ID, else their fingerprint ID. */
  kinds: TraceKind[]
  /** Also takes people without an ID of the `kinds`, stored by name; new entries may then be a name. */
  names?: boolean
  /** Names entered elsewhere (with `names`), e.g. the suspects of the case file; picking one keeps it as it is. */
  extra?: string[]
  /** Shows just the ID (e.g. next to a name column of its own) or just the name, instead of both. */
  show?: "id" | "name"
  placeholder?: string
  className?: string
  "aria-label"?: string
}) {
  const { entries, addEntry } = useDnaEntries()
  // What is typed, while the field is being edited.
  const [draft, setDraft] = useState<string>()
  const inputRef = useRef<HTMLInputElement>(null)

  const byId = findById(entries, kinds, value)
  const linked = byId?.entry ?? (names ? findEntry(entries, "name", value) : undefined)
  const label = !value.trim()
    ? ""
    : show === "id"
      ? value.trim()
      : show === "name"
        ? linked?.name.trim() || value.trim()
        : linked
          ? personLabel(linked.name, byId ? value : firstRef(linked, kinds))
          : looksLikeId(value)
            ? personLabel("", value)
            : value
  const editing = draft !== undefined
  const q = (draft ?? "").trim()
  const has = (v: string) => v.toLowerCase().includes(q.toLowerCase())

  function isExact(e: DnaEntry) {
    return !!q && (kinds.some((k) => sameText(entryRef(e, k), q)) || (!!names && sameText(e.name, q)))
  }
  const matches = (q ? entries.filter((e) => [e.name, e.dnaId, e.fingerprintId].some(has)) : entries)
    .filter((e) => firstRef(e, kinds) || (names && e.name.trim()))
    // Exact matches first.
    .sort((a, b) => Number(isExact(b)) - Number(isExact(a)))
    .slice(0, SHOWN)
  // Names entered elsewhere that the database doesn't know.
  const others = names
    ? [...new Set(extra.map((v) => v.trim()))]
        .filter((v) => v && !looksLikeId(v) && !findEntry(entries, "name", v) && (!q || has(v)))
        .slice(0, SHOWN)
    : []
  const known = entries.some(isExact) || others.some((v) => sameText(v, q))
  // A name only with `names`; anything else typed is an ID, of one of the kinds.
  const asName = !!names && (!looksLikeId(q) || !kinds.length)
  const creates: Option[] = !q || known ? [] : asName ? [{ create: "name" }] : kinds.map((k) => ({ create: k }))
  const options: Option[] = [...matches.map((entry) => ({ entry })), ...others.map((name) => ({ name })), ...creates]

  function pick(option: Option) {
    if ("entry" in option) onChange(firstRef(option.entry, kinds) || option.entry.name.trim(), option.entry)
    else if ("name" in option) onChange(option.name)
    else {
      const kind = option.create
      const input: DnaEntryInput =
        kind === "name"
          ? { name: q, dnaId: "", fingerprintId: "" }
          : { name: "", dnaId: kind === "dna" ? toId(q) : "", fingerprintId: kind === "fa" ? toId(q) : "" }
      addEntry(input)
      onChange(kind === "name" ? q : toId(q))
    }
    setDraft(undefined)
    inputRef.current?.blur()
  }

  /** Leaving the field: what was typed but not picked is discarded; emptied, the value is cleared. */
  function leave() {
    if (editing && !q && value) onChange("")
    setDraft(undefined)
  }

  const list = useListbox({
    options,
    open: editing,
    onOpen: () => setDraft(value),
    onPick: pick,
    onClose: () => {
      setDraft(undefined)
      inputRef.current?.blur()
    },
  })

  return (
    <Popover open={editing && options.length > 0}>
      <PopoverAnchor asChild>
        <div className="relative">
          <Input
            id={id}
            ref={inputRef}
            {...list.inputProps}
            value={editing ? draft : label}
            onFocus={() => {
              setDraft(value)
              list.reset()
            }}
            onChange={(e) => {
              setDraft(e.target.value)
              list.reset()
            }}
            onBlur={leave}
            placeholder={placeholder}
            aria-label={ariaLabel}
            className={cn(!editing && label && "text-transparent", className, "pr-8")}
          />
          {/* The label over the input, with its ID as code; typing shows the plain text. */}
          {!editing && label && (
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-0 flex items-center border border-transparent px-2.5 text-base md:text-sm",
                className,
                // Room for the dropdown icon, also where `className` sets the padding.
                "pr-8",
              )}
            >
              {show === "id" ? <IdTag id={label} /> : <WithIds text={label} className="flex-1" />}
            </div>
          )}
          <button
            type="button"
            tabIndex={-1}
            aria-label="Einträge anzeigen"
            onClick={() => inputRef.current?.focus()}
            className="absolute inset-y-0 right-0 flex w-8 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <ChevronsUpDownIcon className="size-3.5" />
          </button>
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) min-w-64 gap-0 p-1"
        // Typing goes on in the input while the list is open.
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div {...list.listProps}>
          {options.map((option, i) => (
            <button
              key={"entry" in option ? option.entry.id : "name" in option ? `name:${option.name}` : `new:${option.create}`}
              {...list.optionProps(i)}
              type="button"
              tabIndex={-1}
              // Keeps the focus in the input, so leaving it doesn't discard the pick.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(option)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                i === list.index && "bg-accent",
              )}
            >
              <OptionLabel option={option} kinds={kinds} linked={linked} typed={q} />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function OptionLabel({
  option,
  kinds,
  linked,
  typed,
}: {
  option: Option
  kinds: TraceKind[]
  linked?: DnaEntry
  typed: string
}) {
  if ("entry" in option) {
    const { entry } = option
    return (
      <>
        <span className="flex-1 truncate">{entry.name.trim() || "Unbekannt"}</span>
        <span className="shrink-0 truncate font-mono text-xs text-muted-foreground">
          {firstRef(entry, kinds) || entry.dnaId || entry.fingerprintId}
        </span>
        {entry === linked && <CheckIcon className="size-3.5 text-muted-foreground" />}
      </>
    )
  }
  if ("name" in option)
    return (
      <>
        <span className="flex-1 truncate">{option.name}</span>
        <span className="shrink-0 text-xs text-muted-foreground">Aus den Akten</span>
      </>
    )
  const kind = option.create
  return (
    <>
      <PlusIcon className="size-3.5 text-muted-foreground" />
      <span className="flex-1 truncate">„{kind === "name" ? typed : toId(typed)}“ als neuen Eintrag anlegen</span>
      <span className="shrink-0 text-xs text-muted-foreground">{kind === "name" ? "Name" : TRACE_LABELS[kind].id}</span>
    </>
  )
}
