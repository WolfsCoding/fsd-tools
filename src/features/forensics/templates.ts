// The HP forensic analyses ("F"): ballistics, blood, edged weapons and toxicology.
// Built from the same fields as the Akten.

import { banner, bullets, cell, code, DEPARTMENT, doc, facts, formatLocalDateTime, rawTable, section, table, titleComment } from "@/features/case-files/markdown"
import { PERSON, tableRows, type Field, type Reader, type Section, type TableField, type Template } from "@/features/case-files/templates"
import { rowTraces } from "@/features/case-files/traces"
import type { Row, Values } from "@/features/case-files/types"
import { SubstancesInput } from "./substances-input"
import { foundRows, randomizeSubstances, SUBSTANCES_KEY, substanceOf, toxSections } from "./tox"

export type ForensicsTemplateId = "ballistik" | "blut" | "stichwaffen" | "tox"

/** Remark of new analyses; `{{DEPARTMENT}}` follows the settings. */
const EVIDENCE_ROOM = `Die analysierten Beweismittel wurden in die Asservatenkammer des ${DEPARTMENT} verbracht.`
/** The same remark as older analyses stored it, as a checked option. */
const LEGACY_EVIDENCE_ROOM =
  "Die analysierten Beweismittel wurden in die Asservatenkammer des El Burro Heights Police Department verbracht."

/** Case number and who handed it over carry over to attached analyses. */
export const INHERITED = ["fallnummer", "auftrag"]

/* Field groups and blocks every analysis shares. */

function headSection(): Section {
  return {
    title: "Allgemein",
    description: "Fallnummer, Zeitpunkt, Forensiker und Auftraggeber.",
    fields: [
      { type: "text", key: "fallnummer", label: "Akten-/Fallnummer", fallback: "XXXX", required: true },
      { type: "datetime", key: "datum", label: "Datum & Uhrzeit" },
      { type: "text", key: "forensiker", label: "Forensiker", me: true, group: "officer", autocomplete: true },
      { type: "text", key: "auftrag", label: "Übergeben/in Auftrag von", group: "officer", autocomplete: true },
    ],
  }
}

const BANNER =
  "https://s3.homestate.eu/user-content/public/76b975d4-9ef5-4f9a-80a3-caef2d54baef/5a578624-428c-453a-9aad-e49118820c20.webp"

/** The FSD banner and the case facts. */
function bannerHead(r: Reader, date = r.text("datum")) {
  return [
    banner(BANNER),
    facts([
      ["AKTENZEICHEN", r.text("fallnummer")],
      ["FORENSIKER", r.text("forensiker")],
      ["DATUM & UHRZEIT", date],
      ["ÜBERGEBEN/IN AUFTRAG VON", r.text("auftrag")],
    ]),
  ]
}

const REMARKS: Field[] = [{ type: "list", key: "bemerkungen", label: "Bemerkungen", fallback: "" }]

function remarksSection(description = "Auffälligkeiten und wo die Beweismittel hingekommen sind."): Section {
  return { title: "Bemerkungen", description, fields: REMARKS }
}

/**
 * The entered remarks. Analyses from before the evidence room was a remark of its own
 * stored it as a checked option, which still counts.
 */
function remarks(r: Reader) {
  const lines = r.lines("bemerkungen").filter(Boolean)
  const legacy = r.raw("verbracht")
  if (Array.isArray(legacy) && legacy.some((v) => v === LEGACY_EVIDENCE_ROOM) && !lines.includes(LEGACY_EVIDENCE_ROOM))
    lines.push(LEGACY_EVIDENCE_ROOM)
  return lines.length ? bullets(lines) : ""
}

/** New analyses start with the evidence room as their first remark; it can be edited or removed like any other. */
const INITIAL = { bemerkungen: [EVIDENCE_ROOM] }

/** Rows of a table numbered from 1, with the given cells; "" while none were entered. */
function numbered(r: Reader, key: string, cells: (row: Row) => string[], headers: string[]) {
  const rows = r.rows(key)
  if (!rows.length) return ""
  return table(
    ["#", ...headers],
    rows.map((row, i) => [String(i + 1), ...cells(row)]),
  )
}

/**
 * The sections numbered from `start`. Those with nothing entered (an empty body) are left
 * out, and the ones after them move up.
 */
function sections(r: Reader, parts: [title: string, body: string][], start = 1) {
  return parts.filter(([, body]) => body).map(([title, body], i) => section(r, `${start + i}. ${title}:`, body))
}

