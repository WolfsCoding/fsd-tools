import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type * as Scope from "effect/Scope"
import * as Electron from "electron"

export class ElectronApp extends Context.Service<
  ElectronApp,
  {
    readonly version: string
    readonly isPackaged: boolean
    readonly userDataPath: string
    readonly whenReady: Effect.Effect<void>
    readonly requestSingleInstanceLock: Effect.Effect<boolean>
    readonly quit: Effect.Effect<void>
    /** Listens to an app event while the scope lives. */
    readonly on: <Args extends ReadonlyArray<unknown>>(
      event: string,
      listener: (...args: Args) => void,
    ) => Effect.Effect<void, never, Scope.Scope>
  }
>()("fsd-tools/desktop/ElectronApp") {}

export const layer = Layer.sync(ElectronApp, () =>
  ElectronApp.of({
    version: Electron.app.getVersion(),
    isPackaged: Electron.app.isPackaged,
    userDataPath: Electron.app.getPath("userData"),
    whenReady: Effect.promise(() => Electron.app.whenReady()),
    requestSingleInstanceLock: Effect.sync(() => Electron.app.requestSingleInstanceLock()),
    quit: Effect.sync(() => Electron.app.quit()),
    on: (event, listener) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          Electron.app.on(event as never, listener as never)
        }),
        () =>
          Effect.sync(() => {
            Electron.app.removeListener(event as never, listener as never)
          }),
      ).pipe(Effect.asVoid),
  }),
)
