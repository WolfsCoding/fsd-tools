import { useState, type FormEvent } from "react"
import { FileTextIcon, PlusIcon, UserIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { linkIds, todoLink, useLinkOptions, type LinkOption, type TodoLink } from "./link-options"
import type { Todo, TodoInput } from "./types"

/** Creates a todo, or edits `todo`; `preset` fills in the link of a new one, e.g. the person it's opened from. */
export function TodoDialog({
  open,
  onOpenChange,
  todo,
  preset,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  todo?: Todo
  preset?: Partial<TodoInput>
  onSubmit: (input: TodoInput) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] sm:max-w-lg">
        {open && (
          <TodoForm
            key={todo?.id ?? "new"}
            todo={todo}
            preset={preset}
            onSubmit={(input) => {
              onSubmit(input)
              onOpenChange(false)
            }}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function TodoForm({
  todo,
  preset,
  onSubmit,
  onCancel,
}: {
  todo?: Todo
  preset?: Partial<TodoInput>
  onSubmit: (input: TodoInput) => void
  onCancel: () => void
}) {
  const start = todo ?? preset
  const [title, setTitle] = useState(start?.title ?? "")
  const [link, setLink] = useState(start && todoLink(start))

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    onSubmit({ title: title.trim(), ...linkIds(link) })
  }

  return (
    <form onSubmit={handleSubmit} className="contents">
      <DialogPanel className="overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{todo ? "Todo bearbeiten" : "Neues Todo"}</DialogTitle>
          <DialogDescription>Optional mit einer Akte oder Person verknüpft.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="todo-title">Todo</Label>
          <Input id="todo-title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </div>
        <LinkField value={link} onChange={setLink} />
      </DialogPanel>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={!title.trim()}>
          {todo ? "Speichern" : "Erstellen"}
        </Button>
      </DialogFooter>
    </form>
  )
}

const ICONS = { caseFile: FileTextIcon, person: UserIcon }

/** The linked Akte or person as a removable chip, or a searchable list of both to pick one. */
function LinkField({ value, onChange }: { value?: TodoLink; onChange: (link: TodoLink | undefined) => void }) {
  const [open, setOpen] = useState(false)
  const options = useLinkOptions()
  const linked = value && (value.kind === "caseFile" ? options.caseFiles : options.persons).find((o) => o.id === value.id)
  const Icon = value && ICONS[value.kind]

  function pick(link: TodoLink) {
    onChange(link)
    setOpen(false)
  }

  return (
    <div className="grid gap-2">
      <Label>Link</Label>
      <div className="flex flex-wrap items-center gap-1.5">
        {value && Icon ? (
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border bg-muted/60 py-0.5 pr-0.5 pl-2 text-xs">
            <Icon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{linked?.label ?? "Gelöscht"}</span>
            <button
              type="button"
              onClick={() => onChange(undefined)}
              aria-label="Link entfernen"
              className="flex size-5 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <XIcon className="size-3" />
            </button>
          </span>
        ) : (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-7 border-dashed text-muted-foreground">
                <PlusIcon /> Akte oder Person verknüpfen
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 p-0">
              <Command>
                <CommandInput placeholder="Akte oder Person suchen…" />
                <CommandList>
                  <CommandEmpty>Nichts gefunden.</CommandEmpty>
                  <LinkGroup heading="Akten" kind="caseFile" options={options.caseFiles} onPick={pick} />
                  <LinkGroup heading="Personen" kind="person" options={options.persons} onPick={pick} />
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  )
}

function LinkGroup({
  heading,
  kind,
  options,
  onPick,
}: {
  heading: string
  kind: TodoLink["kind"]
  options: LinkOption[]
  onPick: (link: TodoLink) => void
}) {
  const Icon = ICONS[kind]
  return (
    <CommandGroup heading={heading}>
      {options.map((o) => (
        <CommandItem key={o.id} value={`${o.label} ${o.hint ?? ""} ${o.id}`} onSelect={() => onPick({ kind, id: o.id })}>
          <Icon />
          <span className="truncate">{o.label}</span>
          {o.hint && <span className="truncate font-mono text-xs text-muted-foreground">{o.hint}</span>}
        </CommandItem>
      ))}
    </CommandGroup>
  )
}
