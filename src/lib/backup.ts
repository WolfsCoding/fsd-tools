import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import type { Feature } from "@/features/registry"
import { readKeys, replaceKeys, stored } from "@/lib/storage"

const APP_ID = "fsd-tools"
const VERSION = 1

/** The export of one feature: the values of its stored keys. */
export const FeatureBackup = Schema.Struct({
  app: Schema.Literal(APP_ID),
  feature: Schema.String,
  version: Schema.Number,
  exportedAt: Schema.String,
  data: Schema.Record(Schema.String, Schema.Unknown),
})
export type FeatureBackup = typeof FeatureBackup.Type

/** The export of every feature with storage, by feature path. */
export const FullBackup = Schema.Struct({
  app: Schema.Literal(APP_ID),
  feature: Schema.Literal("*"),
  version: Schema.Number,
  exportedAt: Schema.String,
  features: Schema.Record(Schema.String, Schema.Record(Schema.String, Schema.Unknown)),
})
export type FullBackup = typeof FullBackup.Type

const decodeFeatureBackup = Schema.decodeUnknownEffect(Schema.fromJsonString(FeatureBackup))
const decodeFullBackup = Schema.decodeUnknownEffect(Schema.fromJsonString(FullBackup))

/** A file that isn't the expected export, or holds data of another shape. */
export class InvalidBackupError extends Schema.TaggedError<InvalidBackupError>()("InvalidBackupError", {
  reason: Schema.String,
}) {}

/** When the last full backup was downloaded (ISO string), for the reminder in the status bar. */
export const LAST_BACKUP_KEY = "backup:last"
export const lastBackupAtom = stored(LAST_BACKUP_KEY, Schema.NullOr(Schema.String), null)

/** The keys a feature stores. */
export function storedKeys(feature: Feature) {
  return feature.storage?.entries.map((e) => e.key) ?? []
}

/** Whether `data` only holds keys of `feature`, each in the shape its key stores. */
function fits(feature: Feature, data: Record<string, unknown>) {
  const entries = feature.storage?.entries ?? []
  return Object.entries(data).every(([key, value]) => entries.some((e) => e.key === key && e.is(value)))
}

const readText = (file: File) =>
  Effect.tryPromise({
    try: () => file.text(),
    catch: () => new InvalidBackupError({ reason: "Die Datei konnte nicht gelesen werden." }),
  })

function download(data: unknown, name: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/** Downloads the feature's stored data as a JSON file. */
export function downloadFeatureData(feature: Feature) {
  const backup: FeatureBackup = {
    app: APP_ID,
    feature: feature.path,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    data: readKeys(storedKeys(feature)),
  }
  download(backup, `${feature.path}-${backup.exportedAt.slice(0, 10)}.json`)
}

/** Parses an export of `feature`; fails if the file belongs elsewhere or is invalid. */
export const readFeatureData = Effect.fn("backup.readFeatureData")(function* (file: File, feature: Feature) {
  const text = yield* readText(file)
  const parsed = yield* decodeFeatureBackup(text).pipe(
    Effect.mapError(() => new InvalidBackupError({ reason: `Kein Export von ${feature.title}.` })),
  )
  if (parsed.feature !== feature.path || !fits(feature, parsed.data)) {
    return yield* new InvalidBackupError({ reason: `Kein Export von ${feature.title}.` })
  }
  return parsed
})

export function restoreFeatureData(feature: Feature, backup: FeatureBackup) {
  replaceKeys(storedKeys(feature), backup.data)
}

/** Downloads the data of every feature with storage as one JSON file. */
export function downloadAllData(features: Feature[]) {
  const backup: FullBackup = {
    app: APP_ID,
    feature: "*",
    version: VERSION,
    exportedAt: new Date().toISOString(),
    features: Object.fromEntries(features.filter((f) => f.storage).map((f) => [f.path, readKeys(storedKeys(f))])),
  }
  download(backup, `${APP_ID}-${backup.exportedAt.slice(0, 10)}.json`)
  replaceKeys([LAST_BACKUP_KEY], { [LAST_BACKUP_KEY]: backup.exportedAt })
}

/** Parses a full backup; fails if it isn't one or a feature's data is invalid. */
export const readAllData = Effect.fn("backup.readAllData")(function* (file: File, features: Feature[]) {
  const text = yield* readText(file)
  const parsed = yield* decodeFullBackup(text).pipe(
    Effect.mapError(() => new InvalidBackupError({ reason: "Keine vollständige Sicherung." })),
  )
  for (const [path, data] of Object.entries(parsed.features)) {
    const feature = features.find((f) => f.path === path)
    if (!feature || !fits(feature, data)) {
      return yield* new InvalidBackupError({ reason: `Ungültige Daten für ${path}.` })
    }
  }
  return parsed
})

/** Replaces the data of every feature contained in `backup`; others stay untouched. */
export function restoreAllData(features: Feature[], backup: FullBackup) {
  for (const [path, data] of Object.entries(backup.features)) {
    const feature = features.find((f) => f.path === path)
    if (feature?.storage) replaceKeys(storedKeys(feature), data)
  }
}

export function clearFeatureData(feature: Feature) {
  replaceKeys(storedKeys(feature), {})
}
