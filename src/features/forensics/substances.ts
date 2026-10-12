// The substances of the toxicological analysis, with the typical shares and cutting agents
// of the HP template ("[ XX 15-30% XX ]").

import { formatNumber, range, remainder, type Range } from "@/features/case-files/range"

/** A measured share, e.g. the THC content. */
export interface Param {
  key: string
  label: string
  range: Range
  /** Written while nothing is entered; defaults to "[ XX 15-30% XX ]". */
  fallback?: string
}

export interface Substance {
  key: string
  /** As listed in the overview, e.g. "MDMA". */
  name: string
  /** In the heading of its results, e.g. "MDMA – Ecstasy". */
  heading: string
  /** Units it is counted in; the first is preset. */
  units: string[]
  params: Param[]
  /** The rest to 100 % of a param (its `key`) consists of cutting agents or additives. */
  rest?: string
  /** Cutting agents, additives or chemicals that can be found in it. */
  agents?: {
    label: string
    options: string[]
    /** Preset when the substance is added. */
    preset?: string[]
    /** Rolled with the dice; off for findings that don't vary. */
    random?: boolean
  }
  /** Bullet points of its results: the bold title, then the text. */
  lines: (v: SubstanceValues) => [title: string, text: string][]
}

/** The values of an added substance as written in its results, with placeholders for what's missing. */
export interface SubstanceValues {
  /** A share with its unit, e.g. "23%". */
  p: (key: string) => string
  /** The rest of `rest` to 100 %, e.g. "77%". */
  rest: string
  /** The found agents as a list, e.g. "Koffein, Zucker und Salze". */
  agents: string
}

/** "[ XX 15-30% XX ]", the template's placeholder. */
export function rangePlaceholder(r: Range) {
  return `[ XX ${formatNumber(r.min, r.decimals)}-${formatNumber(r.max, r.decimals)}${r.unit ?? ""} XX ]`
}

/** The placeholder of the rest, e.g. "[ XX 85-50% XX ]" for a share of 15–50 %. */
export function restPlaceholder(r: Range) {
  return `[ XX ${remainder(String(r.min), r.decimals)}-${remainder(String(r.max), r.decimals)}% XX ]`
}

