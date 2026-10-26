// The HP forensic analyses ("F"): ballistics, blood, edged weapons, toxicology and cyber forensics.
// Built from the same fields as the Akten.

import { banner, bullets, cell, code, DEPARTMENT, doc, facts, formatLocalDateTime, rawTable, section, table, titleComment } from "@/features/case-files/markdown"
import { headerImage, PERSON, tableRows, type Field, type Reader, type Section, type TableField, type Template } from "@/features/case-files/templates"
import { rowTraces, storeTraces } from "@/features/case-files/traces"
import type { Row, Values } from "@/features/case-files/types"
import { SubstancesInput } from "./substances-input"
import { foundRows, randomizeSubstances, SUBSTANCES_KEY, substanceOf, toxSections } from "./tox"

export type ForensicsTemplateId = "ballistik" | "blut" | "stichwaffen" | "tox" | "cyber"

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
      { type: "text", key: "fallnummer", label: "Akten-/Fallnummer", fallback: "N/A", required: true },
      { type: "datetime", key: "datum", label: "Datum & Uhrzeit" },
      { type: "text", key: "forensiker", label: "Forensiker", me: true, group: "officer", autocomplete: true },
      { type: "text", key: "auftrag", label: "Übergeben/in Auftrag von", group: "officer", autocomplete: true },
    ],
  }
}

const BANNER = headerImage("Forensik")

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

/** Placeholders of the case facts in the empty templates. */
const SAMPLE_HEAD = { fallnummer: "XXX", auftrag: "Rang Name / Department" }
/** One trace of an unknown person, written as "XXX" under both DNA and fingerprints. */
const SAMPLE_TRACES = storeTraces([{ id: "sample", dna: "", fa: "", name: "XXX", ort: "" }])

/** The empty template's values: the case facts, `extra` and the remarks, the evidence room last. */
function sample(extra: Values, remarks: string[] = []): Values {
  return { ...SAMPLE_HEAD, ...extra, bemerkungen: [...remarks, EVIDENCE_ROOM] }
}

/** Rows of a table (numbered `#1`, `#2`, … like every table), with the given cells; "" while none were entered. */
function numbered(r: Reader, key: string, cells: (row: Row) => string[], headers: string[]) {
  const rows = r.rows(key)
  if (!rows.length) return ""
  return table(headers, rows.map(cells))
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

const POSITIVE = "Positiv"
const NEGATIVE = "Negativ"

const RESIDUE_CHOICES = [
  { value: POSITIVE, className: "text-emerald-400" },
  { value: NEGATIVE, className: "text-red-400" },
]

const POSITIVE_CELL = `<font color="#34D399">${code(POSITIVE)}</font>`
const NEGATIVE_CELL = `<font color="#F87171">${code(NEGATIVE)}</font>`
/** Both results, each colored, so deleting one leaves the right one. */
const EITHER_RESULT = `${POSITIVE_CELL}/${NEGATIVE_CELL}`

/** A residue result as a table cell: green when positive, red when negative. */
function residueResult(value: string, fallback: string) {
  if (value === POSITIVE) return POSITIVE_CELL
  if (value === NEGATIVE) return NEGATIVE_CELL
  return value ? cell(value) : fallback
}

const WEAPONS: TableField = {
  type: "table",
  key: "waffen",
  label: "Waffen",
  addLabel: "Waffe",
  columns: [
    { key: "abgenommen", label: "Abgenommen von (BES)", fallback: "N/A", ...TAKEN_FROM },
    { key: "modell", label: "Modell", fallback: "N/A", autocomplete: true },
    // Left out of the document when unknown.
    { key: "seriennummer", label: "Seriennummer", fallback: "" },
    { key: "waffenId", label: "Waffen-ID", fallback: "N/A" },
    { key: "spuren", label: "DNA & Fingerabdrücke", fallback: "Keine", traces: { kinds: PAIRS, spots: GUN_SPOTS } },
    { key: "schmauch", label: "Schmauchspuren", fallback: "N/A", choices: [...RESIDUE_CHOICES, { value: "Keine" }] },
    { key: "munition", label: "Munition", fallback: "N/A", formerKey: "schuss" },
    { key: "huelsen", label: "Hülsen", fallback: "0", counter: true },
    { key: "projektile", label: "Projektile", fallback: "0", counter: true },
  ],
}

/** The IDs of the weapons entered above, for assigning casings to them. */
const weaponIds = (values: Values) =>
  tableRows(values.waffen)
    .map((w) => w.waffenId?.trim() ?? "")
    .filter(Boolean)

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
      choices: RESIDUE_CHOICES,
    },
    // Read off the test, never rolled.
    { key: "staerke", label: "Stärke (%)", fallback: "N/A" },
    { key: "konfidenz", label: "Konfidenz (%)", fallback: "N/A" },
    { key: "anmerkung", label: "Anmerkungen", fallback: "N/A", wide: true },
  ],
}

