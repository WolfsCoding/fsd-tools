// Exposes the desktop shell to the page as `window.desktop` (src/contracts/desktop.ts).
import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron"
import type { ApiRequest, ApiResponse, DesktopBridge, UpdateState } from "../src/contracts/desktop"
import { IpcChannels } from "../src/contracts/ipc"

const bridge: DesktopBridge = {
  version: () => ipcRenderer.invoke(IpcChannels.appVersion),
  updates: {
    get: () => ipcRenderer.invoke(IpcChannels.updatesGet),
    check: () => ipcRenderer.invoke(IpcChannels.updatesCheck),
    download: () => ipcRenderer.invoke(IpcChannels.updatesDownload),
    install: () => ipcRenderer.invoke(IpcChannels.updatesInstall),
    subscribe: (listener) => {
      const handler = (_: IpcRendererEvent, state: UpdateState) => listener(state)
      ipcRenderer.on(IpcChannels.updatesState, handler)
      return () => ipcRenderer.removeListener(IpcChannels.updatesState, handler)
    },
  },
  setTitleBar: (colors) => ipcRenderer.send(IpcChannels.titleBar, colors),
  serveApi: (handler) => {
    const listener = async (_: IpcRendererEvent, { id, route, body }: ApiRequest) => {
      let response: ApiResponse
      try {
        response = { id, ...(await handler(route, body)) }
      } catch (error) {
        response = { id, ok: false, error: error instanceof Error ? error.message : String(error) }
      }
      ipcRenderer.send(IpcChannels.apiResponse, response)
    }
    ipcRenderer.on(IpcChannels.apiRequest, listener)
    return () => ipcRenderer.removeListener(IpcChannels.apiRequest, listener)
  },
}

contextBridge.exposeInMainWorld("desktop", bridge)
