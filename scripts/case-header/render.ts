// Renders header.html to transparent 800px PNGs with headless Chrome.
//   bun scripts/case-header/render.ts                       -> default titles, each with its own logo
//   bun scripts/case-header/render.ts "Durchsuchung" ...    -> own titles, VPD seal
//   bun scripts/case-header/render.ts --logo=fast "..."     -> own titles, another logo
// Logos are the logo-<name>.webp files next to this script. PNGs go to out/.
// Set CHROME to the browser path if it isn't in the default location.

import { existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

// Every case file uses the VPD seal, only Forensik uses the FAST seal.
const TITLES: Record<string, string> = {
  Aussage: "vpd",
  Strafakte: "vpd",
  Ermittlung: "vpd",
  Sammelakte: "vpd",
  Beschuldigter: "vpd",
  Forensik: "fast",
  Speedingticket: "vpd",
}
const SUB = "Vinewood Police Department"
const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe"

const dir = import.meta.dir
const out = join(dir, "out")
mkdirSync(out, { recursive: true })

const args = process.argv.slice(2)
const logoArg = args.find((arg) => arg.startsWith("--logo="))?.slice("--logo=".length)
const ownTitles = args.filter((arg) => !arg.startsWith("--"))
const jobs = ownTitles.length > 0
  ? ownTitles.map((title) => [title, logoArg ?? "vpd"])
  : Object.entries(TITLES).map(([title, logo]) => [title, logoArg ?? logo])

for (const [title, logo] of jobs) {
  if (!existsSync(join(dir, `logo-${logo}.webp`))) throw new Error(`No logo-${logo}.webp in ${dir}`)
  const url = pathToFileURL(join(dir, "header.html"))
  url.search = new URLSearchParams({ title, sub: SUB, logo }).toString()
  const file = join(out, `header-${slug(title)}.png`)
  const proc = Bun.spawnSync([
    CHROME,
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--default-background-color=00000000",
    "--virtual-time-budget=5000",
    "--window-size=800,160",
    `--screenshot=${file}`,
    url.href,
  ])
  if (proc.exitCode !== 0) throw new Error(`Chrome failed for "${title}": ${proc.stderr.toString()}`)
  console.log(`${file} (${logo})`)
}

function slug(text: string) {
  return text
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}
