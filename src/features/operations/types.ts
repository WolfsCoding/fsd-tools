import * as Schema from "effect/Schema"
import type * as Types from "effect/Types"

/** Colors a patrol's check box can take, in menu order. */
export const CHECK_COLORS = ["rot", "gruen", "orange"] as const
export type CheckColor = (typeof CHECK_COLORS)[number]

/** Ja (✓), Nein (×) or not decided yet, written like the case files' mark columns. */
export const Mark = Schema.Literals(["", "✓", "×"])
export type Mark = typeof Mark.Type
export const toMark = (value: string): Mark => (value === "✓" || value === "×" ? value : "")

/** Erkennungsdienstliche Maßnahmen, each with the option it checks in a Beschuldigten-Bericht. */
export const ED_MEASURES = [
  { id: "fa", label: "Fingerabdrücke", option: "Fingerabdrücke nehmen" },
  { id: "dna", label: "DNA-Probe", option: "DNA Probe nehmen" },
  { id: "gsr", label: "Schmauchspurentest", option: "Schmauchspurentest nehmen" },
] as const
export type EdMeasure = (typeof ED_MEASURES)[number]["id"]

export const Patrol = Schema.Struct({
  id: Schema.String,
  checked: Schema.Boolean,
  color: Schema.optionalKey(Schema.Literals(CHECK_COLORS)),
  einheit: Schema.String,
  aufgabe: Schema.String,
  beamte: Schema.Tuple([Schema.String, Schema.String, Schema.String, Schema.String]),
  anmerkung: Schema.String,
})

export const Vehicle = Schema.Struct({
  id: Schema.String,
  modell: Schema.String,
  kennzeichen: Schema.String,
  eigentuemer: Schema.String,
  status: Schema.String,
  durchsucht: Mark,
  anmerkung: Schema.String,
})

export const Item = Schema.Struct({
  id: Schema.String,
  gegenstand: Schema.String,
  anzahl: Schema.String,
  tatmittel: Mark,
  anmerkung: Schema.String,
})

export const Caution = Schema.Struct({
  anwalt: Schema.String,
  kanzlei: Schema.String,
  belehrtVon: Schema.String,
  zeuge: Schema.String,
  /** As a datetime-local input writes it, e.g. "2026-10-02T14:30". */
  belehrtUm: Schema.String,
})

export const Person = Schema.Struct({
  id: Schema.String,
  /** A DNA-/FA-ID, or the name of someone without one, as the case files store people. */
  name: Schema.String,
  beamter: Schema.String,
  rolle: Schema.String,
  anmerkung: Schema.String,
  belehrung: Caution,
  gegenstaende: Schema.Array(Item),
  ed: Schema.Array(Schema.Literals(ED_MEASURES.map((m) => m.id))),
})

export const Lead = Schema.Struct({
  id: Schema.String,
  bereich: Schema.String,
  beamter: Schema.String,
})

export const Info = Schema.Struct({
  id: Schema.String,
  text: Schema.String,
  at: Schema.String,
})

export const Operation = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  ort: Schema.String,
  leitung: Schema.String,
  /** Aktenzeichen of the case file it belongs to. */
  fallakte: Schema.optionalKey(Schema.String),
  /** Radio channel. */
  funk: Schema.optionalKey(Schema.String),
  patrols: Schema.Array(Patrol),
  vehicles: Schema.Array(Vehicle),
  people: Schema.Array(Person),
  infos: Schema.Array(Info),
  /** Bereichsleitungen; stored once the first is added. */
  leads: Schema.optionalKey(Schema.Array(Lead)),
  /** The Sammelakte created from it. */
  caseFileId: Schema.optionalKey(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String,
})

type Mutable<S extends Schema.Top> = Types.DeepMutable<S["Type"]>
export type Operation = Mutable<typeof Operation>
export type Patrol = Mutable<typeof Patrol>
export type Vehicle = Mutable<typeof Vehicle>
export type Person = Mutable<typeof Person>
export type Item = Mutable<typeof Item>
export type Lead = Mutable<typeof Lead>

/** Whether someone is a suspect, the way the case files tell from the role. */
export const isAccused = (person: Pick<Person, "rolle">) => /^beschuldig/i.test(person.rolle)
