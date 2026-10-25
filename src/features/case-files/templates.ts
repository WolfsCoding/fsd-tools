import type { ComponentType } from "react"
import {
  banner,
  bullets,
  cell,
  checklist,
  code,
  DATE_UHR,
  DEFAULT_COLORS,
  DEFAULT_DEPARTMENT,
  DEPARTMENT,
  doc,
  facts,
  formatLocalDateTime,
  LEGEND,
  legend,
  ME,
  MIRANDA,
  NOW,
  rawTable,
  section,
  SUSPECT_MIRANDA,
  table,
  TEMPLATE_ME,
  titleComment,
  WITNESS_CAUTION,
} from "./markdown"
import type { Colors } from "./markdown"
import { chargesMarkdown } from "./charges"
import { ChargesInput } from "./charges-input"
import { roll, type Range } from "./range"
import type { DnaEntry } from "@/features/dna-db/types"
import { formatTraces, lookupLabel, rowLookup, rowTraces, type DbField, type TraceKind } from "./traces"
import type { Row, Value, Values } from "./types"

export type TemplateId =
  | "strafakte"
  | "sammelakte"
  | "ermittlungsakte"
  | "bericht"
  | "geschwindigkeit"
  | "aussage-zeuge"
  | "aussage-officer"
  | "aussage-beschuldigter"

interface BaseField {
  key: string
  label: string
  /** Short help under the field. */
  hint?: string
  /** Should be filled in before the document is handed in; copying it empty warns. */
  required?: boolean
}

/**
 * Kinds of values that are suggested wherever the same kind is asked for again. Each kind
 * stays apart: an officer is never offered as a suspect and the other way round.
 */
export const SUGGESTION_GROUPS = ["person", "officer", "suspect", "witness", "lawyer", "lawFirm", "sao", "judge"] as const
export type SuggestionGroup = (typeof SUGGESTION_GROUPS)[number]

/** What a group's fields offer: their own group; any civilian person also offers suspects and witnesses. */
export const GROUP_OFFERS: Record<SuggestionGroup, SuggestionGroup[]> = {
  person: ["person", "suspect", "witness"],
  officer: ["officer"],
  suspect: ["suspect"],
  witness: ["witness"],
  lawyer: ["lawyer"],
  lawFirm: ["lawFirm"],
  sao: ["sao"],
  judge: ["judge"],
}

export interface TextField extends BaseField {
  type: "text"
  /** Written when the field is empty; defaults to "N/A". */
  fallback?: string
  /** Prefilled with the own name from the settings; empty also writes it. */
  me?: boolean
  /** Fixed values offered in the field's dropdown. */
  suggestions?: string[]
  /** What the value is; it's then offered in fields of the same group. */
  group?: SuggestionGroup
  /** Offers the values entered in other fields of its `group` (or of `offers`). */
  autocomplete?: boolean
  /** Groups offered instead of the field's own, e.g. officers and the SAO for who closed a case. */
  offers?: SuggestionGroup[]
  /** A person picked from the DNA database, e.g. the suspect; shown and written as "Name (ID)". */
  lookup?: Lookup
  numeric?: boolean
  /** A date: a "Heute" button fills in today's, e.g. "29.09.2026". */
  today?: boolean
}

/** Bullet points, one input each. */
export interface ListField extends BaseField {
  type: "list"
  /** Written as the only point while there are none; "" starts without points and writes none. */
  fallback: string
}

/** Empty means automatic: the date and time of copying. */
export interface DateTimeField extends BaseField {
  type: "datetime"
  /** How it's written, in the editor's placeholders (DD, MM, YYYY, HH, mm); defaults to "DD.MM.YYYY HH:mm". */
  pattern?: string
}

/** Any number of options; `{key}` in an option is replaced by that field's text. */
export interface ChecksField extends BaseField {
  type: "checks"
  options: string[]
  /** Text fields filled in within an option, where it says `{key}`. */
  inline?: TextField[]
  /** Placeholder of an input that adds own options, which start checked. Options can then also be removed. */
  custom?: string
  /** Options the other fields decide, checked (true) or not (false); the rest are checked by hand. */
  auto?: (r: Reader) => Record<string, boolean>
  /** Can be folded to one row listing the checked options. */
  collapsible?: boolean
}

/**
 * Sets a value from the one stored by then, e.g. to put a removed row back from a toast
 * without undoing what was changed since.
 */
export type UpdateValue = (key: string, fn: (value: Value | undefined) => Value) => void

/** What a custom field's component gets to edit its value. */
export interface CustomFieldProps {
  field: CustomField
  values: Values
  reader: Reader
  onChange: (key: string, value: Value) => void
  onUpdate: UpdateValue
  docId: string
}

/** A field with its own input, for values none of the other fields fit. */
export interface CustomField extends BaseField {
  type: "custom"
  component: ComponentType<CustomFieldProps>
  /** The value with its random parts rolled again; enables the template's "Würfeln". */
  randomize?: (value: Value | undefined) => Value
}

/** Where the own options of a checklist are stored, next to its checked ones. */
export const customKey = (key: string) => `${key}Custom`
/** Where the removed standard options of a checklist are stored. */
export const hiddenKey = (key: string) => `${key}Hidden`
/** Where the order of a checklist's options is stored once they were moved. */
export const orderKey = (key: string) => `${key}Order`

/** Every field of a template, including the ones filled in within checklist options. */
export function templateFields(template: Template<string>): Field[] {
  return template.sections.flatMap((s) => s.fields).flatMap((f) => (f.type === "checks" && f.inline ? [f, ...f.inline] : [f]))
}

/** One of the options, never picked by hand: `auto` derives it from other fields. */
export interface ChoiceField extends BaseField {
  type: "choice"
  options: string[]
  auto: (r: Reader) => string | undefined
}

/** One value of a column picked from a dropdown. */
export interface Choice {
  value: string
  /** Shown in the dropdown; defaults to the value. */
  label?: string
  className?: string
}

/**
 * A value picked from the DNA database (or added to it). Picking a known one fills the given
 * columns of the row while they're empty, e.g. the DNA-ID next to a name. With `or`, a name
 * also takes IDs of those kinds instead (e.g. the DNA of an unknown person): values that look
 * like one. With `only`, just rows it says so for are linked, e.g. the suspects. With
 * `nameOnly`, the form shows just the person's name, without their ID.
 */
export interface Lookup {
  field: DbField
  fill?: Partial<Record<DbField, string>>
  or?: TraceKind[]
  only?: (row: Row) => boolean
  nameOnly?: boolean
}

/** A person: their name, or their DNA-ID or fingerprint ID while unknown by name. */
export const PERSON: Lookup = { field: "name", or: ["dna", "fa"] }

