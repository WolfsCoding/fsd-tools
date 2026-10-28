import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Ref from "effect/Ref"
import { BrowserWindow, shell } from "electron"
import type { TitleBarColors } from "../../src/contracts/desktop"
import { DesktopState } from "./DesktopState"

export interface MainWindowConfig {
  /** What the window loads: the Vite dev server or the app's own origin. */
  readonly url: string
  /** Links starting with it stay in the app; others open in the browser. */
  readonly ownOrigin: string
  readonly preload: string
}

/** The one window of the app. Closing it hides it to the tray; `show` brings it back or creates it anew. */
export class MainWindow extends Context.Service<
  MainWindow,
  {
    readonly current: Effect.Effect<Option.Option<BrowserWindow>>
    readonly show: Effect.Effect<void>
    readonly hide: Effect.Effect<void>
    /** Sends to the page; nothing happens without a window. */
    readonly send: (channel: string, payload: unknown) => Effect.Effect<void>
    readonly setTitleBarOverlay: (colors: TitleBarColors) => Effect.Effect<void>
  }
>()("fsd-tools/desktop/MainWindow") {}

export const make = (config: MainWindowConfig) =>
  Effect.gen(function* () {
    const { quitting } = yield* DesktopState
    const windowRef = yield* Ref.make(Option.none<BrowserWindow>())
    const isOwn = (url: string) => url.startsWith(config.ownOrigin)

    const create = Effect.gen(function* () {
      const win = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 800,
        minHeight: 500,
        backgroundColor: "#09090b",
        autoHideMenuBar: true,
        // No title bar: the Windows buttons sit at the right of the tab bar, like in the Explorer.
        // Height and colors match the tab bar (h-11, --titlebar, --strip-foreground).
        titleBarStyle: "hidden",
        titleBarOverlay: { color: "#1e1f22", symbolColor: "#c3c5cb", height: 44 },
        show: false,
        webPreferences: { preload: config.preload },
      })
      win.removeMenu()
      win.once("ready-to-show", () => win.show())

      // Links to other sites open in the browser, not in the app.
      win.webContents.setWindowOpenHandler(({ url }) => {
        if (!isOwn(url)) void shell.openExternal(url)
        return { action: "deny" }
      })
      win.webContents.on("will-navigate", (event, url) => {
        if (isOwn(url)) return
        event.preventDefault()
        void shell.openExternal(url)
      })
      win.webContents.on("before-input-event", (_, input) => {
        if (input.type === "keyDown" && (input.key === "F12" || (input.control && input.shift && input.key === "I")))
          win.webContents.toggleDevTools()
      })
      // The X hides the window to the tray; only "Beenden" there (or an update restart) quits.
      win.on("close", (event) => {
        if (Ref.getUnsafe(quitting)) return
        event.preventDefault()
        win.hide()
      })
      win.on("closed", () => {
        Effect.runSync(Ref.set(windowRef, Option.none()))
      })

      yield* Ref.set(windowRef, Option.some(win))
      void win.loadURL(config.url)
      return win
    })

    const current = Ref.get(windowRef)

    const withWindow = (f: (win: BrowserWindow) => void) =>
      current.pipe(Effect.map(Option.map(f)), Effect.asVoid)

    return MainWindow.of({
      current,
      show: current.pipe(
        Effect.flatMap(
          Option.match({
            onNone: () => create.pipe(Effect.asVoid),
            onSome: (win) =>
              Effect.sync(() => {
                if (win.isMinimized()) win.restore()
                win.show()
                win.focus()
              }),
          }),
        ),
      ),
      hide: withWindow((win) => win.hide()),
      send: (channel, payload) => withWindow((win) => win.webContents.send(channel, payload)),
      setTitleBarOverlay: (colors) => withWindow((win) => win.setTitleBarOverlay(colors)),
    })
  })

export const layer = (config: MainWindowConfig) => Layer.effect(MainWindow, make(config))
