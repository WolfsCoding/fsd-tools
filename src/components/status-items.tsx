import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"

const StatusItemsContext = createContext<{
  target: HTMLElement | null
  setTarget: (el: HTMLElement | null) => void
} | null>(null)

export function StatusItemsProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  return (
    <StatusItemsContext.Provider value={{ target, setTarget }}>
      {children}
    </StatusItemsContext.Provider>
  )
}

/** Placeholder in the status bar where pages render their status items. */
export function StatusItemsSlot({ className }: { className?: string }) {
  const ctx = useContext(StatusItemsContext)
  return <div ref={ctx?.setTarget} className={className} />
}

/** Renders its children into the right side of the status bar, e.g. counts. */
export function StatusItems({ children }: { children: ReactNode }) {
  const target = useContext(StatusItemsContext)?.target
  return target ? createPortal(children, target) : null
}
