import { useEffect, useState } from "react"

export type UpdateState = {
  status: "idle" | "checking" | "available" | "downloading" | "ready" | "latest" | "error" | "unsupported"
  version?: string
  percent?: number
  error?: string
}

interface DesktopApi {
  version: () => Promise<string>
  updates: {
    get: () => Promise<UpdateState>
    check: () => Promise<void>
    install: () => Promise<void>
    subscribe: (listener: (state: UpdateState) => void) => () => void
  }
  serveApi: (handler: (route: string, body: Record<string, unknown>) => unknown) => () => void
  /** Colors of the Windows buttons in the title bar. */
  setTitleBar: (colors: { color: string; symbolColor: string }) => void
}

/** Thrown by an API handler to answer with that HTTP status. */
export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** The desktop shell (electron/preload.cjs); undefined in the browser. */
export const desktop = (window as { desktop?: DesktopApi }).desktop

/** The update state of the desktop app; undefined in the browser. */
export function useUpdateState() {
  const [state, setState] = useState<UpdateState>()
  useEffect(() => {
    if (!desktop) return
    desktop.updates.get().then(setState)
    return desktop.updates.subscribe(setState)
  }, [])
  return state
}

export function useAppVersion() {
  const [version, setVersion] = useState<string>()
  useEffect(() => {
    desktop?.version().then(setVersion)
  }, [])
  return version
}
