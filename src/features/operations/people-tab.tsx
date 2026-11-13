import { useState, type ReactNode } from "react"
import { ChevronRightIcon } from "lucide-react"
import { cn } from "cn"
import { Combobox } from "@/components/combobox"
import { DateTimePicker } from "@/components/date-picker"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogPanel, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CELL_COMBOBOX, ChoiceCell, MARKS } from "@/features/case-files/doc-form"
import { DnaPicker } from "@/features/case-files/dna-picker"
import { PERSON } from "@/features/case-files/templates"
import { removedToast } from "@/lib/undo"
import { insertAt, updateAt } from "./rows"
import { SheetSection, SheetTable, TextCell, type SheetColumn } from "./sheet"
import { ED_MEASURES, toMark, type Item, type Operation, type Person } from "./types"
import { newItem, newPerson } from "./use-operations"

const ROLES = ["Beschuldigter", "Geschädigter", "Zeuge", "Officer"]

const PARTS = {
  belehrung: { title: "Belehrung", description: "Rechtsbeistand, und wer wann belehrt hat." },
  gegenstaende: { title: "Konfiszierte Gegenstände", description: "Was der Person abgenommen wurde." },
  ed: { title: "Erkennungsdienstliche Maßnahmen", description: "Was bei der Person schon genommen wurde." },
}
type Part = keyof typeof PARTS

const time = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" })

function cautionSummary({ belehrung: b }: Person) {
  if (/^\d{4}-\d{2}-\d{2}T/.test(b.belehrtUm)) return `Belehrt · ${time.format(new Date(b.belehrtUm))}`
  return b.belehrtVon.trim() ? "Belehrt" : ""
}

const itemsSummary = ({ gegenstaende }: Person) => {
  const n = gegenstaende.filter((i) => i.gegenstand.trim()).length
  return n === 0 ? "" : n === 1 ? "1 Gegenstand" : `${n} Gegenstände`
}

const edSummary = ({ ed }: Person) =>
  ED_MEASURES.filter((m) => ed.includes(m.id))
    .map((m) => m.label)
    .join(", ")