/** A test as a table row: colored result, and strength and confidence only when positive. */
function residueRow(row: Row) {
  const percent = (v: string) => cell(v.replace(/\s*%$/, ""))
  const none = cell("N/A")
  const positive = row.ergebnis === POSITIVE
  return [
    cell(row.name),
    residueResult(row.ergebnis, EITHER_RESULT),
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

const ballisticsTitle ="📝 [FAST-BA] Ballistische Analyse - Schusswaffen & Schmauchspuren"

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
              fallback: "N/A",
              ...SUSPECT,
              wide: true,
            },
            { key: "waffenId", label: "Waffen-ID", fallback: "N/A", options: weaponIds },
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
  sample: sample(
    {
      // The rest of the findings follow from the rows below.
      fundarten: ["Blutspuren"],
      // One weapon with positive, one with negative residue, like the tests below.
      waffen: [POSITIVE, NEGATIVE].map((schmauch) => ({
        abgenommen: "XXX",
        modell: "XXX",
        seriennummer: "XXX",
        waffenId: "XX",
        spuren: SAMPLE_TRACES,
        schmauch,
        munition: "xx Schuss + x geladen",
        huelsen: "X",
        projektile: "X",
      })),
      schmauch: [POSITIVE, POSITIVE, NEGATIVE, NEGATIVE].map((ergebnis) => ({
        name: "Name",
        ergebnis,
        staerke: "XX",
        konfidenz: "XX",
      })),
      huelsen: [1, 2, 3].map(() => ({ person: "XXX", waffenId: "XXX", projektile: "X", huelsen: "X" })),
    },
    [
      "z. B.: Seriennummer passt nicht zum Halter der Waffe = Geklaut = Meldepflicht",
      "z. B.: Projektile wurden in dem pinken SUV (`20 xxxxxx`) gefunden",
      "z. B.: Der beschlagnahmten Waffe mit der Waffen-ID `xxxxx` von `xxxx` wurden `xxxx` Patronenhülsen und `xxx` Projektile zugewiesen",
      "Die DNA `xxxx` wurde an einer Tasernadel/einem Schlagstock/etc. festgestellt.",
    ],
  ),
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
            r.rows("waffen").length
              ? rawTable(
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
                  r.rows("waffen").map((w) => [
                    cell(w.abgenommen),
                    cell(w.seriennummer ? `${w.modell} (${w.seriennummer})` : w.modell),
                    cell(w.waffenId),
                    cell(w.dna),
                    cell(w.fa),
                    residueResult(w.schmauch, cell("N/A")),
                    cell(w.munition),
                    cell(`${w.huelsen} Hülsen und ${w.projektile} Projektile`),
                  ]),
                )
              : "",
          ],
          [
            "Schmauchspuren",
            r.rows("schmauch").length
              ? rawTable(
                  ["Name", "Ergebnis", "Stärke (%)", "Konfidenz (%)", "Anmerkungen"],
                  r.rows("schmauch").map(residueRow),
                )
              : "",
          ],
          [
            "Hülsen und Projektile",
            r.rows("huelsen").length
              ? rawTable(
                  ["Tatverdächtiger (DNA/Name)", "Waffen-ID", "Projektile / Hülsen"],
                  r.rows("huelsen").map((h) => [cell(h.person), cell(h.waffenId), quantities(h)]),
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
const bloodTitle = "📝 [FAST-FA] Forensische Analyse - Blut"

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
              fallback: "N/A",
              group: "person",
              autocomplete: true,
              lookup: { field: "name", fill: { dna: "dna" } },
            },
            { key: "blutgruppe", label: "Blutgruppe", fallback: "N/A", choices: BLOOD_GROUPS.map((value) => ({ value })) },
            { key: "dna", label: "DNA", fallback: "N/A", lookup: { field: "dna", fill: { name: "person" } } },
            { key: "fundort", label: "Fundort/Asservat", fallback: "N/A", wide: true },
          ],
        },
      ],
    },
    remarksSection(),
  ],
  initial: INITIAL,
  sample: sample(
    { blut: [1, 2].map(() => ({ person: "XXX", blutgruppe: "XX", dna: "XXX", fundort: "XXX" })) },
    ["z. B.: Die Blutspur `X` wurde an/in `XXX` gesichert"],
  ),
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