export interface Column {
  key: string
  label: string
  fallback: string
  /** ✓ / × instead of text. */
  mark?: boolean
  /** A checkbox in front of the row, right after its drag handle, like the checklists; checked writes ✓. */
  check?: boolean
  /** Picked from these instead of typed. */
  choices?: Choice[]
  /** Typical values: shown as the placeholder and rolled with the dice. */
  range?: Range
  /** Rows whose cell of this column gets rolled; defaults to all. */
  rollIf?: (row: Row) => boolean
  /**
   * Several short values side by side in one cell, each stored and rendered under its own key,
   * e.g. the rounds fired and still loaded. The column's own key isn't stored.
   */
  parts?: { key: string; label: string; fallback: string }[]
  /** A count, set with − and + buttons, e.g. of projectiles. */
  counter?: boolean
  /** Key under which older versions stored this value, e.g. one quantity now counted per kind; shown while this one is empty. */
  formerKey?: string
  /** The cells' values are offered in text fields of this group; may depend on the row, e.g. on how a person is named. */
  group?: SuggestionGroup | ((row: Row) => SuggestionGroup | undefined)
  /** Column written in front of the value when it's offered, e.g. the rank before a name. */
  groupPrefix?: string
  /** Offers what was entered in this column before, plus the values of its `group`. */
  autocomplete?: boolean
  /** Picked from the DNA database; see `Lookup`. */
  lookup?: Lookup
  /** Values offered from elsewhere in the same document, e.g. the IDs of the weapons above. */
  options?: (values: Values) => string[]
  /**
   * The traces found on the row's item: shown as "3 Gefunden" with a button that manages
   * whose they are and where they were found. `kinds` are the kinds recorded, each with the
   * key its summary is rendered under; several kinds are recorded together, as pairs.
   */
  traces?: { kinds: Partial<Record<TraceKind, string>>; spots?: string[] }
  /** Fixed values offered in the cell's dropdown. */
  suggestions?: string[]
  /** Value of the cell in a newly added row. */
  initial?: string
  /** What older documents prefilled the cell with; like `initial`, it doesn't count as entered. */
  formerInitial?: string
  wide?: boolean
}

export interface TableField extends BaseField {
  type: "table"
  columns: Column[]
  addLabel: string
  /**
   * Column that identifies a row across case files (e.g. an officer's name). Every cell then
   * offers what was entered before, and a known value fills the row's other cells.
   */
  remember?: string
  /** The own row of a remembered table, built from the settings. */
  ownRow?: (me: { name: string; rank: string }) => Row
  /** One card per row, with a labeled input per column, instead of a table; for rows with many or long cells. */
  layout?: "cards"
  /** Heading of a card, e.g. "2.1 Messer"; defaults to the row's number. */
  cardTitle?: (row: Row, index: number) => string
}

export type Field = TextField | ListField | DateTimeField | ChecksField | ChoiceField | TableField | CustomField

export interface Section {
  title: string
  /** What the section is for, shown under its title. */
  description: string
  /** Rights read out to the person (the Belehrung), shown above the fields. */
  notice?: string
  fields: Field[]
}

export interface Template<Id extends string = TemplateId> {
  id: Id
  label: string
  emoji: string
  description: string
  /** Can be created as its own case file; otherwise only attached to one. */
  standalone: boolean
  /** Name in the menus that create or attach it, e.g. "Aussage; Zeuge"; defaults to `label`. */
  menuLabel?: string
  /** Heading it is listed under when creating a case file, e.g. "Forensik"; defaults to the kind's title. */
  group?: string
  /** Templates that can be attached to a case file of this type. */
  attachable?: Id[]
  sections: Section[]
  /** Values of a new document, e.g. prefilled table rows. */
  initial?: Values
  /** Placeholder values of the empty template (e.g. "XXX" rows), so it shows how it's filled in; defaults to `initial`. */
  sample?: Values
  /** Who or what the document is about, e.g. the suspect's name; "" while unknown. */
  subject: (r: Reader) => string
  /**
   * What the case file is about while this is its main document, besides its suspects and case
   * number (which the title names anyway); defaults to `subject`.
   */
  caseSubject?: (r: Reader) => string
  /** Suggested page title in the editor. */
  pageTitle?: (r: Reader) => string
  render: (r: Reader) => string
  /** The empty template under its own title, as kept in the editor; enables "Vorlage kopieren". */
  blank?: (r: Reader) => string
}

/** Reads a document's values for rendering, filling in what wasn't entered. */
export interface Reader {
  /** The own name from the settings, or the `{{ME}}` placeholder. */
  me: string
  /** The own department from the settings. */
  department: string
  colors: Colors
  /**
   * Reads for the empty template (see `blankMarkdown`): tables and lists with nothing entered
   * get one placeholder row or point, so every part of the document shows.
   */
  blank: boolean
  /** `text` with the `{{ME}}` and `{{DEPARTMENT}}` placeholders replaced. */
  fill: (text: string) => string
  /** The entered text, or "" if there is none. */
  filled: (key: string) => string
  /** The entered text, or what the field writes when empty. */
  text: (key: string) => string
  /** The entered bullet points, or the field's fallback (if it has one) as the only one. */
  lines: (key: string) => string[]
  /** Every option of a checklist, with its `{key}` references filled in. */
  checks: (key: string) => { label: string; checked: boolean }[]
  /** The entered rows with empty cells filled in; none while nothing was entered. */
  rows: (key: string) => Row[]
  /** The stored value as it is, for custom fields. */
  raw: (key: string) => Value | undefined
  field: (key: string) => Field | undefined
}

