import { useId, useMemo, useState } from "react"
import { StepDialog, type Step } from "@/components/step-dialog"
import { Input } from "@/components/ui/input"
import { useDnaEntries } from "@/features/dna-db/use-dna-entries"
import { CASE_TYPES, caseType, type CaseType } from "./case-types"
import { DnaPicker } from "./dna-picker"
import { Labeled, SectionFields } from "./doc-form"
import { AktenzeichenInput, TypePicker } from "./edit-case-file-dialog"
import type { CaseFileKind } from "./kind"
import { createReader } from "./templates"
import { findById, findEntry } from "./traces"
import type { CaseFile, Value, Values } from "./types"
import { collectSuggestions, useColors, useOwnIdentity } from "./use-case-files"

/** The form's values are offered and remembered under this id, as for a document. */
const FORM_ID = "new-case-file"

/** What the dialog creates: the details of the case file and its Beschreibung. */
export interface NewCaseFile {
  template: string
  details: Pick<CaseFile<string>, "title" | "type" | "caseNumber" | "ablage">
  values: Values
}

/**
 * Creates a case file step by step: first its type, name, Aktenzeichen and Ablage, then one
 * step per section of its Beschreibung.
 */
export function NewCaseFileDialog({
  type,
  kind,
  caseFiles,
  onCreate,
  onClose,
}: {
  /** The type it starts with; closed while undefined. */
  type: string | undefined
  kind: CaseFileKind
  caseFiles: CaseFile<string>[]
  onCreate: (created: NewCaseFile) => void
  onClose: () => void
}) {
  // Mounted per opening, so every new case file starts empty.
  if (type === undefined) return null
  return (
    <Steps initial={caseType(type) ?? CASE_TYPES[0]} kind={kind} caseFiles={caseFiles} onCreate={onCreate} onCancel={onClose} />
  )
}

function Steps({
  initial,
  kind,
  caseFiles,
  onCreate,
  onCancel,
}: {
  initial: CaseType
  kind: CaseFileKind
  caseFiles: CaseFile<string>[]
  onCreate: (created: NewCaseFile) => void
  onCancel: () => void
}) {
  const { identity } = useOwnIdentity()
  const { colors } = useColors()
  const { entries, addEntry } = useDnaEntries()
  const ids = { type: useId(), number: useId(), name: useId(), ablage: useId() }
  const [type, setType] = useState(initial)
  const [caseNumber, setCaseNumber] = useState("")
  const [name, setName] = useState("")
  /** The DNA-ID of the person, or their name while they have none. */
  const [ablage, setAblage] = useState(() => {
    const own = findEntry(entries, "name", identity.name)
    return own?.dnaId.trim() || own?.fingerprintId.trim() || identity.name
  })
  const prefill = (t: CaseType): Values => structuredClone(kind.templates[t.template].initial ?? {})
  const [values, setValues] = useState(() => prefill(initial))
  /** Once filled in, picking another type keeps the values. */
  const [edited, setEdited] = useState(false)
  const template = kind.templates[type.template]
  const reader = useMemo(
    () => createReader(template, values, identity.full, colors, identity.department, entries),
    [template, values, identity, colors, entries],
  )
  const suggestions = useMemo(
    () => collectSuggestions(caseFiles, "", identity, kind.templates),
    [caseFiles, identity, kind.templates],
  )

  function pick(id: string) {
    const next = caseType(id)
    if (!next) return
    setType(next)
    if (!edited) setValues(prefill(next))
  }

  const onChange = (key: string, value: Value) => {
    setEdited(true)
    setValues((prev) => ({ ...prev, [key]: value }))
  }
  const onUpdate = (key: string, fn: (value: Value | undefined) => Value) => setValues((prev) => ({ ...prev, [key]: fn(prev[key]) }))

  function create() {
    const person = ablage.trim()
    // The Ablage is a person of the DNA database; one not in it yet is added.
    if (person && !findById(entries, ["dna", "fa"], person) && !findEntry(entries, "name", person))
      addEntry({ name: person, dnaId: "", fingerprintId: "" })
    onCreate({
      template: type.template,
      details: {
        type: type.id,
        title: name.trim() || type.label,
        caseNumber: caseNumber.trim() || undefined,
        ablage: person || undefined,
      },
      values,
    })
  }

  const steps: Step[] = [
    {
      title: kind.noun,
      description: "Typ, Name, Aktenzeichen und bei wem sie abgelegt ist.",
      content: (
        <>
          <div className="grid gap-4">
            <Labeled id={ids.type} label="Typ" className="">
              <TypePicker id={ids.type} value={type} onChange={pick} />
            </Labeled>
            <Labeled id={ids.name} label="Name" className="">
              <Input id={ids.name} value={name} onChange={(e) => setName(e.target.value)} placeholder={type.label} />
            </Labeled>
            <Labeled id={ids.number} label="Aktenzeichen" className="">
              <AktenzeichenInput id={ids.number} type={type} value={caseNumber} onChange={setCaseNumber} />
            </Labeled>
            <Labeled
              id={ids.ablage}
              label="Ablage"
              required
              hint="Eine Person aus „Personen“; wer noch fehlt, wird angelegt."
              className=""
            >
              <DnaPicker
                id={ids.ablage}
                value={ablage}
                onChange={setAblage}
                kinds={["dna", "fa"]}
                names
                placeholder="Name oder DNA-ID"
              />
            </Labeled>
          </div>
        </>
      ),
    },
    // A Beschreibung with a form of its own (the blocks of "Eigene") is one step; else one step
    // per section. The tabs are filled in later, in the case file.
    ...(template.form
      ? [
          {
            title: "Beschreibung",
            description: template.description,
            content: <template.form values={values} onChange={onChange} onUpdate={onUpdate} />,
          },
        ]
      : template.sections
          .filter((s) => !s.tab)
          .map((s) => ({
            title: s.title,
            description: s.description,
            content: (
              <SectionFields
                section={s}
                values={values}
                reader={reader}
                onChange={onChange}
                onUpdate={onUpdate}
                suggestions={suggestions}
                docId={FORM_ID}
              />
            ),
          }))),
  ]

  return (
    <StepDialog
      open
      title={`Neue ${kind.noun}`}
      steps={steps}
      saveLabel={`${kind.noun} anlegen`}
      missing={ablage.trim() ? undefined : "Ablage fehlt"}
      onSave={create}
      onCancel={onCancel}
    />
  )
}