/** The case number alone names the case file in the list; the title adds it anyway. */
const noCaseSubject = () => ""

/* 1. Ballistics: weapons, gunshot residue, casings and projectiles. */

/** Where traces are typically found on a firearm. */
const GUN_SPOTS = ["Griff", "Abzug", "Schlitten", "Lauf", "Magazin", "Munition"]
/** Where traces are typically found on an edged or blunt weapon. */
const BLADE_SPOTS = ["Griff", "Klinge", "Schneide", "Spitze", "Schlagfläche"]

/** DNA and fingerprints, recorded together as one person's pair and rendered as the row's `dna` and `fa`. */
const PAIRS = { dna: "dna", fa: "fa" }

/** A suspect, picked from the DNA database: by name, DNA-ID or fingerprint ID. */
const SUSPECT = { group: "suspect", autocomplete: true, lookup: PERSON } as const
/** The suspect an item was taken from; the form shows just their name. */
const TAKEN_FROM = { ...SUSPECT, lookup: { ...PERSON, nameOnly: true } } as const

const WEAPONS: TableField = {
  type: "table",
  key: "waffen",
  label: "Waffen",
  addLabel: "Waffe",
  columns: [
    { key: "abgenommen", label: "Abgenommen von (BES)", fallback: "XXX", ...TAKEN_FROM },
    { key: "modell", label: "Modell", fallback: "XXX", autocomplete: true },
    // Left out of the document when unknown.
    { key: "seriennummer", label: "Seriennummer", fallback: "" },
    { key: "waffenId", label: "Waffen-ID", fallback: "XX" },
    { key: "spuren", label: "DNA & Fingerabdrücke", fallback: "Keine", traces: { kinds: PAIRS, spots: GUN_SPOTS } },
    { key: "schmauch", label: "Schmauchspuren", fallback: "XXX", suggestions: ["Positiv", "Negativ", "Keine"] },
    { key: "munition", label: "Munition", fallback: "XX", formerKey: "schuss" },
    { key: "huelsen", label: "Hülsen", fallback: "0", counter: true },
    { key: "projektile", label: "Projektile", fallback: "0", counter: true },
  ],
}

/** The IDs of the weapons entered above, for assigning casings to them. */
const weaponIds = (values: Values) =>
  tableRows(values.waffen)
    .map((w) => w.waffenId?.trim() ?? "")
    .filter(Boolean)

const POSITIVE = "Positiv"
const NEGATIVE = "Negativ"

const GUNSHOT_RESIDUE: TableField = {
  type: "table",
  key: "schmauch",
  label: "Schmauchspurentests",
  addLabel: "Test",
  columns: [
    { key: "name", label: "Name", fallback: "Name", ...SUSPECT, wide: true },
    {
      key: "ergebnis",
      label: "Ergebnis",
      fallback: "",
      initial: POSITIVE,
      choices: [
        { value: POSITIVE, className: "text-emerald-400" },
        { value: NEGATIVE, className: "text-red-400" },
      ],
    },
    // Read off the test, never rolled.
    { key: "staerke", label: "Stärke (%)", fallback: "XX" },
    { key: "konfidenz", label: "Konfidenz (%)", fallback: "XX" },
    { key: "anmerkung", label: "Anmerkungen", fallback: "---", wide: true },
  ],
}

/** A test as a table row: colored result, and strength and confidence only when positive. */
function residueRow(row: Row, i: number) {
  const percent = (v: string) => cell(v.replace(/\s*%$/, ""))
  const none = cell("---")
  const result =
    row.ergebnis === POSITIVE
      ? `<font color="#34D399">${code(POSITIVE)}</font>`
      : row.ergebnis === NEGATIVE
        ? `<font color="#F87171">${code(NEGATIVE)}</font>`
        : code("Positiv/Negativ")
  const positive = row.ergebnis === POSITIVE
  return [
    code(String(i + 1)),
    cell(row.name),
    result,
    positive ? percent(row.staerke) : none,
    positive ? percent(row.konfidenz) : none,
    cell(row.anmerkung),
  ]
}

const FINDINGS = ["Patronenhülsen", "Projektile", "Blutspuren", "DNA-Proben", "Schmauchspuren", "Fingerabdrücke", "Waffen"]

const atLeastOne = (count: string | undefined) => Number.parseInt(count ?? "", 10) > 0

