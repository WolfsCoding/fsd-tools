import { useState, type FormEvent } from "react"
import { TriangleAlertIcon } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TagInput } from "./tag-input"
import type { DnaEntry, DnaEntryInput, DnaTag } from "./types"
import { entryName, isDuplicate, toId } from "./use-dna-entries"

interface DnaEntryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set, the dialog edits this entry instead of creating a new one. */
  entry?: DnaEntry
  /** All entries, to point out IDs another entry already has. */
  entries: DnaEntry[]
  /** Tags used across all entries, suggested in the tag field. */
  knownTags: DnaTag[]
  /**
   * The new entry, or only the fields changed in the dialog for an edited one, so changes made
   * elsewhere while it was open (e.g. linked from an Akte) aren't overwritten.
   */
  onSubmit: (input: Partial<DnaEntryInput>) => void
}

export function DnaEntryDialog({
  open,
  onOpenChange,
  entry,
  entries,
  knownTags,
  onSubmit,
}: DnaEntryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Keyed so the form resets whenever the dialog opens for another entry. */}
        <DnaEntryForm
          key={entry?.id ?? "new"}
          entry={entry}
          entries={entries}
          knownTags={knownTags}
          onSubmit={(input) => {
            onSubmit(input)
            onOpenChange(false)
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

const sameTags = (a: DnaTag[], b: DnaTag[]) =>
  a.length === b.length && a.every((t, i) => t.name === b[i].name && t.color === b[i].color)

function DnaEntryForm({
  entry,
  entries,
  knownTags,
  onSubmit,
  onCancel,
}: {
  entry?: DnaEntry
  entries: DnaEntry[]
  knownTags: DnaTag[]
  onSubmit: (input: Partial<DnaEntryInput>) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(entry?.name ?? "")
  const [dnaId, setDnaId] = useState(entry?.dnaId ?? "")
  const [fingerprintId, setFingerprintId] = useState(entry?.fingerprintId ?? "")
  const [tags, setTags] = useState(entry?.tags ?? [])

  // Unknown traces have no name yet, only an ID.
  const canSubmit = [name, dnaId, fingerprintId].some((v) => v.trim() !== "")

  // The entry as it would be saved, to find others with the same IDs.
  const stored = entries.find((e) => e.id === entry?.id)
  const draft: DnaEntry = {
    ...(stored ?? { id: "", createdAt: "", updatedAt: "" }),
    name: name.trim(),
    dnaId: toId(dnaId),
    fingerprintId: toId(fingerprintId),
  }
  const others = entries.filter((e) => e.id !== entry?.id)
  const sameDna = draft.dnaId ? others.find((e) => e.dnaId === draft.dnaId) : undefined
  const sameFingerprint = draft.fingerprintId ? others.find((e) => e.fingerprintId === draft.fingerprintId) : undefined

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    const input = {
      name: name.trim(),
      dnaId: dnaId.trim(),
      fingerprintId: fingerprintId.trim(),
      tags,
    }
    if (!entry) return onSubmit(input)
    // Only what was changed here, onto the entry as it is stored now.
    const changes: Partial<DnaEntryInput> = {}
    if (input.name !== entry.name.trim()) changes.name = input.name
    if (input.dnaId !== entry.dnaId.trim()) changes.dnaId = input.dnaId
    if (input.fingerprintId !== entry.fingerprintId.trim()) changes.fingerprintId = input.fingerprintId
    if (!sameTags(tags, entry.tags ?? [])) changes.tags = tags
    onSubmit(changes)
  }

  return (
    <form onSubmit={handleSubmit} className="contents">
      <DialogPanel>
        <DialogHeader>
          <DialogTitle>{entry ? "Eintrag bearbeiten" : "Neuer Eintrag"}</DialogTitle>
          <DialogDescription>
            {entry
              ? "Aktualisiere die Daten dieses Eintrags."
              : "Füge der DNA-Datenbank eine Person oder eine noch unbekannte Spur hinzu."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Label htmlFor="dna-name">Name</Label>
          <Input
            id="dna-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="dna-id">DNA-ID</Label>
          <Input
            id="dna-id"
            value={dnaId}
            onChange={(e) => setDnaId(e.target.value.toUpperCase())}
            aria-describedby={sameDna ? "dna-id-taken" : undefined}
            className="font-mono"
          />
          {sameDna && <TakenHint id="dna-id-taken" label="DNA-ID" draft={draft} other={sameDna} />}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="dna-fingerprint">Fingerabdruck-ID</Label>
          <Input
            id="dna-fingerprint"
            value={fingerprintId}
            onChange={(e) => setFingerprintId(e.target.value.toUpperCase())}
            aria-describedby={sameFingerprint ? "dna-fingerprint-taken" : undefined}
            className="font-mono"
          />
          {sameFingerprint && (
            <TakenHint id="dna-fingerprint-taken" label="Fingerabdruck-ID" draft={draft} other={sameFingerprint} />
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="dna-tags">Tags</Label>
          <TagInput id="dna-tags" value={tags} onChange={setTags} knownTags={knownTags} />
        </div>
      </DialogPanel>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {entry ? "Speichern" : "Hinzufügen"}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Another entry already has the ID: saving merges both when nothing else differs, else keeps both. */
function TakenHint({ id, label, draft, other }: { id: string; label: string; draft: DnaEntry; other: DnaEntry }) {
  return (
    <p id={id} role="status" className="flex items-start gap-1.5 text-xs text-amber-300">
      <TriangleAlertIcon className="mt-px size-3.5 shrink-0" />
      <span>
        „{entryName(other)}“ hat dieselbe {label}.{" "}
        {isDuplicate(draft, other)
          ? "Beim Speichern werden beide Einträge zusammengeführt."
          : "Beide Einträge bleiben bestehen."}
      </span>
    </p>
  )
}