/** "a, b und c" */
export function joinAnd(items: string[]) {
  return items.length < 2 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} und ${items.at(-1)}`
}

const GC = "mittels Gaschromatographie (GC) bestimmt"
const CUT =
  "Streckmittel werden häufig hinzugefügt, um das Volumen der Droge zu erhöhen und den Gewinn zu maximieren, können jedoch gesundheitliche Risiken bergen."

export const SUBSTANCES: Substance[] = [
  {
    key: "weedsamen",
    name: "Weedsamen",
    heading: "Weedsamen",
    units: ["Päckchen"],
    params: [],
    lines: () => [
      [
        "Mikroskopische Analyse",
        "Die Samen zeigen die typische ovale Form und dunkle Musterung, die für Weedsamen charakteristisch sind.",
      ],
      ["Chemische Analyse", "Ein Farbreaktionstest ergab keine Reaktion."],
      [
        "Quantitative Analyse",
        "Es wurde keine signifikante Menge an Tetrahydrocannabinol (THC) oder anderen Cannabinoiden in den Samen nachgewiesen.",
      ],
      [
        "Schlussfolgerung",
        "Die analysierten Weedsamen enthalten keine psychoaktiven Substanzen wie THC. Die ausgewachsene Pflanze aus den Samen kann bei geeigneten Anbaubedingungen über einen relevanten THC-Gehalt verfügen.",
      ],
    ],
  },
  {
    key: "grasknollen",
    name: "Grasknollen",
    heading: "Grasknollen",
    units: ["Tüte"],
    params: [{ key: "thc", label: "THC-Gehalt", range: range(15, 30) }],
    lines: (v) => [
      [
        "Chemische Analyse",
        "Ein Farbreaktionstest färbte sich grün, was eine positive Reaktion auf Tetrahydrocannabinol (THC), den Hauptwirkstoff von Cannabis, darstellt.",
      ],
      [
        "Mikroskopische Analyse",
        "Die morphologischen Merkmale der Knollen stimmen mit denen von Cannabis sativa überein. Charakteristische Trichome sind auf der Oberfläche der Knollen sichtbar.",
      ],
      ["Quantitative Analyse", `Der THC-Gehalt wurde ${GC} und beträgt ${v.p("thc")} des Gesamtgewichts der Grasknollen.`],
      [
        "Schlussfolgerung",
        `Es handelt sich um weibliche Grasknollen. Der THC-Gehalt variierte, was auf verschiedene Cannabis-Sorten hindeutet. In den meisten Fällen wurde ein Spitzenwert von über ${v.p("thc")} THC-Gehalt festgestellt.`,
      ],
    ],
  },
  {
    key: "joints",
    name: "Joints",
    heading: "Joints",
    units: ["Joint"],
    params: [{ key: "thc", label: "THC-Gehalt", range: range(5, 20) }],
    lines: (v) => [
      [
        "Chemische Analyse",
        "Ein Farbreaktionstest färbte sich grün, was eine positive Reaktion auf Tetrahydrocannabinol (THC), den Hauptwirkstoff von Cannabis, darstellt.",
      ],
      ["Mikroskopische Analyse", "Die morphologischen Merkmale der Joints stimmen mit denen von Cannabis sativa überein."],
      ["Quantitative Analyse", `Der THC-Gehalt wurde ${GC} und beträgt ${v.p("thc")} des Gesamtgewichts.`],
      [
        "Schlussfolgerung",
        `Die Probe weist einen THC-Gehalt von durchschnittlich ${v.p("thc")} auf. THC ist ein psychoaktives Cannabinoid und als Betäubungsmittel klassifiziert. Es handelt sich bei den analysierten selbst gedrehten Zigaretten um Joints.`,
      ],
    ],
  },
  {
    key: "kokablaetter",
    name: "Kokablätter",
    heading: "Kokablätter",
    units: ["Tüte", "Bündel"],
    params: [{ key: "alkaloide", label: "Kokainalkaloide", range: range(0.1, 1, 2) }],
    lines: (v) => [
      [
        "Chemische Analyse",
        "Ein Farbreaktionstest zeigte eine schwach rote bis weinrote Reaktion, was auf das Vorhandensein von Kokainalkaloiden hinweist.",
      ],
      [
        "Mikroskopische Analyse",
        "Die Probe zeigt charakteristische pflanzliche Blattstrukturen mit typischen Zellmustern und Blattadern, wie sie für Kokablätter charakteristisch sind.",
      ],
      [
        "Quantitative Analyse",
        `Der Gehalt an Kokainalkaloiden wurde ${GC} und beträgt ${v.p("alkaloide")} des Gesamtgewichts der Blätter.`,
      ],
      [
        "Schlussfolgerung",
        "Die analysierte Probe enthält Kokablätter mit einem natürlichen Gehalt an Kokainalkaloiden. Kokablätter wirken stimulierend und dienen als Ausgangsmaterial für die Herstellung von Kokain.",
      ],
    ],
  },
  {
    key: "kokain",
    name: "Kokain",
    heading: "Kokain",
    units: ["Tüte", "Line"],
    params: [{ key: "gehalt", label: "Kokain-Gehalt", range: range(40, 80) }],
    rest: "gehalt",
    agents: {
      label: "Streckmittel",
      options: ["Zucker", "Koffein", "Lidocain", "Levamisol", "Phenacetin", "Paracetamol"],
      random: true,
    },
    lines: (v) => [
      ["Chemische Analyse", "Ein Farbreaktionstest färbte sich rot, was eine positive Reaktion auf Kokain darstellt."],
      ["Mikroskopische Analyse", "Das Pulver zeigt feine kristalline Strukturen, die für Kokain charakteristisch sind."],
      ["Quantitative Analyse", `Der Kokain-Gehalt wurde ${GC} und beträgt ${v.p("gehalt")} des Gesamtgewichts der Probe.`],
      [
        "Analyse von Streckmitteln",
        `Die restlichen ${v.rest} der Probe bestehen aus verschiedenen Streckmitteln, darunter ${v.agents}.`,
      ],
      [
        "Schlussfolgerung",
        `Die analysierte Probe enthält ${v.p("gehalt")} Kokain und ${v.rest} verschiedene Streckmittel. Kokain ist ein starkes Stimulans, das als Betäubungsmittel eingestuft wird. ${CUT}`,
      ],
    ],
  },
  {
    key: "sudafed",
    name: "Sudafed",
    heading: "Sudafed – Pseudoephedrin",
    units: ["Tablette"],
    params: [{ key: "gehalt", label: "Pseudoephedrin-Gehalt", range: range(5, 15) }],
    rest: "gehalt",
    agents: {
      label: "Hilfs- und Füllstoffe",
      options: ["Cellulose", "Stärke", "Lactose", "Magnesiumstearat"],
      random: true,
    },
    lines: (v) => [
      ["Chemische Analyse", "Die chemische Analyse ergab den Nachweis von Pseudoephedrin, dem Wirkstoff von Sudafed."],
      [
        "Mikroskopische Analyse",
        "Die Tabletten zeigen typische Pressmerkmale sowie eine gleichmäßige Struktur, wie sie für industriell hergestellte Arzneimittel charakteristisch sind.",
      ],
      [
        "Quantitative Analyse",
        `Der Pseudoephedrin-Gehalt wurde ${GC} und beträgt ${v.p("gehalt")} des Gesamtgewichts der Tabletten.`,
      ],
      [
        "Analyse von Zusatzstoffen",
        `Die restlichen ${v.rest} der Tabletten bestehen aus verschiedenen Hilfs- und Füllstoffen, darunter ${v.agents}.`,
      ],
      [
        "Schlussfolgerung",
        `Die analysierten Tabletten enthalten ${v.p("gehalt")} Pseudoephedrin. Pseudoephedrin ist ein stimulierend wirkender Arzneistoff, der hauptsächlich in Erkältungsmedikamenten wie Sudafed eingesetzt wird.`,
      ],
    ],
  },
  {
    key: "mdma",
    name: "MDMA",
    heading: "MDMA – Ecstasy",
    units: ["Tablette"],
    params: [{ key: "gehalt", label: "MDMA-Gehalt", range: range(15, 50) }],
    rest: "gehalt",
    agents: { label: "Streckmittel", options: ["Koffein", "Mannitol", "Milchzucker (Laktose)"], random: true },
    lines: (v) => [
      [
        "Chemische Analyse",
        "Ein Farbreaktionstest färbte sich lila, was eine positive Reaktion auf MDMA (auch bekannt als Ecstasy) darstellt.",
      ],
      [
        "Mikroskopische Analyse",
        "Die Tabletten zeigen charakteristische Prägungen und Farbgebungen, die für MDMA-Tabletten typisch sind.",
      ],
      ["Quantitative Analyse", `Der MDMA-Gehalt wurde ${GC} und beträgt ${v.p("gehalt")} des Gesamtgewichts der Tabletten.`],
      [
        "Analyse von Streckmitteln",
        `Die restlichen ${v.rest} der Tabletten bestehen aus verschiedenen Streckmitteln, darunter ${v.agents}.`,
      ],
      [
        "Schlussfolgerung",
        `Die analysierten Tabletten enthalten ${v.p("gehalt")} MDMA und ${v.rest} verschiedene Streckmittel.`,
      ],
    ],
  },
  {
    key: "meth",
    name: "Methamphetamin",
    heading: "Methamphetamin – Crystal Meth",
    units: ["Crystal", "Line"],
    params: [{ key: "gehalt", label: "Methamphetamin-Gehalt", range: range(25, 60) }],
    rest: "gehalt",
    agents: { label: "Streckmittel", options: ["Koffein", "Zucker", "Salze"], random: true },
    lines: (v) => [
      [
        "Chemische Analyse",
        "Ein Farbreaktionstest färbte sich orange, was eine positive Reaktion auf Methamphetamin darstellt.",
      ],
      ["Mikroskopische Analyse", "Das Pulver zeigt charakteristische große Kristalle, die für Methamphetamin typisch sind."],
      [
        "Quantitative Analyse",
        `Der Methamphetamin-Gehalt wurde ${GC} und beträgt ${v.p("gehalt")} des Gesamtgewichts der Probe.`,
      ],
      [
        "Analyse von Streckmitteln",
        `Die restlichen ${v.rest} der Probe bestehen aus verschiedenen Streckmitteln, darunter ${v.agents}.`,
      ],
      [
        "Schlussfolgerung",
        `Die analysierte Probe enthält ${v.p("gehalt")} Methamphetamin und ${v.rest} verschiedene Streckmittel.`,
      ],
    ],
  },
  {
    key: "lsd",
    name: "LSD",
    heading: "LSD – Lysergsäurediethylamid",
    units: ["Blotter"],
    params: [{ key: "gehalt", label: "LSD-Gehalt pro Blotter", range: range(0.01, 0.05, 2) }],
    lines: (v) => [
      ["Chemische Analyse", "Ein Farbreaktionstest färbte sich blau, was eine positive Reaktion auf LSD darstellt."],
      [
        "Mikroskopische Analyse",
        "Die Papierstücke zeigen keine spezifischen morphologischen Merkmale, sind jedoch typisch für LSD-Blotter.",
      ],
      ["Quantitative Analyse", `Der LSD-Gehalt wurde ${GC} und beträgt ${v.p("gehalt")} pro Blotter.`],
      [
        "Schlussfolgerung",
        `Die analysierten Papierstücke enthalten jeweils ${v.p("gehalt")} LSD.`,
      ],
    ],
  },
  {
    key: "maische",
    name: "Maische",
    heading: "Maische",
    units: ["Behälter"],
    params: [
      { key: "ethanol", label: "Ethanol", range: range(5, 12) },
      { key: "methanol", label: "Methanol", range: range(0.01, 0.05, 2), fallback: "[ XX <0,01-0,05% XX ]" },
    ],
    lines: (v) => [
      [
        "Chemische Analyse",
        "Die chemische Analyse ergab Hinweise auf einen gärenden Alkoholansatz aus Zucker, Wasser, Hefe und pflanzlichen Bestandteilen.",
      ],
      [
        "Mikroskopische Analyse",
        "Die Probe zeigt Pflanzenrückstände, Hefezellen sowie organische Schwebstoffe, wie sie für gärende Maische typisch sind.",
      ],
      [
        "Quantitative Analyse",
        `Der Ethanolgehalt wurde ${GC} und beträgt ${v.p("ethanol")} der Flüssigkeit. Zusätzlich konnten geringe Mengen Methanol im Bereich von ${v.p("methanol")} nachgewiesen werden.`,
      ],
      [
        "Schlussfolgerung",
        "Die analysierte Probe entspricht einer alkoholischen Maische, wie sie typischerweise als Ausgangsprodukt für die Herstellung von Moonshine oder anderen destillierten Alkoholprodukten verwendet wird. Der nachgewiesene Ethanolgehalt ist typisch für einen gärenden Alkoholansatz.",
      ],
    ],
  },
  {
    key: "moonshine",
    name: "Moonshine",
    heading: "Moonshine",
    units: ["Flasche"],
    params: [
      { key: "ethanol", label: "Ethanol", range: range(40, 70) },
      { key: "methanol", label: "Methanol", range: range(0.01, 0.1, 2), fallback: "[ XX <0,01-0,1% XX ]" },
    ],
    lines: (v) => [
      [
        "Chemische Analyse",
        "Es wurde eine chemische Analyse durchgeführt, um die Zusammensetzung des Alkohols zu bestimmen. Ergebnisse deuten auf eine Mischung aus Mais, Wasser, Zucker und Hefe hin.",
      ],
      [
        "Mikroskopische Analyse",
        "Es wurden mikroskopische Untersuchungen durchgeführt, um Verunreinigungen und ungewöhnliche Bestandteile zu identifizieren. Ergebnisse weisen Maiszellen und Hefezellen auf.",
      ],
      [
        "Quantitative Analyse",
        `Eine quantitative Analyse wurde durchgeführt, um den Alkoholgehalt und mögliche Giftstoffe zu bestimmen. Ergebnisse zeigen einen Gehalt von ${v.p("ethanol")} Ethanol (Alkohol) und ${v.p("methanol")} Methanol (Methylalkohol).`,
      ],
      [
        "Schlussfolgerung",
        "Der Ethanolgehalt der Probe entspricht einem hochprozentigen, destillierten Alkohol („Moonshine“). Der nachgewiesene Methanolanteil deutet auf eine unsachgemäße Destillation hin und kann bei erhöhter Aufnahme erhebliche gesundheitliche Risiken verursachen.",
      ],
    ],
  },
  {
    key: "fentanyl",
    name: "Fentanyl",
    heading: "Fentanyl",
    units: ["Pille"],
    params: [{ key: "gehalt", label: "Fentanyl-Gehalt", range: range(0.1, 2, 1) }],
    rest: "gehalt",
    agents: {
      label: "Füll- und Streckstoffe",
      options: ["Mannitol", "Milchzucker (Laktose)", "Stärke"],
      random: true,
    },
    lines: (v) => [
      ["Chemische Analyse", "Im Rahmen der chemischen Analyse konnte Fentanyl als Inhaltsstoff der Probe identifiziert werden."],
      [
        "Mikroskopische Analyse",
        "Die Tabletten zeigen typische Pressmerkmale und gleichmäßige Strukturierungen, wie sie bei industriell oder halbprofessionell hergestellten Tabletten vorkommen.",
      ],
      [
        "Quantitative Analyse",
        `Der Fentanyl-Gehalt wurde ${GC} und beträgt ${v.p("gehalt")} des Gesamtgewichts der Tabletten.`,
      ],
      [
        "Analyse von Zusatzstoffen",
        `Die restlichen ${v.rest} der Tabletten bestehen aus verschiedenen Füll- und Streckstoffen, darunter ${v.agents}.`,
      ],
      [
        "Schlussfolgerung",
        `Die analysierten Tabletten enthalten ${v.p("gehalt")} Fentanyl. Fentanyl ist ein hochpotentes synthetisches Opioid mit extrem hohem Risiko für Überdosierungen und Atemdepressionen bereits in sehr geringen Mengen.`,
      ],
    ],
  },
  {
    key: "glatzkoepfe",
    name: "Glatzköpfe",
    heading: "Glatzköpfe – Psilocybe semilanceata",
    units: ["Pilz"],
    params: [],
    lines: () => [
      [
        "Chemische Analyse",
        "Durch Einschneiden des Pilzes wurde ein Oxidationstest durchgeführt. Die Einschnittstelle färbte sich blau, was eine positive Reaktion auf Psilocybin darstellt.",
      ],
      ["Mikroskopische Analyse", "Die morphologischen Merkmale der Pilze stimmen mit denen von Psilocybe semilanceata überein."],
      [
        "Schlussfolgerung",
        "Die analysierten Proben enthalten Pilze der Art Spitzkegeliger Kahlkopf („Glatzköpfe“), welche Psilocybin enthalten. Psilocybin ist eine psychoaktive Substanz, die als Betäubungsmittel gilt.",
      ],
    ],
  },
  {
    key: "heroin",
    name: "Heroin",
    heading: "Heroin",
    units: ["Tüte", "Line"],
    params: [{ key: "gehalt", label: "Heroin-Gehalt", range: range(5, 30) }],
    rest: "gehalt",
    agents: { label: "Streckmittel", options: ["Paracetamol", "Koffein", "Milchzucker (Laktose)"], random: true },
    lines: (v) => [
      ["Chemische Analyse", "Ein Farbreaktionstest färbte sich bräunlich, was eine positive Reaktion auf Heroin darstellt."],
      ["Mikroskopische Analyse", "Das Pulver zeigt keine spezifischen morphologischen Merkmale."],
      ["Quantitative Analyse", `Der Heroin-Gehalt wurde ${GC} und beträgt ${v.p("gehalt")} des Gesamtgewichts der Probe.`],
      [
        "Analyse von Streckmitteln",
        `Die restlichen ${v.rest} der Probe bestehen aus verschiedenen Streckmitteln, darunter ${v.agents}.`,
      ],
      [
        "Schlussfolgerung",
        `Die analysierte Probe enthält ${v.p("gehalt")} Heroin und ${v.rest} verschiedene Streckmittel.`,
      ],
    ],
  },
  {
    key: "chemikalien",
    name: "Flasche mit chemischen Substanzen",
    heading: "Flasche mit chemischen Substanzen",
    units: ["Flasche"],
    params: [],
    agents: {
      label: "Nachgewiesene Chemikalien",
      options: ["Kaliumpermanganat", "Salzsäure", "Schwefelsäure", "Aceton", "Diethylether"],
      preset: ["Kaliumpermanganat", "Salzsäure", "Schwefelsäure", "Aceton", "Diethylether"],
    },
    lines: (v) => [
      [
        "Chemische Analyse",
        `Die instrumentelle Analyse der sichergestellten Flüssigkeit ergab das Vorhandensein von ${v.agents}. Der Nachweis erfolgte mittels chromatographischer und spektrometrischer Analyseverfahren.`,
      ],
      [
        "Mikroskopische Analyse",
        "Es konnten weder pflanzliche Bestandteile noch biologische Strukturen oder kristalline Merkmale nachgewiesen werden, die auf ein Betäubungsmittel hindeuten.",
      ],
      [
        "Quantitative Analyse",
        `Die Zusammensetzung der Probe wurde mittels Gaschromatographie bestimmt. Nachgewiesen wurden ${v.agents} in unterschiedlichen Konzentrationen.`,
      ],
      [
        "Bewertung der Stoffe",
        "Die nachgewiesenen Stoffe sind technische Chemikalien mit vielfältigen industriellen und laborbezogenen Einsatzmöglichkeiten. Aus der Zusammensetzung allein lässt sich weder ein konkreter Verwendungszweck noch ein Zusammenhang mit einer Straftat ableiten.",
      ],
      [
        "Schlussfolgerung",
        `Die analysierte Probe enthält mehrere technische Chemikalien, darunter ${v.agents}. Betäubungsmittel konnten in der Probe nicht nachgewiesen werden. Eine kriminaltechnische Gesamtbewertung ist ausschließlich unter Berücksichtigung aller weiteren Asservate und Ermittlungsergebnisse möglich.`,
      ],
    ],
  },
  {
    key: "desinfektion",
    name: "Desinfektionsmittel",
    heading: "Desinfektionsmittel",
    units: ["Flasche"],
    params: [{ key: "alkohol", label: "Alkoholgehalt", range: range(60, 80) }],
    rest: "alkohol",
    lines: (v) => [
      [
        "Chemische Analyse",
        "Die instrumentelle Analyse mittels Gaschromatographie bestätigt ein handelsübliches alkoholhaltiges Desinfektionsmittel auf Basis von Ethanol beziehungsweise Isopropanol mit üblichen Zusatzstoffen.",
      ],
      [
        "Mikroskopische Analyse",
        "Es wurden keine festen Partikel oder kristallinen Strukturen nachgewiesen. Die Probe zeigt das typische homogene Erscheinungsbild eines flüssigen Desinfektionsmittels.",
      ],
      [
        "Quantitative Analyse",
        `Mittels Gaschromatographie wurde ein Alkoholgehalt von ${v.p("alkohol")} bestimmt. Die übrigen ${v.rest} bestehen aus Wasser und handelsüblichen Zusatzstoffen.`,
      ],
      [
        "Schlussfolgerung",
        "Die Probe entspricht einem handelsüblichen Desinfektionsmittel. Es konnten keine Hinweise auf Betäubungsmittel oder andere verbotene Stoffe festgestellt werden.",
      ],
    ],
  },
]

export const SUBSTANCE_BY_KEY = new Map(SUBSTANCES.map((s) => [s.key, s]))
