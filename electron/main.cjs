// Desktop shell: serves the built app from `dist/` under `app://fsd-tools` and keeps it up to date
// from the GitHub releases (see .github/workflows/release.yml).
const { app, BrowserWindow, ipcMain, net, protocol, shell } = require("electron")
const { autoUpdater } = require("electron-updater")
const fs = require("node:fs")
const path = require("node:path")
const { pathToFileURL } = require("node:url")
const { startApi } = require("./api.cjs")

const SCHEME = "app"
const ORIGIN = `${SCHEME}://fsd-tools`
const DIST = path.join(__dirname, "..", "dist")
// Set by `bun run desktop` to load the Vite dev server instead.
const DEV_URL = process.env.ELECTRON_DEV_URL
const UPDATE_INTERVAL = 60 * 60 * 1000

// A fixed, standard origin keeps localStorage (all the app's data) the same across updates.
protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

if (!app.requestSingleInstanceLock()) app.quit()

/** @type {BrowserWindow | null} */
let win = null

function createWindow() {
  win = new BrowserWindow({
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
    webPreferences: { preload: path.join(__dirname, "preload.cjs") },
  })
  win.removeMenu()
  win.once("ready-to-show", () => win?.show())

  // Links to other sites open in the browser, not in the app.
  const isOwn = (url) => url.startsWith(DEV_URL ?? ORIGIN)
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!isOwn(url)) shell.openExternal(url)
    return { action: "deny" }
  })
  win.webContents.on("will-navigate", (event, url) => {
    if (isOwn(url)) return
    event.preventDefault()
    shell.openExternal(url)
  })
  win.webContents.on("before-input-event", (_, input) => {
    if (input.type === "keyDown" && (input.key === "F12" || (input.control && input.shift && input.key === "I")))
      win?.webContents.toggleDevTools()
  })
  win.on("closed", () => (win = null))

  win.loadURL(DEV_URL ?? `${ORIGIN}/`)
}

/** Serves `dist/`, falling back to index.html for the app's own paths (`/fsu/...`). */
function serveDist() {
  protocol.handle(SCHEME, (request) => {
    const { pathname } = new URL(request.url)
    const file = path.normalize(path.join(DIST, decodeURIComponent(pathname)))
    const inDist = file.startsWith(DIST + path.sep)
    const exists = inDist && fs.existsSync(file) && fs.statSync(file).isFile()
    return net.fetch(pathToFileURL(exists ? file : path.join(DIST, "index.html")).toString())
  })
}

// --- Updates ---------------------------------------------------------------

/** @type {{ status: "idle" | "checking" | "available" | "downloading" | "ready" | "latest" | "error" | "unsupported", version?: string, percent?: number, error?: string }} */
let updateState = { status: app.isPackaged ? "idle" : "unsupported" }

function setUpdateState(next) {
  updateState = next
  win?.webContents.send("updates:state", updateState)
}

function checkForUpdates() {
  if (!app.isPackaged) return
  if (updateState.status === "downloading" || updateState.status === "ready") return
  autoUpdater.checkForUpdates().catch(() => {})
}

function setupUpdates() {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on("checking-for-update", () => setUpdateState({ status: "checking" }))
  autoUpdater.on("update-available", (info) => setUpdateState({ status: "available", version: info.version }))
  autoUpdater.on("update-not-available", () => setUpdateState({ status: "latest" }))
  autoUpdater.on("download-progress", (p) =>
    setUpdateState({ status: "downloading", version: updateState.version, percent: Math.round(p.percent) }),
  )
  autoUpdater.on("update-downloaded", (info) => setUpdateState({ status: "ready", version: info.version }))
  autoUpdater.on("error", (err) => setUpdateState({ status: "error", error: String(err?.message ?? err) }))

  ipcMain.handle("app:version", () => app.getVersion())
  ipcMain.handle("updates:get", () => updateState)
  ipcMain.handle("updates:check", () => checkForUpdates())
  ipcMain.handle("updates:install", () => {
    if (updateState.status === "ready") autoUpdater.quitAndInstall()
  })

  checkForUpdates()
  setInterval(checkForUpdates, UPDATE_INTERVAL)
}

app.on("second-instance", () => {
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.focus()
})

// The app sets the Windows buttons' colors to follow its theme and darken under dialogs.
ipcMain.on("window:title-bar", (_, { color, symbolColor }) => {
  win?.setTitleBarOverlay({ color, symbolColor })
})

app.whenReady().then(() => {
  serveDist()
  setupUpdates()
  createWindow()
  startApi(() => win)
})

app.on("window-all-closed", () => app.quit())