const edgedWeaponsTitle = "📝 [FAST-FA] Forensische Analyse - Hieb & Stichwaffen"

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
            { key: "abgenommen", label: "Abgenommen von", fallback: "N/A", ...TAKEN_FROM },
            {
              key: "tatwaffe",
              label: "Waffe",
              fallback: "N/A",
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
  sample: sample(
    { tatwaffen: [1, 2].map(() => ({ abgenommen: "XXX", tatwaffe: "XXX", spuren: SAMPLE_TRACES, blut: SAMPLE_TRACES })) },
    ["z. B.: Die DNA `xxxx` wurde an der Klinge des Messers festgestellt."],
  ),
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
  return `📝 [FAST-TA] Toxikologische Analyse - ${r.filled("betreff") || names.join(", ") || "N/A"}`
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
  // The substances' placeholders come from `toxSections`.
  sample: sample({}),
  subject: (r) =>
    foundRows(r.raw("substanzen"))
      .map((row) => substanceOf(row).name)
      .join(", "),
  caseSubject: noCaseSubject,
  pageTitle: toxTitle,
  render: (r) => {
    const { sections: results, next } = toxSections(r.raw("substanzen"), r, r.blank)
    return (
      titleComment(toxTitle(r)) +
      "\n\n" +
      doc(...bannerHead(r, toxDate(r)), ...results, ...sections(r, [["Bemerkungen", remarks(r)]], next))
    )
  },
}

/* 5. Cyber forensics: one card and one numbered section per electronic item. */

const DEVICE_KINDS = [
  "Smartphone",
  "Laptop",
  "USB-Stick",
  "SD-Karte",
  "Festplatte",
  "Funkgerät",
  "Hacking Device",
  "Fahrzeugchip",
  "Sonstiges",
]
/** Where traces are typically found on an electronic device. */
const DEVICE_SPOTS = ["Display", "Gehäuse", "Rückseite", "Tasten", "Anschlüsse", "Akku"]

/** The parts of an item's section, in order, each starting with the column of its `heading`. */
const DEVICE_GROUPS = [
  "Dokumentation",
  "Äußerlicher Zustand und Spuren",
  "Analytische Untersuchung",
  "Forensische Datensicherung",
  "Komponentenuntersuchung",
] as const

/** Methods of an examination are typed in one cell, separated by semicolons. */
const METHODS = "methoden"

const DEVICES: TableField = {
  type: "table",
  key: "asservate",
  label: "Asservate",
  addLabel: "Asservat",
  layout: "cards",
  cardTitle: (row, i) =>
    `#${i + 1} ${[row.bezeichnung?.trim(), row.art?.trim() && `(${row.art.trim()})`].filter(Boolean).join(" ") || "Asservat"}`,
  columns: [
    // The overview; the rest is left out of the item's section where empty.
    { key: "bezeichnung", label: "Asservat", fallback: "N/A", wide: true },
    { key: "art", label: "Art", fallback: "N/A", suggestions: DEVICE_KINDS },
    { key: "anzahl", label: "Anzahl", fallback: "1", counter: true },
    { key: "abgenommen", label: "Abgenommen von", fallback: "N/A", group: "officer", autocomplete: true },
    { key: "bes", label: "BES", fallback: "N/A", ...TAKEN_FROM },
    { key: "besitzer", label: "Besitzer / Zuordnung", fallback: "", group: "person", autocomplete: true, heading: DEVICE_GROUPS[0] },
    { key: "fundort", label: "Fundort", fallback: "" },
    { key: "zustand", label: "Allgemeiner Zustand", fallback: "" },
    { key: "zweck", label: "Mögliche Nutzung / Zweck", fallback: "" },
    { key: "beschaedigungen", label: "Beschädigungen", fallback: "", heading: DEVICE_GROUPS[1] },
    { key: "manipulationen", label: "Manipulationen / Umbauten", fallback: "" },
    { key: "spuren", label: "DNA & Fingerabdrücke", fallback: "", traces: { kinds: PAIRS, spots: DEVICE_SPOTS } },
    { key: "material", label: "Material / Rückstände", fallback: "" },
    { key: "auffaelligkeiten", label: "Weitere Auffälligkeiten", fallback: "", wide: true },
    { key: METHODS, label: "Untersuchungsmethoden (mit ; trennen)", fallback: "", wide: true, heading: DEVICE_GROUPS[2] },
    { key: "identifizierung", label: "Identifizierung", fallback: "" },
    { key: "befund", label: "Spuren / Auffälligkeiten", fallback: "" },
    { key: "erkenntnisse", label: "Daten / technische Erkenntnisse", fallback: "", wide: true },
    { key: "untersuchungBemerkung", label: "Bemerkungen", fallback: "", wide: true },
    { key: "sicherungsmethode", label: "Sicherungsmethode", fallback: "", heading: DEVICE_GROUPS[3] },
    { key: "gesichert", label: "Gesicherte Daten", fallback: "" },
    { key: "sicherungZeit", label: "Datum / Uhrzeit", fallback: "" },
    { key: "sicherungDurch", label: "Durchgeführt durch", fallback: "", group: "officer", autocomplete: true },
    { key: "sicherungBesonderheiten", label: "Besonderheiten", fallback: "", wide: true },
    { key: "entnahmeGrund", label: "Grund der Untersuchung / Entnahme", fallback: "", wide: true, heading: DEVICE_GROUPS[4] },
    { key: "entnahmeMethode", label: "Untersuchungsmethode", fallback: "" },
    { key: "entnahmeZustand", label: "Zustand nach der Untersuchung", fallback: "" },
    { key: "entnahmeBemerkung", label: "Bemerkungen", fallback: "", wide: true },
  ],
}