/** What the entered data shows was found; blood traces and own entries are checked by hand. */
function foundKinds(r: Reader): Record<string, boolean> {
  const weapons = r.rows("waffen")
  const traces = tableRows(r.raw("waffen")).flatMap((w) => rowTraces(w, "spuren", PAIRS))
  // Casings and projectiles assigned to a weapon.
  const assigned = r.rows("huelsen").length > 0
  return {
    Waffen: weapons.length > 0,
    Schmauchspuren: r.rows("schmauch").length > 0 || weapons.some((w) => w.schmauch === POSITIVE),
    Patronenhülsen: assigned || weapons.some((w) => atLeastOne(w.huelsen)),
    Projektile: assigned || weapons.some((w) => atLeastOne(w.projektile)),
    // Traces are pairs: one with only a name counts as both.
    "DNA-Proben": traces.some((t) => t.dna.trim() || !t.fa.trim()),
    Fingerabdrücke: traces.some((t) => t.fa.trim() || !t.dna.trim()),
  }
}

/**
 * "`2` / `3`": the projectiles and casings, counted in two columns but written in one. Older
 * analyses have one quantity for both (e.g. "mehrere"), which is written once.
 */
function quantities(row: Row) {
  if (row.projektile === row.huelsen && !/^\d+$/.test(row.projektile)) return cell(row.projektile)
  return `${code(row.projektile)} / ${code(row.huelsen)}`
}

const ballisticsTitle ="📝 [F-BA] Ballistische Analyse - Schusswaffen & Schmauchspuren"

const ballistics: Template<ForensicsTemplateId> = {
  id: "ballistik",
  label: "Ballistische Analyse",
  emoji: "🔫",
  description: "Schusswaffen, Schmauchspurentests, Hülsen und Projektile.",
  standalone: true,
  sections: [
    headSection(),
    {
      title: "Gegenstand der Untersuchung",
      description: "Von wann der Fund ist und was darunter fällt; das meiste ergibt sich aus den Eingaben.",
      fields: [
        {
          type: "text",
          key: "fundDatum",
          label: "Fund vom",
          fallback: `xx.xx.${new Date().getFullYear()}`,
          today: true,
        },
        {
          type: "checks",
          key: "fundarten",
          label: "Darunter fallen",
          options: FINDINGS,
          custom: "Weitere hinzufügen…",
          auto: foundKinds,
          collapsible: true,
        },
      ],
    },
    { title: "Waffen", description: "Untersuchte Waffen mit Spuren, Munition und Ballistik.", fields: [WEAPONS] },
    {
      title: "Schmauchspuren",
      description: "Ergebnisse der Tests. Stärke und Konfidenz nur bei positiven, wie vom Test abgelesen.",
      fields: [GUNSHOT_RESIDUE],
    },
    {
      title: "Hülsen und Projektile",
      description: "Nur Hülsen/Projektile mit Waffen-ID und DNA-/FA-Spur. Anzahl der Projektile und Hülsen mit − und +.",
      fields: [
        {
          type: "table",
          key: "huelsen",
          label: "Hülsen und Projektile",
          addLabel: "Zuordnung",
          columns: [
            {
              key: "person",
              label: "Tatverdächtiger (DNA/Name)",
              fallback: "XXX",
              ...SUSPECT,
              wide: true,
            },
            { key: "waffenId", label: "Waffen-ID", fallback: "XXX", options: weaponIds },
            // Older analyses stored one quantity for both ("1", "2", "mehrere").
            { key: "projektile", label: "Projektile", fallback: "0", counter: true, formerKey: "menge" },
            { key: "huelsen", label: "Hülsen", fallback: "0", counter: true, formerKey: "menge" },
          ],
        },
      ],
    },
    remarksSection(
      "Z. B. Seriennummer passt nicht zum Halter (geklaut, Meldepflicht), wo Projektile gefunden wurden, welche Hülsen welcher Waffe zugewiesen wurden, an welchem Gegenstand (Tasernadel, Schlagstock, …) welche DNA festgestellt wurde.",
    ),
  ],
  initial: INITIAL,
  subject: () => "",
  caseSubject: noCaseSubject,
  pageTitle: () => ballisticsTitle,
  render: (r) => {
    const findings = r.checks("fundarten").filter((c) => c.checked).map((c) => c.label)
    return (
      titleComment(ballisticsTitle) +
      "\n\n" +
      doc(
        ...bannerHead(r),
        ...sections(r, [
          [
            "Gegenstand der Untersuchung",
            r.filled("fundDatum") || findings.length
              ? bullets([
                  `Der forensische Fund vom ${code(r.text("fundDatum"))}.`,
                  ...(findings.length ? [`Darunter fallen: ${findings.join(", ")}.`] : []),
                ])
              : "",
          ],
          [
            "Waffen",
            numbered(
              r,
              "waffen",
              (w) => [
                w.abgenommen,
                w.seriennummer ? `${w.modell} (${w.seriennummer})` : w.modell,
                w.waffenId,
                w.dna,
                w.fa,
                w.schmauch,
                w.munition,
                `${w.huelsen} Hülsen und ${w.projektile} Projektile`,
              ],
              [
                "Abgenommen von (BES)",
                "Modell (Seriennummer)",
                "Waffen-ID",
                "DNA von/wo",
                "Fingerabdrücke von/wo",
                "Schmauchspuren",
                "Munition",
                "Hülsen und Projektile",
              ],
            ),
          ],
          [
            "Schmauchspuren",
            r.rows("schmauch").length
              ? rawTable(
                  ["#", "Name", "Ergebnis", "Stärke (%)", "Konfidenz (%)", "Anmerkungen"],
                  r.rows("schmauch").map(residueRow),
                )
              : "",
          ],
          [
            "Hülsen und Projektile",
            r.rows("huelsen").length
              ? rawTable(
                  ["#", "Tatverdächtiger (DNA/Name)", "Waffen-ID", "Projektile / Hülsen"],
                  r.rows("huelsen").map((h, i) => [code(String(i + 1)), cell(h.person), cell(h.waffenId), quantities(h)]),
                )
              : "",
          ],
          ["Bemerkungen", remarks(r)],
        ]),
      )
    )
  },
}