export function createReader(
  template: Template<string>,
  values: Values,
  ownName: string,
  colors = DEFAULT_COLORS,
  ownDepartment = DEFAULT_DEPARTMENT,
  /** The DNA database; traces and looked up cells show the names and IDs it has. */
  entries: DnaEntry[] = [],
  blank = false,
): Reader {
  const fields = new Map(templateFields(template).map((f) => [f.key, f]))
  const me = ownName.trim() || ME
  const department = ownDepartment.trim() || DEFAULT_DEPARTMENT
  // `{{ME}}` and `{{DEPARTMENT}}` may also be typed (or prefilled) anywhere and follow the settings.
  const withMe = (s: string) => s.trim().replaceAll(ME, me).replaceAll(DEPARTMENT, department)

  const r: Reader = {
    me,
    department,
    colors,
    blank,
    fill: withMe,
    field: (key) => fields.get(key),
    raw: (key) => values[key],
    filled(key) {
      const value = values[key]
      if (typeof value !== "string") return ""
      // A person picked from the DNA database, with their current name and ID.
      const f = fields.get(key)
      if (f?.type === "text" && f.lookup) return withMe(lookupLabel({ [key]: value }, key, f.lookup, entries))
      return withMe(value)
    },
    text(key) {
      const f = fields.get(key)
      const value = r.filled(key)
      if (f?.type === "datetime") {
        if (!f.pattern) return value ? formatLocalDateTime(value) : NOW
        return value ? formatLocalDateTime(value, f.pattern) : `{{now:${f.pattern}}}`
      }
      if (f?.type === "choice") return f.auto(r) ?? ""
      if (value) return value
      if (f?.type === "text" && f.me) return me
      if (f?.type === "text") return f.fallback ?? "N/A"
      return "N/A"
    },
    lines(key) {
      const f = fields.get(key)
      const lines = listItems(values[key]).map(withMe).filter(Boolean)
      if (lines.length || f?.type !== "list") return lines
      if (f.fallback) return [f.fallback]
      return blank ? ["N/A"] : []
    },
    checks(key) {
      const f = fields.get(key)
      if (f?.type !== "checks") return []
      const checked = checkedOptions(values[key])
      const decided = f.auto?.(r) ?? {}
      return checkOptions(f, values).map((o) => ({
        label: withMe(o.replace(/\{(\w+)\}/g, (_, ref: string) => r.text(ref))),
        checked: o in decided ? decided[o] : checked.includes(o),
      }))
    },
    rows(key) {
      const f = fields.get(key)
      if (f?.type !== "table") return []
      // Rows with nothing entered beyond the prefilled cells are left out, so an unused table stays empty.
      const entered = tableRows(values[key]).filter((row) =>
        f.columns.some((c) => {
          if (c.traces) return rowTraces(row, c.key, c.traces.kinds).length > 0
          if (c.parts) return c.parts.some((p) => row[p.key]?.trim())
          const v = row[c.key]?.trim()
          return !!v && v !== c.initial && v !== c.formerInitial
        }),
      )
      // The empty template shows a table with one row of its cells' placeholders.
      const rows = entered.length || !blank ? entered : [{}]
      return rows.map((row) =>
        Object.fromEntries(
          f.columns.flatMap((c) => {
            const { key, traces, parts, formerKey, fallback } = c
            const lookup = rowLookup(c, row)
            if (parts) return parts.map((p) => [p.key, withMe(row[p.key] ?? "") || p.fallback])
            if (lookup) return [[key, withMe(lookupLabel(row, key, lookup, entries)) || withMe(fallback)]]
            if (!traces) return [[key, withMe(row[key] ?? "") || withMe((formerKey && row[formerKey]) || "") || withMe(fallback)]]
            const found = rowTraces(row, key, traces.kinds)
            return Object.entries(traces.kinds).map(([kind, k]) => [k, formatTraces(found, kind as TraceKind, fallback, entries)])
          }),
        ),
      )
    },
  }
  return r
}

/**
 * The empty template as markdown, under its own title if it has one: no own name, a placeholder
 * row or point in every table and list, and `{{now:…}}` dates left for the editor to fill in.
 */
export function blankMarkdown(template: Template<string>, colors?: Colors, department?: string) {
  const r = createReader(template, template.sample ?? template.initial ?? {}, TEMPLATE_ME, colors, department, [], true)
  return template.blank?.(r) ?? template.render(r)
}

/**
 * The values that change when the document's random parts are rolled again: the cells of
 * columns with a `range`, and custom fields that can `randomize`. Empty if there are none.
 */
export function randomized(template: Template<string>, values: Values): Values {
  const changed: Values = {}
  for (const f of templateFields(template)) {
    if (f.type === "custom" && f.randomize) changed[f.key] = f.randomize(values[f.key])
    if (f.type !== "table" || !f.columns.some((c) => c.range)) continue
    const rows = tableRows(values[f.key])
    if (!rows.length) continue
    changed[f.key] = rows.map((row) => {
      const next = { ...row }
      for (const c of f.columns) if (c.range && (c.rollIf?.(row) ?? true)) next[c.key] = roll(c.range)
      return next
    })
  }
  return changed
}

/** Whether "Würfeln" does anything for the template. */
export function canRandomize(template: Template<string>) {
  return templateFields(template).some(
    (f) => (f.type === "custom" && !!f.randomize) || (f.type === "table" && f.columns.some((c) => c.range)),
  )
}

/** Bullet points of a list field; earlier versions stored them as one multi-line text. */
export function listItems(value: Value | undefined): string[] {
  if (typeof value === "string") return value.split("\n")
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []
}

/** The checked options of a checklist. */
export function checkedOptions(value: Value | undefined): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []
}

/**
 * A checklist's options in display order: the standard ones not removed, then the own ones.
 * Once they were moved, in the stored order; options it doesn't know yet follow at the end.
 */
export function checkOptions(field: ChecksField, values: Values) {
  const hidden = listItems(values[hiddenKey(field.key)])
  const own = field.custom ? listItems(values[customKey(field.key)]).filter((o) => o.trim()) : []
  const options = [...field.options.filter((o) => !hidden.includes(o)), ...own]
  const order = listItems(values[orderKey(field.key)]).filter((o) => options.includes(o))
  return [...new Set([...order, ...options])]
}

/**
 * Whether something was entered in `field`; `undefined` for fields that are never empty, e.g.
 * automatic times and choices. Prefilled values that weren't touched (an own name, the first
 * rows of a table) count as entered.
 */
export function isFilled(field: Field, r: Reader): boolean | undefined {
  const value = r.raw(field.key)
  switch (field.type) {
    case "text":
      return !!r.filled(field.key) || (!!field.me && value === undefined && r.me !== ME)
    case "list":
      return listItems(value).some((l) => l.trim())
    case "checks":
      return r.checks(field.key).some((c) => c.checked)
    case "table":
      return r.rows(field.key).length > 0
    case "custom":
      return Array.isArray(value) ? value.length > 0 : !!value?.trim()
    case "datetime":
    case "choice":
      return undefined
  }
}

/** The labels of the required fields of a document still empty, in form order. */
export function missingRequired(template: Template<string>, r: Reader) {
  return template.sections.flatMap((s) => s.fields).flatMap((f) => (f.required && isFilled(f, r) === false ? [f.label] : []))
}

/** `items` with `item` put back at `index`, e.g. to undo removing it. */
export function insertAt<T>(items: T[], index: number, item: T) {
  return [...items.slice(0, index), item, ...items.slice(index)]
}

/** The rows of a table field, skipping anything that isn't a row. */
export function tableRows(value: Value | undefined): Row[] {
  return Array.isArray(value) ? value.filter((r): r is Row => typeof r === "object" && r !== null) : []
}

/* Field groups and blocks several templates share. */

/** A VPD header from the hosted header API. */
export function headerImage(title: string) {
  const params = new URLSearchParams({ title, subtitle: "Vinewood Police Department", logo: "vpd", scale: "2" })
  return `https://hs-headers.poyixq.app/?${params.toString().replaceAll("+", "%20")}`
}

const CRIMINAL_BANNER = headerImage("Strafakte")
const COLLECTIVE_BANNER = headerImage("Sammelakte")
const INVESTIGATION_BANNER = headerImage("Ermittlung")
const SPEEDING_BANNER = headerImage("Speedingticket")
const SUSPECT_BANNER = headerImage("Beschuldigter")
const STATEMENT_BANNER = headerImage("Aussage")

