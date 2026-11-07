import { useId, useState, type FormEvent } from "react"
import { ChevronsUpDownIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogPanel, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { CASE_TYPES, caseType, caseTypeOf, type CaseType } from "./case-types"
import { DnaPicker } from "./dna-picker"
import { Labeled } from "./doc-form"
import type { CaseFileKind } from "./kind"
import { CASE_STATUSES, STATUS_LABELS, statusOf, type CaseFile } from "./types"
import { caseFileTitle, type CaseFileDetails } from "./use-case-files"

/** Changes a case file's name, type, Aktenzeichen, Ablage and status; closed without `caseFile`. */
export function EditCaseFileDialog({
  caseFile,
  kind,
  me,
  onSave,
  onClose,
}: {
  caseFile: CaseFile<string> | undefined
  kind: CaseFileKind
  me: string
  onSave: (details: CaseFileDetails) => void
  onClose: () => void
}) {
  return (
    <Dialog open={!!caseFile} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] sm:max-w-lg">
        {/* Mounted per opening, so it always starts from the case file as it is. */}
        {caseFile && <EditForm key={caseFile.id} caseFile={caseFile} kind={kind} me={me} onSave={onSave} onCancel={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function EditForm({
  caseFile,
  kind,
  me,
  onSave,
  onCancel,
}: {
  caseFile: CaseFile<string>
  kind: CaseFileKind
  me: string
  onSave: (details: CaseFileDetails) => void
  onCancel: () => void
}) {
  const ids = { name: useId(), type: useId(), number: useId(), ablage: useId(), status: useId() }
  const [title, setTitle] = useState(caseFile.title)
  const [type, setType] = useState(caseTypeOf(caseFile) ?? CASE_TYPES[0])
  const [caseNumber, setCaseNumber] = useState(caseFile.caseNumber ?? "")
  const [ablage, setAblage] = useState(caseFile.ablage ?? "")
  const [status, setStatus] = useState(statusOf(caseFile))

  function submit(e: FormEvent) {
    e.preventDefault()
    // Every case file has an Ablage, so emptying the field keeps the one it has.
    onSave({ title: title.trim(), type: type.id, caseNumber, ablage: ablage.trim() || caseFile.ablage, status })
  }

  return (
    <form onSubmit={submit} className="contents">
      <DialogPanel className="overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{kind.noun} bearbeiten</DialogTitle>
          <DialogDescription>Name, Typ, Aktenzeichen, Ablage und Status.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Labeled id={ids.name} label="Name" hint="Leer lassen für den automatischen Namen." className="">
            <Input
              id={ids.name}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={caseFileTitle({ ...caseFile, title: "" }, me, kind.templates)}
              autoFocus
            />
          </Labeled>
          <Labeled id={ids.type} label="Typ" hint="Die Beschreibung bleibt, wie sie ist." className="">
            <TypePicker id={ids.type} value={type} onChange={(id) => setType(caseType(id) ?? type)} />
          </Labeled>
          <Labeled id={ids.number} label="Aktenzeichen" className="">
            <AktenzeichenInput id={ids.number} type={type} value={caseNumber} onChange={setCaseNumber} />
          </Labeled>
          <Labeled id={ids.ablage} label="Ablage" className="">
            <DnaPicker id={ids.ablage} value={ablage} onChange={setAblage} kinds={["dna", "fa"]} names placeholder="Name oder DNA-ID" />
          </Labeled>
          <Labeled id={ids.status} label="Status" className="">
            <Select
              id={ids.status}
              value={status}
              options={CASE_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
              onChange={setStatus}
            />
          </Labeled>
        </div>
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

/** Picks one of `CASE_TYPES`, with its prefix beside it. */
export function TypePicker({ id, value, onChange }: { id: string; value: CaseType; onChange: (id: string) => void }) {
  return (
    <Select
      id={id}
      value={value.id}
      options={CASE_TYPES.map((t) => ({ value: t.id, label: t.label, hint: t.prefix }))}
      onChange={onChange}
    />
  )
}

/** A button styled like an input that opens a menu of `options`. */
function Select<T extends string>({
  id,
  value,
  options,
  onChange,
}: {
  id: string
  value: T
  options: { value: T; label: string; hint?: string }[]
  onChange: (value: T) => void
}) {
  const picked = options.find((o) => o.value === value)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          id={id}
          type="button"
          className="flex h-9 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-left text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
        >
          <span className="min-w-0 flex-1 truncate">{picked?.label}</span>
          {picked?.hint && <span className="text-muted-foreground">{picked.hint}</span>}
          <ChevronsUpDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width)">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(v) => {
            const option = options.find((o) => o.value === v)
            if (option) onChange(option.value)
          }}
        >
          {options.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value}>
              <span className="flex-1">{o.label}</span>
              {o.hint && <span className="text-xs text-muted-foreground">{o.hint}</span>}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The case number behind the prefix of its type. */
export function AktenzeichenInput({
  id,
  type,
  value,
  onChange,
}: {
  id: string
  type: CaseType
  value: string
  onChange: (value: string) => void
}) {
  return (
    <InputGroup>
      {type.prefix && (
        <InputGroupAddon>
          <InputGroupText>{type.prefix}</InputGroupText>
        </InputGroupAddon>
      )}
      <InputGroupInput id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder="12345/26" />
    </InputGroup>
  )
}
