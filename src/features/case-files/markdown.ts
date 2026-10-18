// Building blocks of the HP case file markdown. The output is pasted into the
// homestate editor, which renders the inline HTML (banners, colors).

/** Placeholder the editor replaces with the current time; used when no time was entered. */
export const NOW = "{{now:DD.MM.YYYY HH:mm}}"
/** Date pattern of most case files, written with " Uhr" after it. */
export const DATE_UHR = "DD.MM.YYYY - HH:mm"
/** Placeholder for the own name; used while no name is set in the settings. */
export const ME = "{{ME}}"
/** The own name in a copied empty template, which is filled in by whoever uses it. */
export const TEMPLATE_ME = "Officer XXX"
/** Placeholder for the own department; may be typed anywhere and follows the settings. */
export const DEPARTMENT = "{{DEPARTMENT}}"
/** The department while none is set in the settings. */
export const DEFAULT_DEPARTMENT = "Vinewood Police Department"

export const MIRANDA =
  "Sie haben das Recht zu schweigen. Alles was sie sagen kann und wird vor Gericht gegen sie verwendet werden. Sie haben das Recht auf ein 3 minütiges privates Telefonat sowie das Recht den Grund der Festnahme zu erfahren."
export const SUSPECT_MIRANDA =
  "Als Beschuldigter haben Sie das Recht zu schweigen. Alles was Sie sagen kann und wird vor Gericht gegen Sie verwendet werden. Sie haben das Recht auf ein 3 minütiges privates Telefonat sowie das Recht den Grund der Festnahme zu erfahren."
export const WITNESS_CAUTION =
  "Als Zeuge sind Sie dazu verpflichtet die Wahrheit zu sagen. Durch eine Falschaussage machen Sie sich nach `§15 CO` der Falschaussage Strafbar. Sie können die Aussage verweigern sofern Sie sich, direkte Familienmitglieder oder Ehepartner belasten. Haben sie dies Verstanden?"

export const LEGEND = [
  "🔴 = Beschuldigter",
  "🟡 = Geschädigter",
  "🟣 = Zeuge",
  "🔵 = Officer",
  "🩸 = Blut gefunden",
  "🔍 = Forensic",
  "⚙️ = Hülsen",
  "🟩 = Schmauchspurentest positiv",
  "🔫 = Waffe gefunden",
  "🅰️ = Aussagen",
  "📝 = Forensik-Bericht / Verwaltung",
]

/** Colors of the markdown, changeable in the settings. Any HTML color works, e.g. "#5882FA" or "orange". */
export interface Colors {
  /** Numbered section headings. */
  heading: string
}

export const DEFAULT_COLORS: Colors = { heading: "#5882FA" }

/** Joins the blocks of a document with horizontal rules. */
export function doc(...blocks: string[]) {
  return blocks.join("\n\n---\n\n")
}

/** A centered banner image with the document title. */
export function banner(src: string) {
  return `<center>
    <img src="${src}" width="800px" />
</center>`
}

/** HTML comment holding the suggested page title; invisible once pasted. */
export function titleComment(title: string) {
  return `<!-- Titel: ${title} -->`
}

/** A numbered section: colored heading, then the body. */
export function section({ colors }: { colors: Colors }, title: string, body: string) {
  return `> <font color=${colors.heading}><b>${title}</b></font>\n\n${body}`
}

/** Text as inline code; backticks and line breaks would end it early. */
export function code(text: string) {
  return "`" + text.replace(/`/g, "'").replace(/\s*\n\s*/g, " ") + "`"
}

/** `> **LABEL:** \`value\`` lines. */
export function facts(pairs: [label: string, value: string][]) {
  return pairs.map(([label, value]) => `> **${label}:** ${code(value)}`).join("\n")
}

/** Each line as a quoted bullet. */
export function bullets(lines: string[]) {
  return lines.map((line) => `> - ${line.replace(/^[-*]\s+/, "")}`).join("\n")
}

export function checklist(items: { label: string; checked: boolean }[]) {
  return items.map((i) => `> - [${i.checked ? "x" : " "}] ${i.label}`).join("\n")
}

/** A quoted table with its rows numbered under "#"; every cell is inline code. */
export function table(headers: string[], rows: string[][]) {
  return rawTable(headers, rows.map((cells) => cells.map(cell)))
}

/** A table cell as inline code; pipes would end the cell early. */
export function cell(text: string) {
  return code(text.replace(/\|/g, "\\|"))
}

/** A quoted table whose cells are already formatted; every table numbers its rows from 1 under "#". */
export function rawTable(headers: string[], rows: string[][]) {
  const line = (cells: string[]) => `> | ${cells.join(" | ")} |`
  const all = ["#", ...headers]
  return [line(all), line(all.map(() => "---")), ...rows.map((cells, i) => line([code(String(i + 1)), ...cells]))].join(
    "\n",
  )
}

export function legend(style: { colors: Colors }, title: string) {
  return section(style, title, LEGEND.map((l) => `> ${code(l)}`).join("\n"))
}

/**
 * "2026-10-02T14:30" (from a datetime-local input) as "02.10.2026 14:30", or in another
 * pattern of the editor's placeholders (DD, MM, YYYY, HH, mm).
 */
export function formatLocalDateTime(value: string, pattern = "DD.MM.YYYY HH:mm") {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value)
  if (!m) return value
  const parts: Record<string, string> = { YYYY: m[1], MM: m[2], DD: m[3], HH: m[4], mm: m[5] }
  return pattern.replace(/YYYY|MM|DD|HH|mm/g, (t) => parts[t])
}

/** The current local time in the format of a datetime-local input. */
export function localNow() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

/** The markdown with every automatic date/time (`{{now:…}}`) set to the current one, as when copying. */
export function withNow(markdown: string) {
  const now = localNow()
  return markdown.replace(/\{\{now:([^}]*)\}\}/g, (_, pattern: string) => formatLocalDateTime(now, pattern))
}