const ITEMS: TableField = {
  type: "table",
  key: "gegenstaende",
  label: "Gegenstände",
  addLabel: "Gegenstand",
  columns: [
    { key: "gegenstand", label: "Gegenstand", fallback: "N/A", wide: true },
    { key: "anzahl", label: "Anzahl", fallback: "00" },
    {
      key: "verlauf",
      label: "Verlauf",
      fallback: "Abgenommen durch Officer XY » übergeben an Forensic » ausgehändigt",
      initial: `Abgenommen durch ${ME}`,
      wide: true,
    },
    { key: "tatmittel", label: "Tatmittel", fallback: "✓/×", mark: true },
    { key: "anmerkung", label: "Anmerkung", fallback: "--", wide: true },
  ],
}

const VEHICLES: TableField = {
  type: "table",
  key: "fahrzeuge",
  label: "Fahrzeuge",
  addLabel: "Fahrzeug",
  columns: [
    { key: "modell", label: "Fahrzeugmodell", fallback: "N/A", autocomplete: true },
    { key: "kennzeichen", label: "Kennzeichen", fallback: "N/A" },
    { key: "halter", label: "Halter", fallback: "N/A", group: "person", autocomplete: true },
    { key: "durchsucht", label: "Durchsucht", fallback: "✓/×", mark: true },
    { key: "durchsuchtVon", label: "Durchsucht von", fallback: "N/A", group: "officer", autocomplete: true },
    { key: "fund", label: "Fund", fallback: "N/A", wide: true },
    { key: "anmerkung", label: "Anmerkung", fallback: "N/A", wide: true },
  ],
}

/** Open tasks, each with who takes care of it; written as a checklist. */
const TODOS: TableField = {
  type: "table",
  key: "todos",
  label: "Aufgaben",
  addLabel: "Aufgabe",
  columns: [
    { key: "aufgabe", label: "Aufgabe", fallback: "N/A", wide: true },
    { key: "zustaendig", label: "Zuständige Person", fallback: "Zuständige Person", group: "officer", autocomplete: true },
    { key: "erledigt", label: "Erledigt", fallback: "×", check: true },
  ],
}

const todoRows = (...tasks: string[]): Row[] => tasks.map((aufgabe) => ({ aufgabe, zustaendig: "", erledigt: "" }))

const OTHER: ListField = { type: "list", key: "sonstiges", label: "Sonstiges", fallback: "" }

const OTHER_SECTION: Section = {
  title: "Sonstige Informationen",
  description: "Alles, was sonst noch wichtig ist.",
  fields: [OTHER],
}

const CAUTION_FIELDS: Field[] = [
  {
    type: "text",
    key: "anwalt",
    label: "Anwesender Rechtsbeistand",
    fallback: "N/A",
    suggestions: ["Nicht gewollt"],
    group: "lawyer",
    autocomplete: true,
  },
  { type: "text", key: "kanzlei", label: "Kanzlei", fallback: "N/A", group: "lawFirm", autocomplete: true },
  { type: "text", key: "belehrtVon", label: "Belehrt von", me: true, group: "officer", autocomplete: true },
  {
    type: "text",
    key: "belehrtZeuge",
    label: "Zeuge der Belehrung",
    fallback: "N/A",
    // The second officer present, like the witness of a statement.
    group: "officer",
    autocomplete: true,
  },
  { type: "datetime", key: "belehrtUm", label: "Belehrt um", pattern: DATE_UHR },
]

const SAO: TextField = { type: "text", key: "sao", label: "State Attorney", group: "sao", autocomplete: true }

const CLOSED_BY: TextField = {
  type: "text",
  key: "eingestelltDurch",
  label: "Eingestellt durch",
  autocomplete: true,
  offers: ["officer", "sao"],
}

/** Where an investigation stands; `informed` is the field saying who informed the State Attorney Office. */
const investigationStatus = (informed: TextField, preposition: string): ChecksField => ({
  type: "checks",
  key: "aktenfuehrung",
  label: "Status",
  options: [
    `Das State Attorney Office wurde ${preposition} \`{${informed.key}}\` informiert.`,
    "Das State Attorney Office wurde nicht informiert.",
    "Die Ermittlungssache bietet derzeit keine hinreichenden Informationen zum Klageverhalt.",
    "Die Ermittlungssache bietet hinreichende Informationen zum Klageverhalt.",
    "Die Ermittlungssache wurde eingestellt durch `{eingestelltDurch}`.",
  ],
  inline: [informed, CLOSED_BY],
  custom: "Weiteren Eintrag hinzufügen…",
})

function tableOf(r: Reader, key: string) {
  const f = r.field(key)
  if (f?.type !== "table") return ""
  return table(
    f.columns.map((c) => c.label),
    r.rows(key).map((row) => f.columns.map((c) => row[c.key])),
  )
}

/**
 * The vehicles, with whether they were searched as a colored Ja or Nein. Unset, both are
 * written, each colored, so deleting one leaves the right one.
 */
function vehicleTable(r: Reader) {
  const yes = `<font color="#34D399">${code("Ja")}</font>`
  const no = `<font color="#F87171">${code("Nein")}</font>`
  const searched = (mark: string) => (mark === "✓" ? yes : mark === "×" ? no : `${yes}/${no}`)
  return rawTable(
    VEHICLES.columns.map((c) => c.label),
    r
      .rows("fahrzeuge")
      .map((row) => VEHICLES.columns.map((c) => (c.key === "durchsucht" ? searched(row.durchsucht) : cell(row[c.key])))),
  )
}

/** A date field followed by "Uhr". */
const uhr = (r: Reader, key: string) => `${r.text(key)} Uhr`

function caution(r: Reader, notice: string) {
  return `${facts([
    ["Anwesender Rechtsbeistand", r.text("anwalt")],
    ["Kanzlei", r.text("kanzlei")],
    ["Belehrt von", r.text("belehrtVon")],
    ["Zeuge der Belehrung", r.text("belehrtZeuge")],
    ["Belehrt um", uhr(r, "belehrtUm")],
  ])}\n\n> **${notice}**`
}

function todoList(r: Reader) {
  return checklist(
    r.rows("todos").map((row) => ({ label: `${row.aufgabe} - ${code(row.zustaendig)}`, checked: row.erledigt === "✓" })),
  )
}

/* The templates. */

