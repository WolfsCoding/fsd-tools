import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Ref from "effect/Ref"
import type * as Scope from "effect/Scope"
import * as Stream from "effect/Stream"
import * as Electron from "electron"
import type { UpdateState } from "../../src/contracts/desktop"
import { DesktopUpdates } from "./DesktopUpdates"
import { ElectronApp } from "./ElectronApp"
import { MainWindow } from "./MainWindow"

export interface TrayActions {
  /** Restarts into the downloaded update; owned by `main.ts`, which also closes this tray. */
  readonly install: Effect.Effect<void>
}

/** The tray icon with its menu; the window hides there when closed. */
export class Tray extends Context.Service<
  Tray,
  {
    /** Shows the icon and keeps its menu in step with the update state while the scope lives. */
    readonly create: (actions: TrayActions) => Effect.Effect<void, never, Scope.Scope>
    /** Removes the icon, e.g. before restarting into an update. */
    readonly hide: Effect.Effect<void>
    /** Puts the icon back after `hide`, e.g. when the update failed to install. */
    readonly show: Effect.Effect<void>
  }
>()("fsd-tools/desktop/Tray") {}

export const make = (iconPath: string) =>
  Effect.gen(function* () {
    const app = yield* ElectronApp
    const window = yield* MainWindow
    const updates = yield* DesktopUpdates
    // Kept here so it isn't garbage collected, which would remove the icon.
    const trayRef = yield* Ref.make(Option.none<Electron.Tray>())
    const actionsRef = yield* Ref.make<TrayActions>({ install: Effect.void })

    const run = (effect: Effect.Effect<void>) => () => Effect.runFork(effect)

    /** The update entry of the tray menu, like the update button in the tool strip. */
    const updateItem = (state: UpdateState, actions: TrayActions): Electron.MenuItemConstructorOptions => {
      const { status, version, percent } = state
      switch (status) {
        case "available":
          return { label: `Update ${version} laden`, click: run(updates.download) }
        case "downloading":
          return { label: `Update ${version ?? ""} wird geladen (${percent ?? 0} %)`, enabled: false }
        case "ready":
          return { label: `Neu starten, um ${version} zu installieren`, click: run(actions.install) }
        case "error":
          return version
            ? { label: `Update ${version} erneut laden`, click: run(updates.download) }
            : { label: "Nach Updates suchen", click: run(updates.check) }
        case "checking":
          return { label: "Suche nach Updates …", enabled: false }
        case "unsupported":
          return { label: "Updates nur in der installierten App", enabled: false }
        default:
          return { label: "Nach Updates suchen", click: run(updates.check) }
      }
    }

    const refreshMenu = Effect.gen(function* () {
      const tray = yield* Ref.get(trayRef)
      if (Option.isNone(tray)) return
      const state = yield* updates.state
      const actions = yield* Ref.get(actionsRef)
      tray.value.setContextMenu(
        Electron.Menu.buildFromTemplate([
          { label: "FSD Tools öffnen", click: run(window.show) },
          { type: "separator" },
          updateItem(state, actions),
          { type: "separator" },
          { label: "Beenden", click: run(app.quit) },
        ]),
      )
    })

    const show = Effect.gen(function* () {
      if (Option.isSome(yield* Ref.get(trayRef))) return
      const tray = new Electron.Tray(iconPath)
      tray.setToolTip("FSD Tools")
      tray.on("click", run(window.show))
      yield* Ref.set(trayRef, Option.some(tray))
      yield* refreshMenu
    })

    const hide = Ref.getAndSet(trayRef, Option.none()).pipe(
      Effect.map(Option.map((tray) => tray.destroy())),
      Effect.asVoid,
    )

    const create = (actions: TrayActions) =>
      Effect.gen(function* () {
        yield* Ref.set(actionsRef, actions)
        yield* show
        yield* updates.changes.pipe(Stream.runForEach(() => refreshMenu), Effect.forkScoped)
      })

    return Tray.of({ create, hide, show })
  })

export const layer = (iconPath: string) => Layer.effect(Tray, make(iconPath))
