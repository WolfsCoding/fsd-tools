import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from "@/components/ui/dialog"
import { TagInput } from "./tag-input"
import type { DnaEntry, DnaTag } from "./types"
import { entryName } from "./use-dna-entries"

/** Edits only the tags of one entry (opened from the row's context menu). */
export function DnaTagsDialog({
  entry,
  knownTags,
  onOpenChange,
  onSubmit,
}: {
  /** Open while set. */
  entry?: DnaEntry
  knownTags: DnaTag[]
  onOpenChange: (open: boolean) => void
  onSubmit: (tags: DnaTag[]) => void
}) {
  return (
    <Dialog open={entry !== undefined} onOpenChange={onOpenChange}>
      <DialogContent>
        {entry && (
          <TagsForm
            key={entry.id}
            entry={entry}
            knownTags={knownTags}
            onSubmit={(tags) => {
              onSubmit(tags)
              onOpenChange(false)
            }}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function TagsForm({
  entry,
  knownTags,
  onSubmit,
  onCancel,
}: {
  entry: DnaEntry
  knownTags: DnaTag[]
  onSubmit: (tags: DnaTag[]) => void
  onCancel: () => void
}) {
  const [tags, setTags] = useState(entry.tags ?? [])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSubmit(tags)
  }

  return (
    <form onSubmit={handleSubmit} className="contents">
      <DialogPanel>
        <DialogHeader>
          <DialogTitle>Tags bearbeiten</DialogTitle>
          <DialogDescription>Tags für „{entryName(entry)}“.</DialogDescription>
        </DialogHeader>

        <TagInput value={tags} onChange={setTags} knownTags={knownTags} autoFocus />
      </DialogPanel>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Abbrechen
        </Button>
        <Button type="submit">Speichern</Button>
      </DialogFooter>
    </form>
  )
}
