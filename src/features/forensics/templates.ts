// The HP forensic analyses ("F"): ballistics, blood, edged weapons, toxicology, cyber forensics and other items.
// Built from the same fields as the Akten. Every analysis has the same layout (see `analysis`): the banner and
// case facts, "Gegenstand der Untersuchung", its own steps, then "Bemerkungen".

import { banner, bullets, cell, code, DEPARTMENT, doc, facts, formatLocalDateTime, rawTable, section, table, titleComment } from "@/features/case-files/markdown"
import {
  headerImage,
  PERSON,
  tableRows,
  type Column,
  type Field,
  type Reader,
  type Section,
  type TableField,
  type Template,
} from "@/features/case-files/templates"
import { rowTraces, storeTraces } from "@/features/case-files/traces"
import type { Row, Value, Values } from "@/features/case-files/types"
import type { SnippetsAtom } from "@/features/case-files/snippets"
import { sameText } from "@/lib/text"
import { SUBSTANCES } from "./substances"
import { SubstancesInput } from "./substances-input"
import { cyberStepsAtom, itemStepsAtom } from "./step-templates"
import { foundRows, randomizeSubstances, SUBSTANCES_KEY, substanceOf, toxParts } from "./tox"

export type ForensicsTemplateId = "ballistik" | "blut" | "stichwaffen" | "tox" | "cyber" | "gegenstand"

/** Remark of new analyses; `{{DEPARTMENT}}` follows the settings. */
const EVIDENCE_ROOM = `Die analysierten Beweismittel wurden in die Asservatenkammer des ${DEPARTMENT} verbracht.`
/** The same remark as older analyses stored it, as a checked option. */
const LEGACY_EVIDENCE_ROOM =
  "Die analysierten Beweismittel wurden in die Asservatenkammer des El Burro Heights Police Department verbracht."

/** Case number and who handed it over carry over to attached analyses. */
export const INHERITED = ["fallnummer", "auftrag"]

/* The layout every analysis shares. */

/** A numbered step of the document (`1.`), followed by its items (`#1`, `#2`, …); left out while its body is empty. */
interface Part {
  title: string
  body: string
  items?: { title: string; body: string }[]
}

/** What an analysis adds to the shared layout. */
interface Analysis {
  id: ForensicsTemplateId
  label: string
  emoji: string
  description: string
  /** The page title, e.g. "📝 [FAST-TA] Toxikologische Analyse". */
  title: string
  /**
   * What the title names after a dash, e.g. the substances. With it, the title can be
   * replaced by a "Seitentitel-Zusatz"; `namesHint` says what it's left to.
   */
  names?: (r: Reader) => string[]
  namesHint?: string
  /** What "Darunter fallen" offers, and which of them follow from the entries. */
  findings: string[]
  found: (r: Reader) => Record<string, boolean>
  /** The sections between "Gegenstand der Untersuchung" and "Bemerkungen". */
  sections: Section[]
  /** The description of "Bemerkungen". */
  remarksHint?: string
  /** The empty template's own values and example remarks (the evidence room follows). */
  sample: Values
  sampleRemarks?: string[]
  /** The time in the case facts; the entered one by default. */
  date?: (r: Reader) => string
  /** The own steps, after "Gegenstand der Untersuchung". */
  parts: (r: Reader) => Part[]
}

function headSection(namesHint?: string): Section {
  return {
    title: "Allgemein",
    description: "Fallnummer, Zeitpunkt, Forensiker und Auftraggeber.",
    fields: [
      { type: "text", key: "fallnummer", label: "Akten-/Fallnummer", fallback: "N/A", required: true },
      { type: "datetime", key: "datum", label: "Datum & Uhrzeit" },
      { type: "text", key: "forensiker", label: "Forensiker", me: true, group: "officer", autocomplete: true },
      { type: "text", key: "auftrag", label: "Übergeben/in Auftrag von", group: "officer", autocomplete: true },
      ...(namesHint
        ? [{ type: "text", key: "betreff", label: "Seitentitel-Zusatz", fallback: "", hint: `Leer: ${namesHint}.` } as const]
        : []),
    ],
  }
}

