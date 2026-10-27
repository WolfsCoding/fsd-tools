// Exposes the desktop shell to the app as `window.desktop` (typed in src/lib/desktop.ts).
const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("desktop", {
  version: () => ipcRenderer.invoke("app:version"),
  updates: {
    get: () => ipcRenderer.invoke("updates:get"),
    check: () => ipcRenderer.invoke("updates:check"),
    download: () => ipcRenderer.invoke("updates:download"),
    install: () => ipcRenderer.invoke("updates:install"),
    /** Calls `listener` on every change; returns the unsubscribe. */
    subscribe: (listener) => {
      const handler = (_, state) => listener(state)
      ipcRenderer.on("updates:state", handler)
      return () => ipcRenderer.removeListener("updates:state", handler)
    },
  },
  /** Colors of the Windows buttons, `{ color, symbolColor }`. */
  setTitleBar: (colors) => ipcRenderer.send("window:title-bar", colors),
  /** Answers the local API (electron/api.cjs) with `handler(route, body)`; returns the unsubscribe. */
  serveApi: (handler) => {
    const listener = async (_, { id, route, body }) => {
      try {
        ipcRenderer.send("api:response", { id, ok: true, data: await handler(route, body) })
      } catch (err) {
        ipcRenderer.send("api:response", { id, ok: false, status: err?.status, error: String(err?.message ?? err) })
      }
    }
    ipcRenderer.on("api:request", listener)
    return () => ipcRenderer.removeListener("api:request", listener)
  },
})