const criminalFile: Template = {
  id: "strafakte",
  label: "Strafakte",
  emoji: "📁",
  description: "Einzelner Beschuldigter: Tathergang, Identifizierung, Gegenstände, Fahrzeuge und Belehrung.",
  standalone: true,
  attachable: ["aussage-zeuge", "aussage-officer", "aussage-beschuldigter"],
  sections: [
    {
      title: "Allgemein",
      description: "Wo es passiert ist und wo die Abhandlung stattfand.",
      fields: [
        { type: "text", key: "tatort", label: "Tatort", fallback: "N/A", required: true },
        {
          type: "text",
          key: "abhandlung",
          label: "Abhandlung durchgeführt",
          fallback: "vor Ort / HP / MD",
          suggestions: ["vor Ort", "HP", "MD"],
        },
      ],
    },
    {
      title: "Tathergang",
      description: "Was passiert ist, Punkt für Punkt.",
      fields: [{ type: "list", key: "tathergang", label: "Tathergang", fallback: "Tathergang", required: true }],
    },
    {
      title: "Identifizierung des Beschuldigten",
      description: "Wie der Beschuldigte identifiziert wurde.",
      fields: [
        {
          type: "checks",
          key: "identifizierung",
          label: "Identifiziert durch",
          custom: "Weitere Identifizierung hinzufügen…",
          options: [
            "Der BES wurde durch einen Ausweis identifiziert",
            "Der BES wurde durch einen Führerschein identifiziert",
            "Der BES wurde durch eine DNA-Probe identifiziert",
            "Der BES wurde durch einen Fingerabdruck identifiziert",
          ],
        },
      ],
    },
    {
      title: "Sichergestellte Gegenstände",
      description: "Gegenstände, die abgenommen oder sichergestellt wurden.",
      fields: [ITEMS],
    },
    {
      title: "Beteiligte Fahrzeuge",
      description: "Fahrzeuge, die am Geschehen beteiligt waren.",
      fields: [VEHICLES],
    },
    {
      title: "Rechtsbeistand & Belehrung",
      description: "Anwalt, Kanzlei und wer wann belehrt hat.",
      fields: CAUTION_FIELDS,
      notice: SUSPECT_MIRANDA,
    },
    {
      title: "Aktenführung",
      description: "Ob und von wem das State Attorney Office informiert wurde.",
      fields: [
        {
          type: "checks",
          key: "aktenfuehrung",
          label: "Status",
          options: [
            "Das State Attorney Office wurde von `{sao}` informiert.",
            "Das State Attorney Office wurde nicht informiert.",
          ],
          inline: [SAO],
          custom: "Weiteren Eintrag hinzufügen…",
        },
      ],
    },
    {
      title: "TO-DO",
      description: "Was noch erledigt werden muss und wer sich darum kümmert.",
      fields: [TODOS],
    },
    OTHER_SECTION,
    {
      title: "Strafrechner",
      description: "Straftaten aus dem Gesetzbuch wählen und die Strafe berechnen. Erscheint nicht im Markdown.",
      fields: [{ type: "custom", key: "strafen", label: "Straftaten", component: ChargesInput }],
    },
  ],
  initial: {
    todos: todoRows("Fingerabdrücke nehmen", "DNA-Probe nehmen", "Zeuge `XY` befragen"),
  },
  subject: (r) => r.filled("tatort"),
  render: (r) =>
    doc(
      banner(CRIMINAL_BANNER),
      facts([
        ["TATORT", r.text("tatort")],
        ["ABHANDLUNG DURCHGEFÜHRT", r.text("abhandlung")],
      ]),
      section(r, "1. Tathergang:", bullets(r.lines("tathergang"))),
      section(r, "2. Identifizierung des Beschuldigten:", checklist(r.checks("identifizierung"))),
      section(r, "3. Sichergestellte Gegenstände:", tableOf(r, "gegenstaende")),
      section(r, "4. Beteiligte Fahrzeuge:", vehicleTable(r)),
      section(r, "5. Rechtsbeistand & Belehrung:", caution(r, SUSPECT_MIRANDA)),
      section(r, "6. Aktenführung:", checklist(r.checks("aktenfuehrung"))),
      section(r, "7. TO-DO:", todoList(r)),
      section(r, "8. Sonstige Informationen:", bullets(r.lines("sonstiges"))),
      legend(r, "9. Legende:"),
    ) + "\n\n---",
}

const investigationFile: Template = {
  id: "ermittlungsakte",
  label: "Ermittlungsakte",
  emoji: "🔎",
  description: "Längere Ermittlung gegen Personen oder Gruppierungen. Für jeden Beschuldigten kommt ein eigener Bericht dazu.",
  standalone: true,
  attachable: ["bericht", "aussage-zeuge", "aussage-officer", "aussage-beschuldigter"],
  sections: [
    {
      title: "Allgemein",
      description: "Gegen wen ermittelt wird, wo und wer zuständig ist.",
      fields: [
        { type: "text", key: "gegen", label: "Ermittlung gegen", fallback: "AUFLISTUNG BES / GRUPPIERUNGS NAME", required: true },
        { type: "datetime", key: "datum", label: "Datum & Uhrzeit", pattern: DATE_UHR },
        { type: "text", key: "tatort", label: "Tatort" },
        { type: "text", key: "leiter", label: "Leitender Ermittler", me: true, group: "officer", autocomplete: true },
        { type: "text", key: "ermittler", label: "Weitere Ermittler", group: "officer", autocomplete: true },
        { type: "text", key: "zustaendigSao", label: "Zuständiger State Attorney", group: "sao", autocomplete: true },
        { type: "text", key: "judge", label: "Zuständiger Judge", group: "judge", autocomplete: true },
      ],
    },
    {
      title: "Initialer Ermittlungsanlass",
      description: "Was die Ermittlung ausgelöst hat.",
      fields: [{ type: "list", key: "anlass", label: "Ermittlungsanlass", fallback: "Tathergang", required: true }],
    },
    {
      title: "Bisherige Informationen",
      description: "Was bisher für die Ermittlung relevant ist.",
      fields: [{ type: "list", key: "informationen", label: "Informationen", fallback: "Tathergang" }],
    },
    {
      title: "Beteiligte Fahrzeuge",
      description: "Fahrzeuge, die am Geschehen beteiligt waren.",
      fields: [VEHICLES],
    },
    {
      title: "TO-DO",
      description: "Was noch erledigt werden muss und wer sich darum kümmert.",
      fields: [TODOS],
    },
    {
      title: "Aktenführung",
      description: "Stand der Ermittlung und Information an das State Attorney Office.",
      fields: [
        investigationStatus(
          { type: "text", key: "informiertDurch", label: "Informiert durch", autocomplete: true, offers: ["officer", "sao"] },
          "durch",
        ),
      ],
    },
    OTHER_SECTION,
  ],
  initial: {
    todos: todoRows("Forensische Berichte anfertigen", "Befragung von `XY`"),
  },
  subject: (r) => r.filled("gegen") || r.filled("tatort"),
  render: (r) =>
    doc(
      banner(INVESTIGATION_BANNER),
      facts([
        ["ERMITTLUNG GEGEN", r.text("gegen")],
        ["DATUM & UHRZEIT", uhr(r, "datum")],
        ["TATORT", r.text("tatort")],
        ["LEITENDER ERMITTLER", r.text("leiter")],
        ["WEITERE ERMITTLER", r.text("ermittler")],
        ["ZUSTÄNDIGER STATE ATTORNEY", r.text("zustaendigSao")],
        ["ZUSTÄNDIGER JUDGE", r.text("judge")],
      ]),
      section(r, "1. INITIALER ERMITTLUNGSANLASS:", bullets(r.lines("anlass"))),
      section(r, "2. BISHERIGE ERMITTLUNGSRELEVANTE INFORMATIONEN:", bullets(r.lines("informationen"))),
      section(r, "3. Beteiligte Fahrzeuge:", vehicleTable(r)),
      section(r, "4. TO-DO:", todoList(r)),
      section(r, "5. Aktenführung:", checklist(r.checks("aktenfuehrung"))),
      section(r, "6. Sonstige Informationen:", bullets(r.lines("sonstiges"))),
      legend(r, "7. Legende:"),
    ) + "\n\n---",
}

