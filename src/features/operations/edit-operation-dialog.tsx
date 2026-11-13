import { useId, useState, type FormEvent } from "react"
import { Combobox } from "@/components/combobox"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogPanel, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Labeled } from "@/features/case-files/doc-form"
import type { Operation } from "./types"

export type OperationDetails = Pick<Operation, "title" | "fallakte" | "funk" | "ort" | "leitung">

/** Changes an operation's title and the details in its header; closed without `operation`. */
export function EditOperationDialog({
  operation,
  officers,
  me,
  onSave,
  onClose,
}: {
  operation: Operation | undefined
  officers: string[]
  me: string
  onSave: (details: OperationDetails) => void
  onClose: () => void
}) {
  return (
    <Dialog open={!!operation} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] sm:max-w-lg">
        {/* Mounted per opening, so it always starts from the operation as it is. */}
        {operation && <EditForm key={operation.id} operation={operation} officers={officers} me={me} onSave={onSave} onCancel={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function EditForm({
  operation,
  officers,
  me,
  onSave,
  onCancel,
}: {
  operation: Operation
  officers: string[]
  me: string
  onSave: (details: OperationDetails) => void
  onCancel: () => void
}) {
  const ids = { title: useId(), fallakte: useId(), funk: useId(), ort: useId(), leitung: useId() }
  const [title, setTitle] = useState(operation.title)
  const [fallakte, setFallakte] = useState(operation.fallakte ?? "")
  const [funk, setFunk] = useState(operation.funk ?? "")
  const [ort, setOrt] = useState(operation.ort)
  const [leitung, setLeitung] = useState(operation.leitung)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    onSave({ title: title.trim(), fallakte: fallakte.trim(), funk: funk.trim(), ort: ort.trim(), leitung: leitung.trim() })
  }

  return (
    <form onSubmit={submit} className="contents">
      <DialogPanel className="overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Einsatz bearbeiten</DialogTitle>
          <DialogDescription>Titel, Fallakte, Funk, Ort und Einsatzleitung.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Labeled id={ids.title} label="Titel" className="">
            <Input id={ids.title} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </Labeled>
          <Labeled id={ids.fallakte} label="Fallakte" hint="Wird das Aktenzeichen der Sammelakte." className="">
            <Input id={ids.fallakte} value={fallakte} onChange={(e) => setFallakte(e.target.value)} placeholder="12345/26" />
          </Labeled>
          <Labeled id={ids.funk} label="Funk" className="">
            <Input id={ids.funk} value={funk} onChange={(e) => setFunk(e.target.value)} />
          </Labeled>
          <Labeled id={ids.ort} label="Ort" className="">
            <Input id={ids.ort} value={ort} onChange={(e) => setOrt(e.target.value)} />
          </Labeled>
          <Labeled id={ids.leitung} label="Einsatzleitung" className="">
            <Combobox id={ids.leitung} value={leitung} onChange={setLeitung} options={officers} placeholder={me} />
          </Labeled>
        </div>
      </DialogPanel>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={!title.trim()}>
          Speichern
        </Button>
      </DialogFooter>
    </form>
  )
}