function subjectSection(findings: string[], found: Analysis["found"]): Section {
  return {
    title: "Gegenstand der Untersuchung",
    description: "Wann und wo der Fund sichergestellt wurde und was darunter fällt. Was sich aus den Eingaben ergibt, ist schon angehakt.",
    fields: [
      { type: "text", key: "fundDatum", label: "Fund vom", fallback: `xx.xx.${new Date().getFullYear()}`, today: true },
      { type: "text", key: "anlass", label: "Im Rahmen von", fallback: "", hint: "Optional, z. B. einer Hausdurchsuchung." },
      { type: "text", key: "ort", label: "Fundort", fallback: "", hint: "Optional." },
      {
        type: "checks",
        key: "fundarten",
        label: "Darunter fallen",
        options: findings,
        custom: "Weitere hinzufügen…",
        auto: found,
        collapsible: true,
      },
    ],
  }
}

/** "Gegenstand der Untersuchung": the find and what it covers; the empty template shows each. */
function subjectPart(r: Reader): Part {
  const placeholder = (key: string) => r.filled(key) || (r.blank ? "XXX" : "")
  const occasion = placeholder("anlass")
  const place = placeholder("ort")
  const findings = r
    .checks("fundarten")
    .filter((c) => c.checked)
    .map((c) => c.label)
  const entered = r.blank || r.filled("fundDatum") || occasion || place || findings.length
  const find = [
    `Der forensische Fund vom ${code(r.text("fundDatum"))}`,
    occasion && `im Rahmen von ${code(occasion)}`,
    place && `am bzw. im Bereich ${code(place)}`,
  ]
  return {
    title: "Gegenstand der Untersuchung",
    body: entered
      ? bullets([
          `${find.filter(Boolean).join(" ")}.`,
          ...(findings.length ? [`Darunter fallen: ${findings.join(", ")}.`] : []),
        ])
      : "",
  }
}

const REMARKS: Field[] = [{ type: "list", key: "bemerkungen", label: "Bemerkungen", fallback: "" }]

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

const BANNER = headerImage("Forensik")

/** Placeholders of the case facts in the empty templates. */
const SAMPLE_HEAD = { fallnummer: "XXX", auftrag: "Rang Name / Department" }
/** One trace of an unknown person, written as "XXX" under both DNA and fingerprints. */
const SAMPLE_TRACES = storeTraces([{ id: "sample", dna: "", fa: "", name: "XXX", ort: "" }])

/** The steps numbered `1.`, `2.`, … with their items `#1`, `#2`, …; empty ones are left out and the next move up. */
function steps(r: Reader, parts: Part[]) {
  return parts
    .filter((p) => p.body)
    .flatMap((p, i) => [
      section(r, `${i + 1}. ${p.title}:`, p.body),
      ...(p.items ?? []).map((item, j) => section(r, `#${j + 1} ${item.title}:`, item.body)),
    ])
}

/** The analysis as a template: its own sections and steps within the shared layout. */
function analysis(a: Analysis): Template<ForensicsTemplateId> {
  const pageTitle = (r: Reader) =>
    a.names ? `${a.title} - ${r.filled("betreff") || a.names(r).join(", ") || "N/A"}` : a.title
  return {
    id: a.id,
    label: a.label,
    emoji: a.emoji,
    description: a.description,
    standalone: true,
    sections: [
      headSection(a.names && a.namesHint),
      subjectSection(a.findings, a.found),
      ...a.sections,
      {
        title: "Bemerkungen",
        description: a.remarksHint ?? "Auffälligkeiten und wo die Beweismittel hingekommen sind.",
        fields: REMARKS,
      },
    ],
    // New analyses start with the evidence room as their first remark; it can be edited or removed like any other.
    initial: { bemerkungen: [EVIDENCE_ROOM] },
    sample: { ...SAMPLE_HEAD, ...a.sample, bemerkungen: [...(a.sampleRemarks ?? []), EVIDENCE_ROOM] },
    subject: (r) => a.names?.(r).join(", ") ?? "",
    // The case number alone names the case file in the list; the title adds it anyway.
    caseSubject: () => "",
    pageTitle,
    render: (r) =>
      titleComment(pageTitle(r)) +
      "\n\n" +
      doc(
        banner(BANNER),
        facts([
          ["AKTENZEICHEN", r.text("fallnummer")],
          ["FORENSIKER", r.text("forensiker")],
          ["DATUM & UHRZEIT", a.date?.(r) ?? r.text("datum")],
          ["ÜBERGEBEN/IN AUFTRAG VON", r.text("auftrag")],
        ]),
        ...steps(r, [subjectPart(r), ...a.parts(r), { title: "Bemerkungen", body: remarks(r) }]),
      ),
  }
}

