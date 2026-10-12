import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"
import { cn } from "cn"
import { Hint } from "@/components/hint"
import { useIsMobile } from "@/hooks/use-mobile"
import { useLocalStorage } from "@/lib/local-storage"

const WIDTH_KEY = "layout:side-panel-width"
const DEFAULT_WIDTH = 384
const MIN_WIDTH = 280
const MAX_WIDTH = 640

const SidePanelContext = createContext<{
  target: HTMLElement | null
  setTarget: (el: HTMLElement | null) => void
  mounted: number
  setMounted: (update: (n: number) => number) => void
} | null>(null)

export function SidePanelProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [mounted, setMounted] = useState(0)
  return (
    <SidePanelContext.Provider value={{ target, setTarget, mounted, setMounted }}>
      {children}
    </SidePanelContext.Provider>
  )
}

/**
 * Island left of the editor that pages fill via `<SidePanel>`, like an IDE
 * tool window. Hidden while no page uses it; its width is resizable.
 */
export function SidePanelSlot() {
  const ctx = useContext(SidePanelContext)
  const [width, setWidth] = useLocalStorage(WIDTH_KEY, DEFAULT_WIDTH)
  const [resizing, setResizing] = useState(false)

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    setResizing(true)
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!resizing) return
    const left = e.currentTarget.parentElement!.getBoundingClientRect().left
    setWidth(Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX - left))))
  }

  return (
    <div
      style={{ width }}
      className={cn(
        "relative hidden shrink-0",
        ctx?.mounted && "md:flex",
        resizing && "select-none",
      )}
    >
      <aside
        ref={ctx?.setTarget}
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-island"
      />
      {/* Sits in the gap between the islands. */}
      <Hint label="Ziehen zum Anpassen, Doppelklick setzt zurück" side="right">
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Seitenleiste anpassen"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => setResizing(false)}
          onPointerCancel={() => setResizing(false)}
          onDoubleClick={() => setWidth(DEFAULT_WIDTH)}
          className="group absolute inset-y-0 -right-1 z-10 flex w-1 cursor-col-resize justify-center"
        >
          <span
            className={cn(
              "my-3 w-0.5 rounded-full transition-colors group-hover:bg-primary/60",
              resizing && "bg-primary",
            )}
          />
        </div>
      </Hint>
    </div>
  )
}

/**
 * Renders a page's list (notes, posts, …) into the side island. On phones it
 * renders in place instead; `mobileHidden` then hides it, e.g. while an item
 * is open.
 */
export function SidePanel({
  title,
  mobileHidden,
  mobileClassName,
  children,
}: {
  /** Accessible name of the panel. */
  title: string
  mobileHidden?: boolean
  /** Classes for the in-place panel on phones. */
  mobileClassName?: string
  children: ReactNode
}) {
  const ctx = useContext(SidePanelContext)
  const isMobile = useIsMobile()
  const setMounted = ctx?.setMounted

  useEffect(() => {
    if (isMobile || !setMounted) return
    setMounted((n) => n + 1)
    return () => setMounted((n) => n - 1)
  }, [isMobile, setMounted])

  const content = (
    <div role="region" aria-label={title} className="flex min-h-0 flex-1 flex-col">
      {children}
    </div>
  )

  if (isMobile) {
    return mobileHidden ? null : (
      <div className={cn("flex min-h-0 w-full flex-col", mobileClassName)}>
        {content}
      </div>
    )
  }
  return ctx?.target ? createPortal(content, ctx.target) : null
}
