import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as PubSub from "effect/PubSub"
import * as Ref from "effect/Ref"
import * as Schema from "effect/Schema"
import type * as Scope from "effect/Scope"
import * as Stream from "effect/Stream"
import type { UpdateState } from "../../src/contracts/desktop"
import { IpcChannels } from "../../src/contracts/ipc"
import { ElectronApp } from "./ElectronApp"
import { ElectronUpdater, type UpdaterError } from "./ElectronUpdater"
import { MainWindow } from "./MainWindow"

// Like T3 Code: the first check once the app has settled, then often, so the update button
// shows up soon after a release without searching in the settings.
const STARTUP_DELAY = "15 seconds"
const POLL_INTERVAL = "4 minutes"

const UpdateInfo = Schema.Struct({ version: Schema.String })
const DownloadProgress = Schema.Struct({ percent: Schema.Number })
const decodeUpdateInfo = Schema.decodeUnknownEffect(UpdateInfo)
const decodeProgress = Schema.decodeUnknownEffect(DownloadProgress)

/**
 * Where the update stands, and the checks and downloads that move it. Nothing happens
 * without the user: the page offers the download, then the restart (see `main.ts`).
 */
export class DesktopUpdates extends Context.Service<
  DesktopUpdates,
  {
    readonly state: Effect.Effect<UpdateState>
    readonly changes: Stream.Stream<UpdateState>
    readonly check: Effect.Effect<void>
    readonly download: Effect.Effect<void>
    /** After a failed install: keeps the version so the download can be tried again. */
    readonly failInstall: (error: UpdaterError) => Effect.Effect<void>
    /** Configures the updater, follows its events and starts the periodic checks. */
    readonly start: Effect.Effect<void, never, Scope.Scope>
  }
>()("fsd-tools/desktop/DesktopUpdates") {}

const describe = (error: unknown) => (error instanceof Error ? error.message : String(error))

export const make = Effect.gen(function* () {
  const app = yield* ElectronApp
  const updater = yield* ElectronUpdater
  const window = yield* MainWindow

  const stateRef = yield* Ref.make<UpdateState>({ status: app.isPackaged ? "idle" : "unsupported" })
  const changes = yield* PubSub.sliding<UpdateState>(16)

  const state = Ref.get(stateRef)
  const setState = (next: UpdateState) =>
    Ref.set(stateRef, next).pipe(
      Effect.andThen(PubSub.publish(changes, next)),
      Effect.andThen(window.send(IpcChannels.updatesState, next)),
    )

  const check = Effect.gen(function* () {
    if (!app.isPackaged) return
    const { status } = yield* state
    if (status === "downloading" || status === "ready") return
    // Failures arrive as the updater's "error" event.
    yield* updater.checkForUpdates.pipe(Effect.ignore)
  })

  const download = Effect.gen(function* () {
    const current = yield* state
    if (!current.version || (current.status !== "available" && current.status !== "error")) return
    yield* setState({ status: "downloading", version: current.version, percent: 0 })
    yield* updater.downloadUpdate.pipe(Effect.ignore)
  })

  const failInstall = (error: UpdaterError) =>
    state.pipe(Effect.flatMap((current) => setState({ status: "error", version: current.version, error: error.message })))

  const onEvent = (name: string, handle: (raw: unknown) => Effect.Effect<void, unknown>) =>
    updater.on(name, (raw: unknown) => {
      void Effect.runPromise(
        handle(raw).pipe(Effect.catchCause((cause) => Effect.logWarning(`Update event ${name} not handled`, cause))),
      )
    })

  const start = Effect.gen(function* () {
    yield* updater.setAutoDownload(false)
    yield* updater.setAutoInstallOnAppQuit(false)

    // The periodic check keeps a found update offered instead of flashing "checking".
    yield* onEvent("checking-for-update", () =>
      state.pipe(Effect.flatMap((s) => (s.status === "available" ? Effect.void : setState({ status: "checking" })))),
    )
    yield* onEvent("update-available", (raw) =>
      decodeUpdateInfo(raw).pipe(Effect.flatMap((info) => setState({ status: "available", version: info.version }))),
    )
    yield* onEvent("update-not-available", () => setState({ status: "latest" }))
    yield* onEvent("download-progress", (raw) =>
      Effect.gen(function* () {
        const progress = yield* decodeProgress(raw)
        const current = yield* state
        yield* setState({ status: "downloading", version: current.version, percent: Math.round(progress.percent) })
      }),
    )
    yield* onEvent("update-downloaded", (raw) =>
      decodeUpdateInfo(raw).pipe(Effect.flatMap((info) => setState({ status: "ready", version: info.version }))),
    )
    // A failed background check keeps a found update offered; a failed download keeps its
    // version so it can be tried again.
    yield* onEvent("error", (error) =>
      state.pipe(
        Effect.flatMap((current) =>
          current.status === "available"
            ? Effect.void
            : setState({ status: "error", version: current.version, error: describe(error) }),
        ),
      ),
    )

    yield* Effect.sleep(STARTUP_DELAY).pipe(Effect.andThen(check), Effect.forkScoped)
    yield* Effect.sleep(POLL_INTERVAL).pipe(Effect.andThen(check), Effect.forever, Effect.forkScoped)
  })

  return DesktopUpdates.of({
    state,
    changes: Stream.fromPubSub(changes),
    check,
    download,
    failInstall,
    start,
  })
})

export const layer = Layer.effect(DesktopUpdates, make)