/** The columns of each group, from its heading to the next. */
const GROUP_COLUMNS = DEVICE_GROUPS.map((title) => {
  const start = DEVICES.columns.findIndex((c) => c.heading === title)
  const end = DEVICES.columns.findIndex((c, i) => i > start && c.heading)
  return { title, columns: DEVICES.columns.slice(start, end < 0 ? undefined : end) }
})

/** Written in the item's section under other labels than in the form. */
const LINE_LABELS: Record<string, string> = {
  [METHODS]: "Untersuchungsmethoden",
  identifizierung: "→ Identifizierung",
  befund: "→ Spuren / Auffälligkeiten",
  erkenntnisse: "→ Daten / technische Erkenntnisse",
  untersuchungBemerkung: "→ Bemerkungen",
}

/** The stored rows the reader lists, with their traces. */
function enteredDevices(r: Reader) {
  return tableRows(r.raw("asservate")).filter((row) =>
    DEVICES.columns.some((c) => (c.traces ? rowTraces(row, c.key, c.traces.kinds).length > 0 : !!row[c.key]?.trim())),
  )
}

const methodsOf = (value: string) =>
  value
    .split(";")
    .map((m) => m.trim())
    .filter(Boolean)

/** The bullet points of an item's section, in groups; groups with nothing entered are left out. */
function deviceLines(r: Reader, row: Row, hasTraces: boolean) {
  const line = (label: string, text: string) => `> - <font color=${r.colors.heading}><b>${label}:</b></font>${text && ` ${text}`}`
  return GROUP_COLUMNS.flatMap(({ title, columns }) => {
    const lines = columns.flatMap((c) => {
      if (c.traces) return hasTraces ? [line("Fingerabdrücke", row.fa), line("DNA / sonstige Spuren", row.dna)] : []
      const value = row[c.key]?.trim()
      if (!value) return []
      if (c.key === METHODS) return [line(LINE_LABELS[METHODS], ""), ...methodsOf(value).map((m) => `>   - ${m}`)]
      return [line(LINE_LABELS[c.key] ?? c.label, value)]
    })
    // The kind leads the documentation.
    if (title === DEVICE_GROUPS[0] && row.art !== "N/A") lines.unshift(line("Art", code(row.art)))
    return lines.length ? [`> **${title}**\n${lines.join("\n")}`] : []
  }).join("\n>\n")
}

const cyberTitle = (r: Reader) => {
  const names = r.rows("asservate").map((a) => a.bezeichnung)
  return `📝 [FAST-CFA] Cyberforensische Analyse - ${r.filled("betreff") || names.join(", ") || "N/A"}`
}

