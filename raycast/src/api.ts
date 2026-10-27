import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { getPreferenceValues, open } from "@raycast/api"

// Client of the app's local API (electron/api.cjs). The app writes its port and token to
// api.json in its user data folder while it runs.

const APP_DATA = process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming")
const API_FILE = path.join(APP_DATA, "FSD Tools", "api.json")
/** Where the installer puts the app (per user). */
const DEFAULT_APP_PATH = path.join(
  process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local"),
  "Programs",
  "fsd-tools",
  "FSD Tools.exe",
)

/** The app isn't running (or doesn't answer); `launchApp` starts it. */
export class AppNotRunning extends Error {
  constructor() {
    super("FSD Tools läuft nicht.")
  }
}

export async function call<T>(route: string, body?: Record<string, unknown>): Promise<T> {
  let api: { port: number; token: string }
  try {
    api = JSON.parse(await fs.readFile(API_FILE, "utf8"))
  } catch {
    throw new AppNotRunning()
  }
  let res: Response
  try {
    res = await fetch(`http://127.0.0.1:${api.port}${route}`, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${api.token}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    // A stale api.json from an app that crashed.
    throw new AppNotRunning()
  }
  const data = await res.json()
  if (!res.ok) throw new Error((data as { error?: string })?.error ?? `HTTP ${res.status}`)
  return data as T
}

export async function launchApp() {
  const { appPath } = getPreferenceValues<{ appPath?: string }>()
  await open(appPath?.trim() || DEFAULT_APP_PATH)
}

/** Shows `path` (e.g. "/law-book/to/17") in the app and brings it to the front. */
export function openInApp(path: string) {
  return call("/open", { path, open: true })
}

// What the routes return; see src/components/desktop-api.tsx in the app.

export type Field =
  | { type: "text"; key: string; label: string; hint?: string; required?: boolean; placeholder: string; default?: string; suggestions?: string[] }
  | { type: "list"; key: string; label: string; hint?: string; required?: boolean; placeholder: string }
  | { type: "datetime"; key: string; label: string; hint?: string; required?: boolean }
  | { type: "checks"; key: string; label: string; hint?: string; required?: boolean; options: string[]; inline: Field[] }
  | {
      type: "table"
      key: string
      label: string
      hint?: string
      required?: boolean
      columns: { key: string; label: string; placeholder: string; choices?: string[] }[]
    }
  | { type: "charges"; key: string; label: string; hint?: string; required?: boolean }

export interface Template {
  id: string
  label: string
  emoji: string
  description: string
  group: string
  sections: { title: string; description: string; fields: Field[] }[]
}

export interface Offense {
  id: string
  ref: string
  title: string
  book: string
  fine?: string
  notes: string[]
  excerpt: string
}

export interface Paragraph {
  book: { id: string; title: string; abbreviation: string }
  chapter: string
  number: number
  title: string
  citation: string
  sections: { citation: string; text: string }[]
  offenses: Offense[]
  path: string
}

export interface CreatedDocument {
  id?: string
  title?: string
  path?: string
  markdown: string
  /** Required fields left empty. */
  missing: string[]
}
