import type { Feature } from "@/features/registry"
import { readKeys, replaceKeys } from "@/lib/local-storage"

const APP_ID = "fsd-tools"
const VERSION = 1

export interface FeatureBackup {
  app: typeof APP_ID
  feature: string
  version: number
  exportedAt: string
  data: Record<string, unknown>
}

/** Downloads the feature's stored data as a JSON file. */
export function downloadFeatureData(feature: Feature) {
  const backup: FeatureBackup = {
    app: APP_ID,
    feature: feature.path,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    data: readKeys(feature.storage?.keys ?? []),
  }
  download(backup, `${feature.path}-${backup.exportedAt.slice(0, 10)}.json`)
}

/** Parses an export of `feature`; throws if the file belongs elsewhere or is invalid. */
export async function readFeatureData(
  file: File,
  feature: Feature,
): Promise<FeatureBackup> {
  const parsed = JSON.parse(await file.text()) as Partial<FeatureBackup> | null
  const keys = feature.storage?.keys ?? []
  if (
    !parsed ||
    parsed.app !== APP_ID ||
    parsed.feature !== feature.path ||
    typeof parsed.data !== "object" ||
    parsed.data === null ||
    !Object.keys(parsed.data).every((k) => keys.includes(k)) ||
    (feature.storage?.validate && !feature.storage.validate(parsed.data))
  ) {
    throw new Error(`Not a ${feature.title} export`)
  }
  return parsed as FeatureBackup
}

export function restoreFeatureData(feature: Feature, backup: FeatureBackup) {
  replaceKeys(feature.storage?.keys ?? [], backup.data)
}

/** When the last full backup was downloaded (ISO string), for the reminder in the status bar. */
export const LAST_BACKUP_KEY = "backup:last"

export interface FullBackup {
  app: typeof APP_ID
  feature: "*"
  version: number
  exportedAt: string
  /** Stored data per feature path. */
  features: Record<string, Record<string, unknown>>
}

function download(data: unknown, name: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/** Downloads the data of every feature with storage as one JSON file. */
export function downloadAllData(features: Feature[]) {
  const backup: FullBackup = {
    app: APP_ID,
    feature: "*",
    version: VERSION,
    exportedAt: new Date().toISOString(),
    features: Object.fromEntries(
      features.filter((f) => f.storage).map((f) => [f.path, readKeys(f.storage!.keys)]),
    ),
  }
  download(backup, `${APP_ID}-${backup.exportedAt.slice(0, 10)}.json`)
  replaceKeys([LAST_BACKUP_KEY], { [LAST_BACKUP_KEY]: backup.exportedAt })
}

/** Parses a full backup; throws if it isn't one or a feature's data is invalid. */
export async function readAllData(file: File, features: Feature[]): Promise<FullBackup> {
  const parsed = JSON.parse(await file.text()) as Partial<FullBackup> | null
  if (!parsed || parsed.app !== APP_ID || parsed.feature !== "*" || typeof parsed.features !== "object" || !parsed.features) {
    throw new Error("Not a full backup")
  }
  for (const [path, data] of Object.entries(parsed.features)) {
    const feature = features.find((f) => f.path === path)
    const keys = feature?.storage?.keys ?? []
    if (
      !feature ||
      typeof data !== "object" ||
      data === null ||
      !Object.keys(data).every((k) => keys.includes(k)) ||
      (feature.storage?.validate && !feature.storage.validate(data))
    ) {
      throw new Error(`Invalid data for ${path}`)
    }
  }
  return parsed as FullBackup
}

/** Replaces the data of every feature contained in `backup`; others stay untouched. */
export function restoreAllData(features: Feature[], backup: FullBackup) {
  for (const [path, data] of Object.entries(backup.features)) {
    const feature = features.find((f) => f.path === path)
    if (feature?.storage) replaceKeys(feature.storage.keys, data)
  }
}

export function clearFeatureData(feature: Feature) {
  replaceKeys(feature.storage?.keys ?? [], {})
}