/** "XXX" in every cell of an item, so the empty template shows each part. */
const SAMPLE_DEVICE: Row = {
  ...Object.fromEntries(DEVICES.columns.map((c) => [c.key, "XXX"])),
  bezeichnung: "[Bezeichnung / Gerätetyp]",
  art: "[Smartphone / Laptop / USB-Stick / …]",
  anzahl: "??",
  abgenommen: "RANG Name - Department",
  bes: "NAME",
  spuren: SAMPLE_TRACES,
  [METHODS]: "XXX (Untersuchungsmethode); XXX (Untersuchungsmethode)",
}

const cyber: Template<ForensicsTemplateId> = {
  id: "cyber",
  label: "Cyberforensische Analyse",
  emoji: "💻",
  description: "Elektronische Asservate mit Spuren, Untersuchung, Datensicherung und Komponenten.",
  standalone: true,
  sections: [
    {
      ...headSection(),
      fields: [
        ...headSection().fields,
        { type: "text", key: "betreff", label: "Seitentitel-Zusatz", fallback: "", hint: "Leer: die Asservate." },
      ],
    },
    {
      title: "Sachlage",
      description: "Wann, in welchem Rahmen und wo die Asservate sichergestellt wurden.",
      fields: [
        { type: "text", key: "fundDatum", label: "Sichergestellt am", fallback: "XX.XX.20XX", today: true },
        { type: "text", key: "anlass", label: "Im Rahmen von", fallback: "XXX", hint: "Z. B. einer Hausdurchsuchung." },
        { type: "text", key: "ort", label: "Am bzw. im Bereich", fallback: "XXX" },
        { type: "list", key: "sachverhalt", label: "Sachverhalt", fallback: "", hint: "Datum, Grund, Fundort und was gefunden wurde." },
      ],
    },
    {
      title: "Asservate",
      description: "Je Asservat eine Karte und ein eigener Abschnitt in der Analyse. Leere Angaben werden nicht geschrieben.",
      fields: [DEVICES],
    },
    remarksSection(),
  ],
  initial: INITIAL,
  sample: sample({
    asservate: [SAMPLE_DEVICE, SAMPLE_DEVICE],
    sachverhalt: ["Fließtext mit Datum, der Grund, Ort des Fundes und was gefunden wurde"],
  }),
  subject: (r) =>
    r
      .rows("asservate")
      .map((a) => a.bezeichnung)
      .join(", "),
  caseSubject: noCaseSubject,
  pageTitle: cyberTitle,
  render: (r) => {
    const items = r.rows("asservate")
    const raw = enteredDevices(r)
    const notes = r.lines("sachverhalt")
    const situation = items.length || r.filled("fundDatum") || r.filled("anlass") || r.filled("ort") || notes.length
    const overview = [
      `> Am ${code(r.text("fundDatum"))} wurden im Rahmen von ${code(r.text("anlass"))} am bzw. im Bereich ${code(r.text("ort"))} elektronische Asservate sichergestellt und zur forensischen Untersuchung übergeben.`,
      notes.length ? `> [!CAUTION]\n${notes.map((n) => `> ${n}`).join("\n>\n")}` : "",
      items.length
        ? table(
            ["Asservat", "Anzahl", "Art", "Abgenommen von", "BES"],
            items.map((a) => [a.bezeichnung, a.anzahl, a.art, a.abgenommen, a.bes]),
          )
        : "",
    ]
      .filter(Boolean)
      .join("\n\n")

    return (
      titleComment(cyberTitle(r)) +
      "\n\n" +
      doc(
        ...bannerHead(r),
        ...(situation ? [section(r, "1. Übersicht der Asservate:", overview)] : []),
        ...items.map((a, i) =>
          section(
            r,
            `#${i + 1} ${a.bezeichnung}:`,
            deviceLines(r, a, rowTraces(raw[i] ?? {}, "spuren", PAIRS).length > 0) || "> Keine weiteren Angaben.",
          ),
        ),
        ...sections(r, [["Bemerkungen", remarks(r)]], situation ? 2 : 1),
      )
    )
  },
}

const ALL: ForensicsTemplateId[] = ["ballistik", "blut", "stichwaffen", "tox", "cyber"]

export const FORENSICS_TEMPLATES: Record<ForensicsTemplateId, Template<ForensicsTemplateId>> = Object.fromEntries(
  [ballistics, blood, edgedWeapons, tox, cyber].map((t) => [t.id, { ...t, group: "Forensik", attachable: ALL }]),
) as Record<ForensicsTemplateId, Template<ForensicsTemplateId>>