/** The rows as a table under `headers`; "" while none were entered. */
function rowsTable(rows: Row[], headers: string[], cells: (row: Row) => string[]) {
  return rows.length ? rawTable(headers, rows.map(cells)) : ""
}

/* Traces. */

/** DNA and fingerprints, recorded together as one person's pair and rendered as the row's `dna` and `fa`. */
const PAIRS = { dna: "dna", fa: "fa" }

/** The DNA and fingerprints of an item, at the given spots. */
const tracesColumn = (spots: string[], fallback = ""): Column => ({
  key: "spuren",
  label: "DNA & Fingerabdrücke",
  fallback,
  traces: { kinds: PAIRS, spots },
})

/** Whether the rows have DNA or fingerprints under `key`; traces are pairs, one with only a name counts as both. */
function traceFindings(rows: Row[], key = "spuren") {
  const traces = rows.flatMap((row) => rowTraces(row, key, PAIRS))
  return {
    "DNA-Proben": traces.some((t) => t.dna.trim() || !t.fa.trim()),
    Fingerabdrücke: traces.some((t) => t.fa.trim() || !t.dna.trim()),
  }
}

/** A suspect, picked from the DNA database: by name, DNA-ID or fingerprint ID. */
const SUSPECT = { group: "suspect", autocomplete: true, lookup: PERSON } as const
/** The suspect an item was taken from; the form shows just their name. */
const TAKEN_FROM = { ...SUSPECT, lookup: { ...PERSON, nameOnly: true } } as const

/* 1. Ballistics: weapons, gunshot residue, casings and projectiles. */

/** Where traces are typically found on a firearm. */
const GUN_SPOTS = ["Griff", "Abzug", "Schlitten", "Lauf", "Magazin", "Munition"]

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
    tracesColumn(GUN_SPOTS, "Keine"),
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
    { key: "ergebnis", label: "Ergebnis", fallback: "", initial: POSITIVE, choices: RESIDUE_CHOICES },
    // Read off the test, never rolled.
    { key: "staerke", label: "Stärke (%)", fallback: "N/A" },
    { key: "konfidenz", label: "Konfidenz (%)", fallback: "N/A" },
    { key: "anmerkung", label: "Anmerkungen", fallback: "N/A", wide: true },
  ],
}