/** Everyone involved, with their Belehrung, confiscated items and ED-Maßnahmen in dialogs. */
export function PeopleTab({
  operation,
  onChange,
  officers,
  me,
  nameOf,
}: {
  operation: Operation
  onChange: (fn: (o: Operation) => Operation) => void
  officers: string[]
  me: string
  /** The name of a person as the DNA database knows them. */
  nameOf: (value: string) => string
}) {
  const [open, setOpen] = useState<{ id: string; part: Part }>()
  const setPerson = (i: number, fn: (p: Person) => Person) => onChange((o) => ({ ...o, people: updateAt(o.people, i, fn) }))
  const openPerson = open && operation.people.find((p) => p.id === open.id)

  const dialogCell = (part: Part, summary: (p: Person) => string): SheetColumn<Person> => ({
    key: part,
    label: part === "ed" ? "ED-Maßnahmen" : part === "gegenstaende" ? "Gegenstände" : PARTS[part].title,
    cell: (p, i) => {
      const text = summary(p)
      return (
        <button
          type="button"
          onClick={() => setOpen({ id: p.id, part })}
          aria-label={`${PARTS[part].title} (Zeile ${i + 1}): ${text || "offen"}`}
          className="flex h-10 w-full items-center gap-2 px-3 text-left text-sm outline-none hover:bg-accent/30 focus-visible:bg-accent/30"
        >
          <span className={cn("flex-1 truncate", !text && "text-muted-foreground/60")}>{text || "Offen"}</span>
          <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      )
    },
  })

  const columns: SheetColumn<Person>[] = [
    {
      key: "name",
      label: "Name",
      wide: true,
      cell: (p, i) => (
        <DnaPicker
          value={p.name}
          kinds={PERSON.or ?? []}
          names
          onChange={(v) => setPerson(i, (x) => ({ ...x, name: v }))}
          aria-label={`Name (Zeile ${i + 1})`}
          className={CELL_COMBOBOX}
        />
      ),
    },
    {
      key: "beamter",
      label: "Zuständiger Beamter",
      cell: (p, i) => (
        <Combobox
          value={p.beamter}
          onChange={(v) => setPerson(i, (x) => ({ ...x, beamter: v }))}
          options={officers}
          aria-label={`Zuständiger Beamter (Zeile ${i + 1})`}
          className={CELL_COMBOBOX}
        />
      ),
    },
    {
      key: "rolle",
      label: "Rolle",
      cell: (p, i) => (
        <Combobox
          value={p.rolle}
          onChange={(v) => setPerson(i, (x) => ({ ...x, rolle: v }))}
          options={ROLES}
          aria-label={`Rolle (Zeile ${i + 1})`}
          className={CELL_COMBOBOX}
        />
      ),
    },
    {
      key: "anmerkung",
      label: "Anmerkung",
      wide: true,
      cell: (p, i) => (
        <TextCell value={p.anmerkung} onChange={(v) => setPerson(i, (x) => ({ ...x, anmerkung: v }))} label={`Anmerkung (Zeile ${i + 1})`} />
      ),
    },
    dialogCell("belehrung", cautionSummary),
    dialogCell("gegenstaende", itemsSummary),
    dialogCell("ed", edSummary),
  ]

  function remove(i: number) {
    const row = operation.people[i]
    onChange((o) => ({ ...o, people: o.people.filter((p) => p.id !== row.id) }))
    removedToast(row.name.trim() ? `„${nameOf(row.name)}“` : `Person ${i + 1}`, () =>
      onChange((o) => ({ ...o, people: insertAt(o.people, i, row) })),
    )
  }

  const changePerson = (id: string, fn: (p: Person) => Person) =>
    onChange((o) => ({ ...o, people: o.people.map((p) => (p.id === id ? fn(p) : p)) }))

  return (
    <SheetSection title="Beteiligte Personen" description="Beschuldigte bekommen in der Sammelakte einen eigenen Bericht.">
      <SheetTable
        rows={operation.people}
        columns={columns}
        addLabel="Person hinzufügen"
        onAdd={() => onChange((o) => ({ ...o, people: [...o.people, newPerson()] }))}
        onRemove={remove}
      />
      <Dialog open={!!openPerson} onOpenChange={(o) => !o && setOpen(undefined)}>
        <DialogContent className={cn("max-h-[calc(100dvh-2rem)]", open?.part === "gegenstaende" ? "sm:max-w-3xl" : "sm:max-w-lg")}>
          {openPerson && open && (
            <>
              <DialogPanel className="overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {PARTS[open.part].title}
                    {openPerson.name.trim() && <span className="text-muted-foreground"> · {nameOf(openPerson.name)}</span>}
                  </DialogTitle>
                  <DialogDescription>{PARTS[open.part].description}</DialogDescription>
                </DialogHeader>
                {open.part === "belehrung" && (
                  <CautionForm person={openPerson} onChange={(fn) => changePerson(openPerson.id, fn)} officers={officers} me={me} />
                )}
                {open.part === "gegenstaende" && <ItemsForm person={openPerson} onChange={(fn) => changePerson(openPerson.id, fn)} />}
                {open.part === "ed" && <EdForm person={openPerson} onChange={(fn) => changePerson(openPerson.id, fn)} />}
              </DialogPanel>
              <DialogFooter>
                <Button onClick={() => setOpen(undefined)}>Fertig</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </SheetSection>
  )
}

type FormProps = { person: Person; onChange: (fn: (p: Person) => Person) => void }

function Field({ id, label, className, children }: { id: string; label: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}

function CautionForm({ person, onChange, officers, me }: FormProps & { officers: string[]; me: string }) {
  const b = person.belehrung
  const set = (key: keyof Person["belehrung"]) => (value: string) =>
    onChange((p) => ({ ...p, belehrung: { ...p.belehrung, [key]: value } }))
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field id="belehrung-anwalt" label="Anwesender Rechtsbeistand">
        <Combobox id="belehrung-anwalt" value={b.anwalt} onChange={set("anwalt")} options={["Nicht gewollt"]} />
      </Field>
      <Field id="belehrung-kanzlei" label="Kanzlei">
        <Input id="belehrung-kanzlei" value={b.kanzlei} onChange={(e) => set("kanzlei")(e.target.value)} />
      </Field>
      <Field id="belehrung-von" label="Belehrt von">
        <Combobox id="belehrung-von" value={b.belehrtVon} onChange={set("belehrtVon")} options={officers} placeholder={me} />
      </Field>
      <Field id="belehrung-zeuge" label="Zeuge der Belehrung">
        <Combobox id="belehrung-zeuge" value={b.zeuge} onChange={set("zeuge")} options={officers} />
      </Field>
      <Field id="belehrung-um" label="Belehrt um" className="sm:col-span-2">
        <DateTimePicker id="belehrung-um" value={b.belehrtUm} onChange={set("belehrtUm")} />
      </Field>
    </div>
  )
}

function ItemsForm({ person, onChange }: FormProps) {
  const setItem = (i: number, fn: (x: Item) => Item) => onChange((p) => ({ ...p, gegenstaende: updateAt(p.gegenstaende, i, fn) }))
  const text = (key: "gegenstand" | "anzahl" | "anmerkung", label: string, size: { wide?: boolean; narrow?: boolean }): SheetColumn<Item> => ({
    key,
    label,
    ...size,
    cell: (x, i) => (
      <TextCell value={x[key]} onChange={(v) => setItem(i, (y) => ({ ...y, [key]: v }))} label={`${label} (Zeile ${i + 1})`} />
    ),
  })
  const columns: SheetColumn<Item>[] = [
    text("gegenstand", "Gegenstand", { wide: true }),
    text("anzahl", "Anzahl", { narrow: true }),
    {
      key: "tatmittel",
      label: "Tatmittel",
      narrow: true,
      cell: (x, i) => (
        <ChoiceCell
          label={`Tatmittel (Zeile ${i + 1})`}
          value={x.tatmittel}
          choices={MARKS}
          onChange={(v) => setItem(i, (y) => ({ ...y, tatmittel: toMark(v) }))}
        />
      ),
    },
    text("anmerkung", "Anmerkung", { wide: true }),
  ]
  function remove(i: number) {
    const row = person.gegenstaende[i]
    onChange((p) => ({ ...p, gegenstaende: p.gegenstaende.filter((x) => x.id !== row.id) }))
    removedToast(row.gegenstand.trim() ? `„${row.gegenstand.trim()}“` : `Gegenstand ${i + 1}`, () =>
      onChange((p) => ({ ...p, gegenstaende: insertAt(p.gegenstaende, i, row) })),
    )
  }
  return (
    <SheetTable
      rows={person.gegenstaende}
      columns={columns}
      addLabel="Gegenstand hinzufügen"
      onAdd={() => onChange((p) => ({ ...p, gegenstaende: [...p.gegenstaende, newItem()] }))}
      onRemove={remove}
    />
  )
}

function EdForm({ person, onChange }: FormProps) {
  return (
    <div className="grid gap-3">
      {ED_MEASURES.map((m) => (
        <label key={m.id} className="flex items-center gap-3 text-sm">
          <Checkbox
            checked={person.ed.includes(m.id)}
            onCheckedChange={(on) =>
              onChange((p) => ({ ...p, ed: on ? [...p.ed.filter((x) => x !== m.id), m.id] : p.ed.filter((x) => x !== m.id) }))
            }
          />
          {m.label}
        </label>
      ))}
    </div>
  )
}
