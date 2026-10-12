import { useEffect, useRef, useState } from "react"
import { FolderIcon, PlusIcon, XIcon } from "lucide-react"
import { Hint } from "@/components/hint"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { sameText } from "@/lib/text"
import { removedToast } from "@/lib/undo"
import type { DnaEntry } from "./types"
import { entryName } from "./use-dna-entries"

/** Changes the case numbers of the entry with `id`, as they are stored by then. */
type UpdateCaseNumbers = (id: string, update: (caseNumbers: string[]) => string[]) => void

/**
 * Edits the case numbers of one entry: plain numbers, no link to the case files themselves.
 * Every change is saved right away; a removed number can be brought back from the toast.
 */
export function DnaCaseNumbersDialog({
  entry,
  onOpenChange,
  onChange,
}: {
  /** Open while set; the stored entry, so saved changes show up. */
  entry?: DnaEntry
  onOpenChange: (open: boolean) => void
  onChange: UpdateCaseNumbers
}) {
  return (
    <Dialog open={entry !== undefined} onOpenChange={onOpenChange}>
      <DialogContent>
        {entry && <CaseNumbersForm key={entry.id} entry={entry} onChange={onChange} />}
      </DialogContent>
    </Dialog>
  )
}

function CaseNumbersForm({ entry, onChange }: { entry: DnaEntry; onChange: UpdateCaseNumbers }) {
  const numbers = entry.caseNumbers ?? []
  const [draft, setDraft] = useState("")

  /** Saves the draft as a new number; one already listed (ignoring case) isn't added twice. */
  function add() {
    const number = draft.trim()
    setDraft("")
    if (!number) return
    onChange(entry.id, (prev) => (prev.some((n) => sameText(n, number)) ? prev : [...prev, number]))
  }

  function remove(number: string) {
    const index = numbers.indexOf(number)
    onChange(entry.id, (prev) => prev.filter((n) => n !== number))
    removedToast(`Aktennummer „${number}“`, () =>
      onChange(entry.id, (prev) =>
        prev.some((n) => sameText(n, number)) ? prev : [...prev.slice(0, index), number, ...prev.slice(index)],
      ),
    )
  }

  // A number still typed in isn't lost when the dialog is closed, however it's closed.
  const addOnClose = useRef(add)
  useEffect(() => {
    addOnClose.current = add
  })
  useEffect(() => () => addOnClose.current(), [])

  return (
    <DialogPanel>
      <DialogHeader>
        <DialogTitle>Aktennummern</DialogTitle>
        <DialogDescription>Akten, zu denen „{entryName(entry)}“ gehört. Änderungen werden automatisch gespeichert.</DialogDescription>
      </DialogHeader>

      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              add()
            }
          }}
          placeholder="Aktennummer"
          aria-label="Neue Aktennummer"
          className="font-mono"
          autoFocus
        />
        <Button type="button" variant="outline" onClick={add} disabled={!draft.trim()}>
          <PlusIcon /> Hinzufügen
        </Button>
      </div>

      {numbers.length ? (
        <ul className="grid max-h-72 divide-y overflow-y-auto rounded-lg border">
          {numbers.map((number) => (
            <li key={number} className="flex items-center gap-3 py-1.5 pr-1.5 pl-3">
              <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate font-mono text-sm">{number}</span>
              <Hint label="Entfernen">
                <button
                  type="button"
                  onClick={() => remove(number)}
                  aria-label={`${number} entfernen`}
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground/70 hover:bg-accent hover:text-foreground"
                >
                  <XIcon className="size-3.5" />
                </button>
              </Hint>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
          Noch keine Aktennummern.
        </p>
      )}
    </DialogPanel>
  )
}