const CASINGS: TableField = {
  type: "table",
  key: "huelsen",
  label: "Hülsen und Projektile",
  addLabel: "Zuordnung",
  columns: [
    { key: "person", label: "Tatverdächtiger (DNA/Name)", fallback: "N/A", ...SUSPECT, wide: true },
    { key: "waffenId", label: "Waffen-ID", fallback: "N/A", options: weaponIds },
    // Older analyses stored one quantity for both ("1", "2", "mehrere").
    { key: "projektile", label: "Projektile", fallback: "0", counter: true, formerKey: "menge" },
    { key: "huelsen", label: "Hülsen", fallback: "0", counter: true, formerKey: "menge" },
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

const atLeastOne = (count: string | undefined) => Number.parseInt(count ?? "", 10) > 0

/**
 * "`2` / `3`": the projectiles and casings, counted in two columns but written in one. Older
 * analyses have one quantity for both (e.g. "mehrere"), which is written once.
 */
function quantities(row: Row) {
  if (row.projektile === row.huelsen && !/^\d+$/.test(row.projektile)) return cell(row.projektile)
  return `${code(row.projektile)} / ${code(row.huelsen)}`
}

const ballistics = analysis({
  id: "ballistik",
  label: "Ballistische Analyse",
  emoji: "🔫",
  description: "Schusswaffen, Schmauchspurentests, Hülsen und Projektile.",
  title: "📝 [FAST-BA] Ballistische Analyse - Schusswaffen & Schmauchspuren",
  findings: ["Patronenhülsen", "Projektile", "Blutspuren", "DNA-Proben", "Schmauchspuren", "Fingerabdrücke", "Waffen"],
  // Blood traces and own entries are checked by hand.
  found: (r) => {
    const weapons = r.rows("waffen")
    // Casings and projectiles assigned to a weapon.
    const assigned = r.rows("huelsen").length > 0
    return {
      Waffen: weapons.length > 0,
      Schmauchspuren: r.rows("schmauch").length > 0 || weapons.some((w) => w.schmauch === POSITIVE),
      Patronenhülsen: assigned || weapons.some((w) => atLeastOne(w.huelsen)),
      Projektile: assigned || weapons.some((w) => atLeastOne(w.projektile)),
      ...traceFindings(tableRows(r.raw("waffen"))),
    }
  },
  sections: [
    { title: "Waffen", description: "Untersuchte Waffen mit Spuren, Munition und Ballistik.", fields: [WEAPONS] },
    {
      title: "Schmauchspuren",
      description: "Ergebnisse der Tests. Stärke und Konfidenz nur bei positiven, wie vom Test abgelesen.",
      fields: [GUNSHOT_RESIDUE],
    },
    {
      title: "Hülsen und Projektile",
      description: "Nur Hülsen/Projektile mit Waffen-ID und DNA-/FA-Spur. Anzahl der Projektile und Hülsen mit − und +.",
      fields: [CASINGS],
    },
  ],
  remarksHint:
    "Z. B. Seriennummer passt nicht zum Halter (geklaut, Meldepflicht), wo Projektile gefunden wurden, welche Hülsen welcher Waffe zugewiesen wurden, an welchem Gegenstand (Tasernadel, Schlagstock, …) welche DNA festgestellt wurde.",
  sample: {
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
  sampleRemarks: [
    "z. B.: Seriennummer passt nicht zum Halter der Waffe = Geklaut = Meldepflicht",
    "z. B.: Projektile wurden in dem pinken SUV (`20 xxxxxx`) gefunden",
    "z. B.: Der beschlagnahmten Waffe mit der Waffen-ID `xxxxx` von `xxxx` wurden `xxxx` Patronenhülsen und `xxx` Projektile zugewiesen",
    "Die DNA `xxxx` wurde an einer Tasernadel/einem Schlagstock/etc. festgestellt.",
  ],
  parts: (r) => [
    {
      title: "Waffen",
      body: rowsTable(
        r.rows("waffen"),
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
        (w) => [
          cell(w.abgenommen),
          cell(w.seriennummer ? `${w.modell} (${w.seriennummer})` : w.modell),
          cell(w.waffenId),
          cell(w.dna),
          cell(w.fa),
          residueResult(w.schmauch, cell("N/A")),
          cell(w.munition),
          cell(`${w.huelsen} Hülsen und ${w.projektile} Projektile`),
        ],
      ),
    },
    {
      title: "Schmauchspuren",
      body: rowsTable(r.rows("schmauch"), ["Name", "Ergebnis", "Stärke (%)", "Konfidenz (%)", "Anmerkungen"], residueRow),
    },
    {
      title: "Hülsen und Projektile",
      body: rowsTable(r.rows("huelsen"), ["Tatverdächtiger (DNA/Name)", "Waffen-ID", "Projektile / Hülsen"], (h) => [
        cell(h.person),
        cell(h.waffenId),
        quantities(h),
      ]),
    },
  ],
})

/* 2. Blood. */

const BLOOD_GROUPS = ["A+", "A−", "B+", "B−", "AB+", "AB−", "0+", "0−"]

const blood = analysis({
  id: "blut",
  label: "Blutanalyse",
  emoji: "🩸",
  description: "Blutspuren mit Person, Blutgruppe, DNA und Fundort.",
  title: "📝 [FAST-FA] Forensische Analyse - Blut",
  findings: ["Blutspuren", "DNA-Proben"],
  found: (r) => {
    const rows = r.rows("blut")
    return { Blutspuren: rows.length > 0, "DNA-Proben": tableRows(r.raw("blut")).some((b) => b.dna?.trim()) }
  },
  sections: [
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
  ],
  sample: { blut: [1, 2].map(() => ({ person: "XXX", blutgruppe: "XX", dna: "XXX", fundort: "XXX" })) },
  sampleRemarks: ["z. B.: Die Blutspur `X` wurde an/in `XXX` gesichert"],
  parts: (r) => [
    {
      title: "Ergebnisse der Blutanalyse",
      body: rowsTable(r.rows("blut"), ["Person", "Blutgruppe", "DNA", "Fundort/Asservat"], (b) =>
        [b.person, b.blutgruppe, b.dna, b.fundort].map(cell),
      ),
    },
  ],
})

/* 3. Edged and blunt weapons. */

/** Where traces are typically found on an edged or blunt weapon. */
const BLADE_SPOTS = ["Griff", "Klinge", "Schneide", "Spitze", "Schlagfläche"]

const edgedWeapons = analysis({
  id: "stichwaffen",
  label: "Hieb- & Stichwaffen",
  emoji: "🔪",
  description: "Waffen mit DNA, Fingerabdrücken und Blut.",
  title: "📝 [FAST-FA] Forensische Analyse - Hieb & Stichwaffen",
  findings: ["Hieb- & Stichwaffen", "DNA-Proben", "Fingerabdrücke", "Blutspuren"],
  found: (r) => {
    const rows = tableRows(r.raw("tatwaffen"))
    return {
      "Hieb- & Stichwaffen": r.rows("tatwaffen").length > 0,
      ...traceFindings(rows),
      Blutspuren: rows.some((w) => rowTraces(w, "blut", { dna: "blut" }).length > 0),
    }
  },
  sections: [
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
            tracesColumn(BLADE_SPOTS, "Keine"),
            { key: "blut", label: "DNA (Blut)", fallback: "Keine", traces: { kinds: { dna: "blut" }, spots: BLADE_SPOTS } },
          ],
        },
      ],
    },
  ],
  sample: { tatwaffen: [1, 2].map(() => ({ abgenommen: "XXX", tatwaffe: "XXX", spuren: SAMPLE_TRACES, blut: SAMPLE_TRACES })) },
  sampleRemarks: ["z. B.: Die DNA `xxxx` wurde an der Klinge des Messers festgestellt."],
  parts: (r) => [
    {
      title: "Untersuchte Waffen",
      body: rowsTable(r.rows("tatwaffen"), ["Abgenommen von", "Waffe", "DNA", "Fingerabdrücke", "DNA (Blut)"], (w) =>
        [w.abgenommen, w.tatwaffe, w.dna, w.fa, w.blut].map(cell),
      ),
    },
  ],
})