const collectiveFile: Template = {
  id: "sammelakte",
  label: "Sammelakte",
  emoji: "🗂️",
  description: "Einsatz mit mehreren Beteiligten. Für jeden Beschuldigten kommt ein eigener Bericht dazu.",
  standalone: true,
  attachable: ["bericht", "aussage-zeuge", "aussage-officer", "aussage-beschuldigter"],
  sections: [
    {
      title: "Allgemein",
      description: "Tatort, Zeitpunkt und Einsatzleitung.",
      fields: [
        { type: "text", key: "tatort", label: "Tatort", required: true },
        { type: "datetime", key: "datum", label: "Datum & Uhrzeit", pattern: DATE_UHR },
        { type: "text", key: "leitung", label: "Einsatzleitung", me: true, group: "officer", autocomplete: true },
      ],
    },
    {
      title: "Tathergang",
      description: "Was passiert ist, Punkt für Punkt.",
      fields: [{ type: "list", key: "tathergang", label: "Tathergang", fallback: "Tathergang", required: true }],
    },
    {
      title: "Beteiligte Fahrzeuge",
      description: "Fahrzeuge, die am Geschehen beteiligt waren.",
      fields: [VEHICLES],
    },
    {
      title: "Aktenführung",
      description: "Stand der Ermittlung und Information an das State Attorney Office.",
      fields: [investigationStatus(SAO, "von")],
    },
    {
      title: "TO-DO",
      description: "Was noch erledigt werden muss und wer sich darum kümmert.",
      fields: [TODOS],
    },
    OTHER_SECTION,
  ],
  initial: {
    todos: todoRows("Alle Beschuldigten in die Akte aufnehmen", "Aussage von `XY` aufnehmen"),
  },
  subject: (r) => r.filled("tatort"),
  render: (r) =>
    doc(
      banner(COLLECTIVE_BANNER),
      facts([
        ["TATORT", r.text("tatort")],
        ["DATUM & UHRZEIT", uhr(r, "datum")],
        ["EINSATZ LEITUNG", r.text("leitung")],
      ]),
      section(r, "1. Tathergang:", bullets(r.lines("tathergang"))),
      section(r, "2. Beteiligte Fahrzeuge:", vehicleTable(r)),
      section(r, "3. Aktenführung:", checklist(r.checks("aktenfuehrung"))),
      section(r, "4. TO-DO:", todoList(r)),
      section(r, "5. Sonstige Informationen:", bullets(r.lines("sonstiges"))),
      legend(r, "6. Legende:"),
    ) + "\n\n---",
}

const reportTitle = (r: Reader) => `🔴 Beschuldigter: ${r.text("name")}`

/** Title of the empty template in the editor. */
const REPORT_TEMPLATE_TITLE = "📝 Vorlage: Beschuldigten Bericht"

/** A suggested title (e.g. "Titel: …") and the legend, invisible once pasted. */
function reportComment(titleLine: string) {
  return `<!--
    ${titleLine}

    Legende:
${LEGEND.map((l) => `    - ${code(l)}`).join("\n")}
 -->`
}

const report: Template = {
  id: "bericht",
  label: "Beschuldigten-Bericht",
  emoji: "🔴",
  description: "Eintrag für einen Beschuldigten in einer Sammel- oder Ermittlungsakte.",
  standalone: false,
  sections: [
    {
      title: "Beschuldigter",
      description: "Wer der Beschuldigte ist und wo er sich befindet.",
      fields: [
        {
          type: "text",
          key: "name",
          label: "Name",
          required: true,
          fallback: "Name des Beschuldigten",
          group: "suspect",
          autocomplete: true,
          lookup: PERSON,
        },
        { type: "text", key: "officer", label: "Zuständiger Officer", me: true, group: "officer", autocomplete: true },
        {
          type: "text",
          key: "standort",
          label: "Standort",
          fallback: "Tatort / MD / Zelle XY / Entlassen",
          suggestions: ["Tatort", "MD", "Zelle ", "Entlassen"],
        },
      ],
    },
    {
      title: "Abgenommene Gegenstände",
      description: "Gegenstände, die dem Beschuldigten abgenommen wurden.",
      fields: [ITEMS],
    },
    {
      title: "Rechtsbeistand & Belehrung",
      description: "Anwalt, Kanzlei und wer wann belehrt hat.",
      fields: CAUTION_FIELDS,
      notice: MIRANDA,
    },
    {
      title: "Aussage",
      description: "Was der Beschuldigte ausgesagt hat.",
      fields: [{ type: "list", key: "aussage", label: "Aussage", fallback: "Die Aussage des Beschuldigten hier" }],
    },
    {
      title: "TO-DO",
      description: "Was beim Beschuldigten noch erledigt werden muss.",
      fields: [
        {
          type: "checks",
          key: "todos",
          label: "TO-DO",
          options: ["Fingerabdrücke nehmen", "DNA Probe nehmen", "Schmauchspurentest nehmen", "Aussage aufnehmen"],
        },
      ],
    },
    {
      title: "Potentielle Strafen",
      description: "Mögliche Straftaten aus dem Gesetzbuch mit Strafrahmen und Summe.",
      fields: [{ type: "custom", key: "strafen", label: "Potentielle Strafen", component: ChargesInput }],
    },
    OTHER_SECTION,
    {
      title: "Entlassen",
      description: "Ob der Beschuldigte entlassen ist.",
      fields: [{ type: "checks", key: "entlassen", label: "Entlassen", options: ["Der Beschuldigte ist entlassen worden"] }],
    },
  ],
  subject: (r) => r.filled("name"),
  pageTitle: reportTitle,
  render: (r) => reportMarkdown(r, `Titel: ${reportTitle(r)}`),
  blank: (r) => reportMarkdown(r, `Vorlagen Titel: ${REPORT_TEMPLATE_TITLE}`),
}