/* 2. Blood. */

const BLOOD_GROUPS = ["A+", "A−", "B+", "B−", "AB+", "AB−", "0+", "0−"]
const bloodTitle = "📝 [F-FA] Forensische Analyse - Blut"

const blood: Template<ForensicsTemplateId> = {
  id: "blut",
  label: "Blutanalyse",
  emoji: "🩸",
  description: "Blutspuren mit Person, Blutgruppe, DNA und Fundort.",
  standalone: true,
  sections: [
    headSection(),
    {
      title: "Ergebnisse der Blutanalyse",
      description: "Eine Zeile je Blutspur.",
      fields: [
        {
          type: "table",
          key: "blut",
          label: "Blutspuren",
          addLabel: "Blutspur",
          columns: [
            {
              key: "person",
              label: "Person",
              fallback: "XXX",
              group: "person",
              autocomplete: true,
              lookup: { field: "name", fill: { dna: "dna" } },
            },
            { key: "blutgruppe", label: "Blutgruppe", fallback: "XXX", choices: BLOOD_GROUPS.map((value) => ({ value })) },
            { key: "dna", label: "DNA", fallback: "XXX", lookup: { field: "dna", fill: { name: "person" } } },
            { key: "fundort", label: "Fundort/Asservat", fallback: "XXX", wide: true },
          ],
        },
      ],
    },
    remarksSection(),
  ],
  initial: INITIAL,
  subject: () => "",
  caseSubject: noCaseSubject,
  pageTitle: () => bloodTitle,
  render: (r) =>
    titleComment(bloodTitle) +
    "\n\n" +
    doc(
      ...bannerHead(r),
      ...sections(r, [
        [
          "Ergebnisse der Blutanalyse",
          numbered(r, "blut", (b) => [b.person, b.blutgruppe, b.dna, b.fundort], ["Person", "Blutgruppe", "DNA", "Fundort/Asservat"]),
        ],
        ["Bemerkungen", remarks(r)],
      ]),
    ),
}

/* 3. Edged and blunt weapons. */

const edgedWeaponsTitle = "📝 [F-FA] Forensische Analyse - Hieb & Stichwaffen"