/* 4. Toxicology: only the added substances, in the order they were added. */

const TOX_DATE = "DD.MM.YYYY - HH:mm"

const substanceNames = (value: Value | undefined) => foundRows(value).map((row) => substanceOf(row).name)

const tox = analysis({
  id: "tox",
  label: "Toxikologische Analyse",
  emoji: "🧪",
  description: "Betäubungsmittel mit Reinheit, Streckmitteln und Stichprobe. Nur Substanzen mit Menge.",
  title: "📝 [FAST-TA] Toxikologische Analyse",
  names: (r) => substanceNames(r.raw(SUBSTANCES_KEY)),
  namesHint: "die Substanzen mit Menge",
  findings: SUBSTANCES.map((s) => s.name),
  found: (r) => {
    const found = new Set(substanceNames(r.raw(SUBSTANCES_KEY)))
    return Object.fromEntries(SUBSTANCES.map((s) => [s.name, found.has(s.name)]))
  },
  sections: [
    {
      title: "Asservate",
      description:
        "Je Substanz Menge, Stichprobe, Einheit und Anmerkung; der Pfeil öffnet ihre Ergebnisse. Nur Substanzen mit Menge über 0 kommen in die Analyse.",
      fields: [
        { type: "custom", key: SUBSTANCES_KEY, label: "Substanzen", component: SubstancesInput, randomize: randomizeSubstances },
      ],
    },
  ],
  // The substances' placeholders come from `toxParts`.
  sample: {},
  // "02.10.2026 - 14:30 Uhr"; the editor's placeholder while none is entered.
  date: (r) => {
    const value = r.filled("datum")
    return `${value ? formatLocalDateTime(value, TOX_DATE) : `{{now:${TOX_DATE}}}`} Uhr`
  },
  parts: (r) => {
    const { overview, items } = toxParts(r.raw(SUBSTANCES_KEY), r.colors, r.blank)
    return [{ title: "Übersicht der Asservate", body: overview, items }]
  },
})