function reportMarkdown(r: Reader, titleLine: string) {
  return (
    reportComment(titleLine) +
    "\n\n" +
    doc(
      banner(SUSPECT_BANNER),
      facts([
        ["NAME", r.text("name")],
        ["ZUSTÄNDIGER OFFICER", r.text("officer")],
        ["STANDORT", r.text("standort")],
      ]),
      section(r, "1. Abgenommene Gegenstände:", tableOf(r, "gegenstaende")),
      section(r, "2. Rechtsbeistand & Belehrung:", caution(r, MIRANDA)),
      section(r, "3. Aussage:", bullets(r.lines("aussage"))),
      section(r, "4. TO-DO:", checklist(r.checks("todos"))),
      section(r, "5. Potentielle Strafen:", chargesMarkdown(r.raw("strafen"), r.blank)),
      section(r, "6. Sonstige Informationen:", bullets(r.lines("sonstiges"))),
      section(r, "7. Entlassen:", checklist(r.checks("entlassen"))),
    )
  )
}

const SPEED_FINES = [
  "1 km/h bis 20 km/h auf 25 $",
  "21 km/h bis 40 km/h auf 250 $",
  "41 km/h bis 80 km/h auf 750 $",
  "mehr als 80 km/h auf 1.500 $",
]

const MEASURED_AT = ["Die Messung wurde `Innerorts` durchgeführt", "Die Messung wurde `Außerorts` durchgeführt"]

/** Violations of § 20 TO with their fine; checked means the BES committed it. */
const SAFETY_DUTIES = [
  "Der BES führte keinen Verbandskasten und/oder kein Warndreieck im Fahrzeug mit `200 $`",
  "Der BES führte das Fahrzeug ohne die erforderliche Beleuchtung `250 $`",
]

const number = (s: string) => Number.parseInt(s.replace(/\D/g, ""), 10)

const speeding: Template = {
  id: "geschwindigkeit",
  label: "Geschwindigkeitsmessung",
  emoji: "🚨",
  description: "Gemessene Geschwindigkeit und die Stufe des Bußgelds.",
  standalone: true,
  sections: [
    {
      title: "Messung",
      description: "Wann, wo und von wem gemessen wurde.",
      fields: [
        { type: "datetime", key: "datum", label: "Datum & Uhrzeit", pattern: DATE_UHR },
        { type: "text", key: "ort", label: "Ort", required: true },
        { type: "text", key: "von", label: "Von", me: true, group: "officer", autocomplete: true },
        { type: "text", key: "gemessen", label: "Gemessen (km/h)", fallback: "000", numeric: true, required: true },
        {
          type: "text",
          key: "erlaubt",
          label: "Erlaubt (km/h)",
          required: true,
          fallback: "",
          numeric: true,
          // Only the number counts, so the labels can stay readable.
          suggestions: ["Innerorts (85 km/h)", "Außerorts (120 km/h)"],
        },
      ],
    },
    {
      title: "Ergebnis",
      description: "Die Stufe des Bußgelds nach der Überschreitung und wo gemessen wurde.",
      fields: [
        {
          type: "choice",
          key: "ergebnis",
          label: "Überschreitung",
          options: SPEED_FINES,
          auto: (r) => {
            const over = number(r.filled("gemessen")) - number(r.filled("erlaubt"))
            if (!(over > 0)) return undefined
            return SPEED_FINES[over <= 20 ? 0 : over <= 40 ? 1 : over <= 80 ? 2 : 3]
          },
        },
        {
          type: "choice",
          key: "ortDerMessung",
          label: "Ort der Messung",
          options: MEASURED_AT,
          // From the allowed speed: 85 km/h within towns, 120 km/h outside.
          auto: (r) => {
            const allowed = r.filled("erlaubt")
            if (/inner/i.test(allowed) || number(allowed) === 85) return MEASURED_AT[0]
            if (/au(ß|ss)er/i.test(allowed) || number(allowed) === 120) return MEASURED_AT[1]
            return undefined
          },
        },
      ],
    },
    {
      title: "Sicherungspflichten",
      description: "Verstöße gegen die Sicherungspflichten; nur angehakte zählen.",
      fields: [{ type: "checks", key: "sicherungspflichten", label: "Sicherungspflichten", options: SAFETY_DUTIES }],
    },
  ],
  subject: (r) => r.filled("ort"),
  render: (r) =>
    doc(
      banner(SPEEDING_BANNER),
      facts([
        ["DATUM & UHRZEIT", uhr(r, "datum")],
        ["ORT", r.text("ort")],
        ["VON", r.text("von")],
        ["GEMESSENE GESCHWINDIGKEIT", `${r.text("gemessen").replace(/\s*km\/h$/i, "")} km/h`],
      ]),
      section(r, "1. Ergebnis:", checklist(SPEED_FINES.map((f) => ({ label: f, checked: r.text("ergebnis") === f })))),
      section(r, "2. Ort der Messung:", checklist(MEASURED_AT.map((o) => ({ label: o, checked: r.text("ortDerMessung") === o })))),
      section(r, "3. Sicherungspflichten:", checklist(r.checks("sicherungspflichten"))),
    ) + "\n\n---",
}

const witnessTitle = (r: Reader) => `🟣 Aussage: ${r.text("name")}`

const witnessStatement: Template = {
  id: "aussage-zeuge",
  label: "Zeugenaussage",
  menuLabel: "Aussage; Zeuge",
  emoji: "🟣",
  description: "Aussage eines Zeugen oder Zivilisten mit Belehrung.",
  standalone: true,
  sections: [
    {
      title: "Allgemein",
      description: "Wer aussagt, wann und wer die Aussage aufnimmt.",
      fields: [
        {
          type: "text",
          key: "name",
          label: "Aussage von",
          required: true,
          fallback: "Name des Zeugen",
          group: "witness",
          autocomplete: true,
        },
        { type: "datetime", key: "datum", label: "Datum & Uhrzeit", pattern: DATE_UHR },
        {
          type: "text",
          key: "aufgenommen",
          label: "Aufgenommen durch",
          me: true,
          group: "officer",
          autocomplete: true,
        },
        {
          type: "text",
          key: "zeuge",
          label: "Zeuge der Aussage",
          fallback: "N/A",
          group: "officer",
          autocomplete: true,
        },
      ],
    },
    {
      title: "Rechtsbeistand & Belehrung",
      description: "Anwalt, Kanzlei und wer wann belehrt hat.",
      fields: CAUTION_FIELDS,
      notice: WITNESS_CAUTION,
    },
    {
      title: "Aussage",
      description: "Was der Zeuge ausgesagt hat.",
      fields: [{ type: "list", key: "aussage", label: "Aussage", fallback: "Aussage des Zeugen", required: true }],
    },
    OTHER_SECTION,
  ],
  subject: (r) => r.filled("name"),
  pageTitle: witnessTitle,
  render: (r) =>
    titleComment(witnessTitle(r)) +
    "\n\n" +
    doc(
      banner(STATEMENT_BANNER),
      facts([
        ["AUSSAGE VON", r.text("name")],
        ["DATUM & UHRZEIT", uhr(r, "datum")],
        ["AUFGENOMMEN DURCH", r.text("aufgenommen")],
        ["ZEUGE DER AUSSAGE", r.text("zeuge")],
      ]),
      section(r, "1. Rechtsbeistand & Belehrung:", caution(r, WITNESS_CAUTION)),
      section(r, "2. Aussage:", bullets(r.lines("aussage"))),
      section(r, "3. Sonstige Informationen:", bullets(r.lines("sonstiges"))),
    ),
}

