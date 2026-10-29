import * as Schema from "effect/Schema"

// What crosses the bridge between the desktop shell (electron/) and the page. Like T3 Code's
// contracts: change a schema here and both sides follow.

export const UPDATE_STATUSES = [
  "idle",
  "checking",
  "available",
  "downloading",
  "ready",
  "latest",
  "error",
  "unsupported",
] as const
export type UpdateStatus = (typeof UPDATE_STATUSES)[number]

/** One release's notes from GitHub, as HTML. */
export const ReleaseNotes = Schema.Struct({ version: Schema.String, html: Schema.String })
export type ReleaseNotes = typeof ReleaseNotes.Type

/** Where the app's update stands; the tool strip, the settings and the tray menu show it. */
export const UpdateState = Schema.Struct({
  status: Schema.Literals(UPDATE_STATUSES),
  /** The version found, kept through a failed download so it can be tried again. */
  version: Schema.optional(Schema.String),
  /** The notes of every release since the installed one, newest first; shown when hovering the update button. */
  notes: Schema.optional(Schema.Array(ReleaseNotes)),
  percent: Schema.optional(Schema.Number),
  error: Schema.optional(Schema.String),
})
export type UpdateState = typeof UpdateState.Type

/** Colors of the Windows buttons in the title bar. */
export const TitleBarColors = Schema.Struct({
  color: Schema.String,
  symbolColor: Schema.String,
})
export type TitleBarColors = typeof TitleBarColors.Type

/** A request of the local API (electron/api), forwarded to the page, which holds the data. */
export const ApiRequest = Schema.Struct({
  id: Schema.String,
  /** The path, e.g. "/documents". */
  route: Schema.String,
  /** Query parameters and the JSON body merged. */
  body: Schema.Record(Schema.String, Schema.Unknown),
})
export type ApiRequest = typeof ApiRequest.Type

/** What the page answers a request with. A plain object, as errors lose their fields on the way through the bridge. */
export const ApiResult = Schema.Union([
  Schema.Struct({ ok: Schema.Literal(true), data: Schema.Unknown }),
  Schema.Struct({
    ok: Schema.Literal(false),
    /** The HTTP status to answer with; 500 when missing. */
    status: Schema.optional(Schema.Number),
    error: Schema.String,
  }),
])
export type ApiResult = typeof ApiResult.Type

export const ApiResponse = Schema.Union([
  Schema.Struct({ id: Schema.String, ok: Schema.Literal(true), data: Schema.Unknown }),
  Schema.Struct({
    id: Schema.String,
    ok: Schema.Literal(false),
    status: Schema.optional(Schema.Number),
    error: Schema.String,
  }),
])
export type ApiResponse = typeof ApiResponse.Type

/** What the preload exposes to the page as `window.desktop`. */
export interface DesktopBridge {
  version: () => Promise<string>
  updates: {
    get: () => Promise<UpdateState>
    check: () => Promise<void>
    /** Downloads the found update; nothing is downloaded without this. */
    download: () => Promise<void>
    install: () => Promise<void>
    /** Calls `listener` on every change; returns the unsubscribe. */
    subscribe: (listener: (state: UpdateState) => void) => () => void
  }
  /** Answers the local API with `handler(route, body)`; returns the unsubscribe. */
  serveApi: (handler: (route: string, body: Record<string, unknown>) => Promise<ApiResult>) => () => void
  setTitleBar: (colors: TitleBarColors) => void
}

declare global {
  interface Window {
    /** The desktop shell (electron/preload.ts); undefined in the browser. */
    desktop?: DesktopBridge
  }
}