/* 5./6. Cyber forensics and other items: the items in a table, then the examination step by step. */

/** The items of the analysis, one row each, with the traces at typical spots. */
function itemsTable(spots: string[]): TableField {
  return {
    type: "table",
    key: "asservate",
    label: "Asservate",
    addLabel: "Asservat",
    columns: [
      { key: "bezeichnung", label: "Asservat", fallback: "N/A", wide: true },
      { key: "art", label: "Art", fallback: "N/A", autocomplete: true },
      { key: "anzahl", label: "Anzahl", fallback: "1", counter: true },
      { key: "abgenommen", label: "Sichergestellt von", fallback: "N/A", group: "officer", autocomplete: true },
      { key: "bes", label: "BES", fallback: "N/A", ...TAKEN_FROM },
      tracesColumn(spots, "Keine"),
    ],
  }
}

/** The item names entered above, for assigning the steps to them. */
const itemNames = (values: Values) =>
  tableRows(values.asservate)
    .map((a) => a.bezeichnung?.trim() ?? "")
    .filter(Boolean)

/** The examination, one step per row in the order it was done; a template fills in the examination and its result. */
function stepsTable(templates: SnippetsAtom): TableField {
  return {
    type: "table",
    key: "schritte",
    label: "Untersuchungsschritte",
    addLabel: "Schritt",
    columns: [
      { key: "asservat", label: "Asservat", fallback: "", options: itemNames, carry: true },
      { key: "untersuchung", label: "Untersuchung", fallback: "N/A", autocomplete: true },
      { key: "ergebnis", label: "Ergebnis", fallback: "N/A", wide: true, multiline: true },
    ],
    templates: { atom: templates, fill: (t) => ({ untersuchung: t.title, ergebnis: t.text }) },
  }
}

/** The overview of the items. */
function itemsPart(r: Reader): Part {
  const rows = r.rows("asservate")
  return {
    title: "Übersicht der Asservate",
    body: rows.length
      ? table(
          ["Asservat", "Art", "Anzahl", "Sichergestellt von", "BES", "DNA", "Fingerabdrücke"],
          rows.map((a) => [a.bezeichnung, a.art, a.anzahl, a.abgenommen, a.bes, a.dna || "Keine", a.fa || "Keine"]),
        )
      : "",
  }
}

/**
 * The steps, under the item they examined in the order of the items; steps of an item not in
 * the overview follow under its name. Each step is numbered, the lines of its result are sub-points.
 */