const edgedWeapons: Template<ForensicsTemplateId> = {
  id: "stichwaffen",
  label: "Hieb- & Stichwaffen",
  emoji: "🔪",
  description: "Waffen mit DNA, Fingerabdrücken und Blut.",
  standalone: true,
  sections: [
    headSection(),
    {
      title: "Untersuchte Waffen",
      description: "Eine Zeile je Waffe.",
      fields: [
        {
          type: "table",
          key: "tatwaffen",
          label: "Waffen",
          addLabel: "Waffe",
          columns: [
            { key: "abgenommen", label: "Abgenommen von", fallback: "XXX", ...TAKEN_FROM },
            {
              key: "tatwaffe",
              label: "Waffe",
              fallback: "XXX",
              autocomplete: true,
              suggestions: ["Messer", "Klappmesser", "Machete", "Schlagstock", "Baseballschläger", "Schlagring"],
            },
            { key: "spuren", label: "DNA & Fingerabdrücke", fallback: "Keine", traces: { kinds: PAIRS, spots: BLADE_SPOTS } },
            { key: "blut", label: "DNA (Blut)", fallback: "Keine", traces: { kinds: { dna: "blut" }, spots: BLADE_SPOTS } },
          ],
        },
      ],
    },
    remarksSection(),
  ],
  initial: INITIAL,
  subject: () => "",
  caseSubject: noCaseSubject,
  pageTitle: () => edgedWeaponsTitle,
  render: (r) =>
    titleComment(edgedWeaponsTitle) +
    "\n\n" +
    doc(
      ...bannerHead(r),
      ...sections(r, [
        [
          "Untersuchte Waffen",
          numbered(r, "tatwaffen", (w) => [w.abgenommen, w.tatwaffe, w.dna, w.fa, w.blut], [
            "Abgenommen von",
            "Waffe",
            "DNA",
            "Fingerabdrücke",
            "DNA (Blut)",
          ]),
        ],
        ["Bemerkungen", remarks(r)],
      ]),
    ),
}

/* 4. Toxicology: only the added substances, numbered in catalog order. */

const toxTitle = (r: Reader) => {
  const names = foundRows(r.raw("substanzen")).map((row) => substanceOf(row).name)
  return `📝 [F-TA] Toxikologische Analyse - ${r.filled("betreff") || names.join(", ") || "XXX"}`
}

const TOX_DATE = "DD.MM.YYYY - HH:mm"

/** The time as "02.10.2026 - 14:30 Uhr"; the editor's placeholder while none is entered. */
function toxDate(r: Reader) {
  const value = r.filled("datum")
  return `${value ? formatLocalDateTime(value, TOX_DATE) : `{{now:${TOX_DATE}}}`} Uhr`
}

const tox: Template<ForensicsTemplateId> = {
  id: "tox",
  label: "Toxikologische Analyse",
  emoji: "🧪",
  description: "Betäubungsmittel mit Reinheit, Streckmitteln und Stichprobe. Nur Substanzen mit Menge.",
  standalone: true,
  sections: [
    {
      ...headSection(),
      fields: [
        ...headSection().fields,
        {
          type: "text",
          key: "betreff",
          label: "Seitentitel-Zusatz",
          fallback: "",
          hint: "Leer: die Substanzen mit Menge.",
        },
      ],
    },
    {
      title: "Asservate",
      description: "Je Substanz Menge, Stichprobe, Einheit und Anmerkung; der Pfeil öffnet ihre Ergebnisse. Nur Substanzen mit Menge über 0 kommen in die Analyse.",
      fields: [
        {
          type: "custom",
          key: SUBSTANCES_KEY,
          label: "Substanzen",
          component: SubstancesInput,
          randomize: randomizeSubstances,
        },
      ],
    },
    remarksSection(),
  ],
  initial: INITIAL,
  subject: (r) =>
    foundRows(r.raw("substanzen"))
      .map((row) => substanceOf(row).name)
      .join(", "),
  caseSubject: noCaseSubject,
  pageTitle: toxTitle,
  render: (r) => {
    const { sections: results, next } = toxSections(r.raw("substanzen"), r)
    return (
      titleComment(toxTitle(r)) +
      "\n\n" +
      doc(...bannerHead(r, toxDate(r)), ...results, ...sections(r, [["Bemerkungen", remarks(r)]], next))
    )
  },
}

const ALL: ForensicsTemplateId[] = ["ballistik", "blut", "stichwaffen", "tox"]

export const FORENSICS_TEMPLATES: Record<ForensicsTemplateId, Template<ForensicsTemplateId>> = Object.fromEntries(
  [ballistics, blood, edgedWeapons, tox].map((t) => [t.id, { ...t, group: "Forensik", attachable: ALL }]),
) as Record<ForensicsTemplateId, Template<ForensicsTemplateId>>
