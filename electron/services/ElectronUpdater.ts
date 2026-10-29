import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import type * as Scope from "effect/Scope"
import { autoUpdater } from "electron-updater"

export class UpdaterError extends Schema.TaggedError<UpdaterError>()("UpdaterError", {
  operation: Schema.Literals(["check", "download", "install"]),
  cause: Schema.Defect(),
}) {
  override get message(): string {
    const cause = this.cause
    const detail = cause instanceof Error ? cause.message : String(cause)
    return `Update ${this.operation} failed: ${detail}`
  }
}

/** electron-updater as an Effect service; the state machine around it is `DesktopUpdates`. */
export class ElectronUpdater extends Context.Service<
  ElectronUpdater,
  {
    readonly setAutoDownload: (value: boolean) => Effect.Effect<void>
    readonly setAutoInstallOnAppQuit: (value: boolean) => Effect.Effect<void>
    /** Notes of every release since the installed one instead of only the latest. */
    readonly setFullChangelog: (value: boolean) => Effect.Effect<void>
    readonly checkForUpdates: Effect.Effect<void, UpdaterError>
    readonly downloadUpdate: Effect.Effect<void, UpdaterError>
    readonly quitAndInstall: (options: {
      readonly isSilent: boolean
      readonly isForceRunAfter: boolean
    }) => Effect.Effect<void, UpdaterError>
    /** Listens to an updater event while the scope lives. */
    readonly on: <Args extends ReadonlyArray<unknown>>(
      event: string,
      listener: (...args: Args) => void,
    ) => Effect.Effect<void, never, Scope.Scope>
  }
>()("fsd-tools/desktop/ElectronUpdater") {}

const events = autoUpdater as unknown as {
  on: (event: string, listener: (...args: Array<unknown>) => void) => void
  removeListener: (event: string, listener: (...args: Array<unknown>) => void) => void
}

export const layer = Layer.succeed(
  ElectronUpdater,
  ElectronUpdater.of({
    setAutoDownload: (value) =>
      Effect.sync(() => {
        autoUpdater.autoDownload = value
      }),
    setAutoInstallOnAppQuit: (value) =>
      Effect.sync(() => {
        autoUpdater.autoInstallOnAppQuit = value
      }),
    setFullChangelog: (value) =>
      Effect.sync(() => {
        autoUpdater.fullChangelog = value
      }),
    checkForUpdates: Effect.tryPromise({
      try: () => autoUpdater.checkForUpdates(),
      catch: (cause) => new UpdaterError({ operation: "check", cause }),
    }).pipe(Effect.asVoid),
    downloadUpdate: Effect.tryPromise({
      try: () => autoUpdater.downloadUpdate(),
      catch: (cause) => new UpdaterError({ operation: "download", cause }),
    }).pipe(Effect.asVoid),
    quitAndInstall: ({ isSilent, isForceRunAfter }) =>
      Effect.try({
        try: () => autoUpdater.quitAndInstall(isSilent, isForceRunAfter),
        catch: (cause) => new UpdaterError({ operation: "install", cause }),
      }),
    on: (event, listener) => {
      const untyped = listener as unknown as (...args: Array<unknown>) => void
      return Effect.acquireRelease(
        Effect.sync(() => {
          events.on(event, untyped)
        }),
        () =>
          Effect.sync(() => {
            events.removeListener(event, untyped)
          }),
      ).pipe(Effect.asVoid)
    },
  }),
)