function stepsPart(r: Reader): Part {
  const names = r.rows("asservate").map((a) => a.bezeichnung)
  const groups = new Map<string, { order: number; rows: Row[] }>()
  for (const s of r.rows("schritte")) {
    const i = names.findIndex((n) => sameText(n, s.asservat))
    const title = i >= 0 ? `#${i + 1} ${names[i]}` : s.asservat.trim() || "Ohne Asservat"
    const group = groups.get(title) ?? { order: i >= 0 ? i : names.length, rows: [] }
    groups.set(title, { ...group, rows: [...group.rows, s] })
  }
  const ordered = [...groups].sort(([, a], [, b]) => a.order - b.order)
  const line = (label: string, text: string) => `> - <font color=${r.colors.heading}><b>${label}:</b></font>${text && ` ${text}`}`
  const body = ordered.map(([title, { rows }]) => {
    const lines = rows.flatMap((s, j) => {
      const result = s.ergebnis
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
      const label = `${j + 1}. ${s.untersuchung}`
      return result.length > 1 ? [line(label, ""), ...result.map((l) => `>   - ${l}`)] : [line(label, result[0] ?? "")]
    })
    return `> **${title}**\n${lines.join("\n")}`
  })
  return { title: "Untersuchung", body: body.join("\n>\n") }
}

/** An analysis of items: what was examined, then the examination step by step. */
function stepAnalysis(a: Pick<Analysis, "id" | "label" | "emoji" | "description" | "title"> & { spots: string[]; templates: SnippetsAtom }) {
  return analysis({
    ...a,
    names: (r) => r.rows("asservate").map((row) => row.bezeichnung),
    namesHint: "die Asservate",
    findings: ["DNA-Proben", "Fingerabdrücke"],
    found: (r) => traceFindings(tableRows(r.raw("asservate"))),
    sections: [
      {
        title: "Asservate",
        description: "Schritt 1: Jedes untersuchte Asservat in eine Zeile.",
        fields: [itemsTable(a.spots)],
      },
      {
        title: "Untersuchung",
        description:
          "Schritt 2: Jede Untersuchung in eine Zeile, in der Reihenfolge, in der sie gemacht wurde. „Aus Vorlage“ fügt einen Schritt mit vorbereitetem Ergebnis ein.",
        fields: [stepsTable(a.templates)],
      },
    ],
    sample: {
      asservate: [1, 2].map(() => ({
        bezeichnung: "[Bezeichnung]",
        art: "XXX",
        anzahl: "??",
        abgenommen: "RANG Name - Department",
        bes: "NAME",
        spuren: SAMPLE_TRACES,
      })),
      schritte: [1, 2].map(() => ({ asservat: "[Bezeichnung]", untersuchung: "[Untersuchung]", ergebnis: "XXX" })),
    },
    parts: (r) => [itemsPart(r), stepsPart(r)],
  })
}

const cyber = stepAnalysis({
  id: "cyber",
  label: "Cyberforensische Analyse",
  emoji: "💻",
  description: "Elektronische Geräte: die Asservate, dann die Untersuchung Schritt für Schritt.",
  title: "📝 [FAST-CFA] Cyberforensische Analyse",
  spots: ["Display", "Gehäuse", "Rückseite", "Tasten", "Anschlüsse", "Akku"],
  templates: cyberStepsAtom,
})

const items = stepAnalysis({
  id: "gegenstand",
  label: "Forensische Analyse (Gegenstand)",
  emoji: "📦",
  description: "Beliebige Gegenstände: die Asservate, dann die Untersuchung Schritt für Schritt.",
  title: "📝 [FAST-FA] Forensische Analyse",
  spots: ["Vorderseite", "Rückseite", "Griff", "Verschluss", "Innenseite", "Oberfläche"],
  templates: itemStepsAtom,
})

const ALL: ForensicsTemplateId[] = ["ballistik", "blut", "stichwaffen", "tox", "cyber", "gegenstand"]

export const FORENSICS_TEMPLATES: Record<ForensicsTemplateId, Template<ForensicsTemplateId>> = Object.fromEntries(
  [ballistics, blood, edgedWeapons, tox, cyber, items].map((t) => [t.id, { ...t, group: "Forensik", attachable: ALL }]),
) as Record<ForensicsTemplateId, Template<ForensicsTemplateId>>