const officerTitle = (r: Reader) => `🔵 Aussage: ${r.text("von")}`

const officerStatement: Template = {
  id: "aussage-officer",
  label: "Officer-Aussage",
  menuLabel: "Aussage; Officer",
  emoji: "🔵",
  description: "Eigene Aussage mit Streifenbesetzung.",
  standalone: true,
  sections: [
    {
      title: "Allgemein",
      description: "Wer aussagt und wann.",
      fields: [
        { type: "text", key: "von", label: "Aussage von", me: true, group: "officer", autocomplete: true },
        { type: "datetime", key: "datum", label: "Datum & Uhrzeit" },
      ],
    },
    {
      title: "Streifenbesetzung",
      description: "Wer mit in der Streife war.",
      fields: [
        {
          type: "table",
          key: "streife",
          label: "Besetzung",
          addLabel: "Officer",
          remember: "name",
          ownRow: (me) => ({ name: me.name, rang: me.rank }),
          columns: [
            { key: "name", label: "Name", fallback: "N/A", group: "officer", groupPrefix: "rang" },
            { key: "rang", label: "Rang", fallback: "Officer X" },
            // Empty writes the own department; other officers' departments are entered.
            { key: "department", label: "Department", fallback: DEPARTMENT, formerInitial: "El Burro Heights Police Department", wide: true },
          ],
        },
      ],
    },
    {
      title: "Aussage",
      description: "Der Ablauf aus eigener Sicht.",
      fields: [{ type: "list", key: "aussage", label: "Aussage", fallback: "Aussage des Officers", required: true }],
    },
    {
      title: "Sonstige Infos",
      description: "Alles, was sonst noch wichtig ist.",
      fields: [OTHER],
    },
    {
      title: "Bezeichnungen",
      description: "Wie Personen in der Aussage genannt werden.",
      fields: [
        {
          type: "table",
          key: "bezeichnungen",
          label: "Nachfolgend bezeichnet als",
          addLabel: "Person",
          columns: [
            {
              key: "name",
              label: "Name",
              fallback: "N/A",
              // Suspects for "BES", witnesses for "Zeuge", anyone else for other names.
              group: (row) => (isSuspect(row) ? "suspect" : /^zeug/i.test(row.als ?? "") ? "witness" : "person"),
              autocomplete: true,
              // Suspects are picked from the DNA database.
              lookup: { ...PERSON, only: isSuspect },
            },
            { key: "als", label: "Bezeichnet als", fallback: "BES", suggestions: ["BES", "Zeuge", "Opfer"] },
          ],
        },
      ],
    },
  ],
  initial: {
    streife: [{ name: "", rang: "", department: "" }],
    bezeichnungen: [
      { name: "", als: "BES" },
      { name: "", als: "Zeuge" },
    ],
  },
  subject: (r) => r.filled("von"),
  pageTitle: officerTitle,
  render: (r) =>
    titleComment(officerTitle(r)) +
    "\n\n" +
    doc(
      banner(STATEMENT_BANNER),
      facts([
        ["AUSSAGE VON", r.text("von")],
        ["DATUM & UHRZEIT", r.text("datum")],
      ]),
      section(
        r,
        "1. Streifenbesetzung:",
        table(
          ["Name", "Rang", "Department"],
          r.rows("streife").map((row) => [row.name, row.rang, row.department]),
        ),
      ),
      section(r, "2. Aussage:", bullets(r.lines("aussage"))),
      section(r, "3. Sonstige Infos:", bullets(r.lines("sonstiges"))),
      section(
        r,
        "4. Legende:",
        r
          .rows("bezeichnungen")
          .map((row) => `> - ${code(row.name)} nachfolgend als ${row.als} bezeichnet`)
          .join("\n"),
      ),
    ),
}

/** A person named "BES" in a statement. */
function isSuspect(row: Row) {
  return /^bes/i.test(row.als ?? "")
}

const suspectTitle = (r: Reader) => `🔴 Aussage: ${r.text("name")}`

const suspectStatement: Template = {
  id: "aussage-beschuldigter",
  label: "Beschuldigtenaussage",
  menuLabel: "Aussage; Beschuldigter",
  emoji: "🔴",
  description: "Aussage eines Beschuldigten mit Belehrung.",
  standalone: true,
  sections: [
    {
      title: "Allgemein",
      description: "Wer aussagt, wann und wer die Aussage aufnimmt.",
      fields: [
        {
          type: "text",
          key: "name",
          label: "Aussage von",
          required: true,
          fallback: "Name des Beschuldigten",
          group: "suspect",
          autocomplete: true,
          lookup: PERSON,
        },
        { type: "datetime", key: "datum", label: "Datum & Uhrzeit", pattern: DATE_UHR },
        { type: "text", key: "aufgenommen", label: "Aufgenommen durch", me: true, group: "officer", autocomplete: true },
        { type: "text", key: "zeuge", label: "Zeuge der Aussage", group: "officer", autocomplete: true },
      ],
    },
    {
      title: "Rechtsbeistand & Belehrung",
      description: "Anwalt, Kanzlei und wer wann belehrt hat.",
      fields: CAUTION_FIELDS,
      notice: SUSPECT_MIRANDA,
    },
    {
      title: "Aussage",
      description: "Was der Beschuldigte ausgesagt hat.",
      fields: [{ type: "list", key: "aussage", label: "Aussage", fallback: "Aussage des Beschuldigten", required: true }],
    },
    OTHER_SECTION,
  ],
  subject: (r) => r.filled("name"),
  pageTitle: suspectTitle,
  render: (r) =>
    titleComment(suspectTitle(r)) +
    "\n\n" +
    doc(
      banner(STATEMENT_BANNER),
      facts([
        ["AUSSAGE VON", r.text("name")],
        ["DATUM & UHRZEIT", uhr(r, "datum")],
        ["AUFGENOMMEN DURCH", r.text("aufgenommen")],
        ["ZEUGE DER AUSSAGE", r.text("zeuge")],
      ]),
      section(r, "1. Rechtsbeistand & Belehrung:", caution(r, SUSPECT_MIRANDA)),
      section(r, "2. Aussage:", bullets(r.lines("aussage"))),
      section(r, "3. Sonstige Informationen:", bullets(r.lines("sonstiges"))),
    ),
}

export const TEMPLATES: Record<TemplateId, Template> = {
  strafakte: criminalFile,
  sammelakte: collectiveFile,
  ermittlungsakte: investigationFile,
  bericht: report,
  geschwindigkeit: speeding,
  "aussage-zeuge": witnessStatement,
  "aussage-officer": officerStatement,
  "aussage-beschuldigter": suspectStatement,
}
