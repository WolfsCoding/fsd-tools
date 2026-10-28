// Desktop shell: serves the built app from `dist/` under `app://fsd-tools` and keeps it up to date
// from the GitHub releases (see .github/workflows/release.yml). Built around Effect services like
// T3 Code's desktop app: `main.ts` only wires them up.

import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Ref from "effect/Ref"
import * as Schema from "effect/Schema"
import { app, ipcMain } from "electron"
import * as path from "node:path"
import { TitleBarColors, UpdateState } from "../src/contracts/desktop"
import { IpcChannels } from "../src/contracts/ipc"
import * as AppProtocol from "./services/AppProtocol"
import * as DesktopIpc from "./services/DesktopIpc"
import * as DesktopState from "./services/DesktopState"
import * as DesktopUpdates from "./services/DesktopUpdates"
import * as ElectronApp from "./services/ElectronApp"
import * as ElectronUpdater from "./services/ElectronUpdater"
import * as LocalApi from "./services/LocalApi"
import * as MainWindow from "./services/MainWindow"
import * as Tray from "./services/Tray"

// Set by `bun run desktop` to load the Vite dev server instead.
const DEV_URL = process.env.ELECTRON_DEV_URL
// The project root in development, `resources/app.asar` when packaged (the bundler inlines `__dirname`).
const ROOT = app.getAppPath()
const DIST = path.join(ROOT, "dist")

AppProtocol.registerSchemes()

const layerServices = Layer.mergeAll(
  ElectronApp.layer,
  ElectronUpdater.layer,
  DesktopState.layer,
  DesktopIpc.layer(ipcMain),
)
const layerWindow = MainWindow.layer({
  url: DEV_URL ?? `${AppProtocol.ORIGIN}/`,
  ownOrigin: DEV_URL ?? AppProtocol.ORIGIN,
  preload: path.join(ROOT, "dist-electron", "preload.cjs"),
}).pipe(Layer.provideMerge(layerServices))
const layerUpdates = DesktopUpdates.layer.pipe(Layer.provideMerge(layerWindow))
const layerDesktop = Layer.mergeAll(
  Tray.layer(path.join(ROOT, "build", "icon.ico")),
  LocalApi.layer,
).pipe(Layer.provideMerge(layerUpdates))

const program = Effect.gen(function* () {
  const app = yield* ElectronApp.ElectronApp
  if (!(yield* app.requestSingleInstanceLock)) return yield* app.quit

  const { quitting } = yield* DesktopState.DesktopState
  yield* app.on("before-quit", () => Effect.runSync(Ref.set(quitting, true)))
  yield* app.whenReady
  yield* AppProtocol.serveDist(DIST)

  const ipc = yield* DesktopIpc.DesktopIpc
  const updater = yield* ElectronUpdater.ElectronUpdater
  const updates = yield* DesktopUpdates.DesktopUpdates
  const window = yield* MainWindow.MainWindow
  const tray = yield* Tray.Tray
  const api = yield* LocalApi.LocalApi

  /**
   * Like T3 Code: the window and tray go at once, the installer runs without its window
   * and starts the new version when done.
   */
  const install = Effect.gen(function* () {
    if ((yield* updates.state).status !== "ready") return
    yield* Ref.set(quitting, true)
    yield* window.hide
    yield* tray.hide
    yield* updater.quitAndInstall({ isSilent: true, isForceRunAfter: true }).pipe(
      Effect.catchTag("UpdaterError", (error) =>
        Effect.gen(function* () {
          yield* Ref.set(quitting, false)
          yield* tray.show
          yield* window.show
          yield* updates.failInstall(error)
        }),
      ),
    )
  })

  yield* ipc.handle({
    channel: IpcChannels.appVersion,
    payload: Schema.Void,
    result: Schema.String,
    handler: () => Effect.succeed(app.version),
  })
  yield* ipc.handle({ channel: IpcChannels.updatesGet, payload: Schema.Void, result: UpdateState, handler: () => updates.state })
  yield* ipc.handle({ channel: IpcChannels.updatesCheck, payload: Schema.Void, result: Schema.Void, handler: () => updates.check })
  yield* ipc.handle({ channel: IpcChannels.updatesDownload, payload: Schema.Void, result: Schema.Void, handler: () => updates.download })
  yield* ipc.handle({ channel: IpcChannels.updatesInstall, payload: Schema.Void, result: Schema.Void, handler: () => install })
  // The page sets the Windows buttons' colors to follow its theme and darken under dialogs.
  yield* ipc.on({ channel: IpcChannels.titleBar, payload: TitleBarColors, handler: window.setTitleBarOverlay })

  yield* updates.start
  yield* window.show
  yield* tray.create({ install })
  yield* api.start

  yield* app.on("second-instance", () => Effect.runFork(window.show))
  yield* app.on("window-all-closed", () => Effect.runFork(app.quit))
  yield* Effect.never
}).pipe(Effect.scoped, Effect.provide(layerDesktop))

NodeRuntime.runMain(program)
