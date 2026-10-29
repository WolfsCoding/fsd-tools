import { Component, useEffect, useRef, useState, type DragEvent, type PointerEvent, type ReactNode } from "react"
import {
  Link,
  MemoryRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  UNSAFE_DataRouterContext as DataRouterContext,
  UNSAFE_DataRouterNavigationContext as DataRouterNavigationContext,
  UNSAFE_DataRouterStateContext as DataRouterStateContext,
  UNSAFE_LocationContext as LocationContext,
  UNSAFE_RouteContext as RouteContext,
  useLocation,
  useNavigate,
} from "react-router"
import { TriangleAlertIcon } from "lucide-react"
import { cn } from "cn"
import { Explorer, EXPLORER_CARDS, EXPLORER_CARD } from "@/components/explorer"
import { FeatureRoute } from "@/components/feature-routes"
import { Hint } from "@/components/hint"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { features } from "@/features/registry"
import { useIsMobile } from "@/hooks/use-mobile"
import { usePageTransition } from "@/hooks/use-page-transition"
import { PaneContext } from "@/hooks/use-pane"
import { useEnabledFeatures } from "@/hooks/use-settings"
import { TAB_DRAG_TYPE, useTabs } from "@/hooks/use-tabs"
import { useAtom } from "@effect/atom-react"
import * as Schema from "effect/Schema"
import { stored } from "@/lib/storage"

const DEFAULT_RATIO = 0.5
const ratioAtom = stored("layout:split-ratio", Schema.Number, DEFAULT_RATIO)
const MIN_RATIO = 0.2
const MAX_RATIO = 0.8
const KEY_STEPS: Partial<Record<string, number>> = { ArrowLeft: -0.05, ArrowRight: 0.05 }

const ISLAND = "relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl bg-island"

/**
 * The active tab's page and, if the tab has a split view, a second page right
 * of it. The second page navigates on its own; the tab remembers where.
 */
export function SplitLayout({ children }: { children: ReactNode }) {
  const { tabs, activeId, splitWith } = useTabs()
  const isMobile = useIsMobile()
  const active = tabs.find((t) => t.id === activeId)
  // Phones have no room for two pages; the split returns on a wider screen.
  const split = isMobile ? undefined : active?.split
  const [ratio, setRatio] = useAtom(ratioAtom)
  const [resizing, setResizing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  usePageTransition(pageRef)
  const [dropSide, setDropSide] = useState<"left" | "right" | null>(null)

  // A drag can end anywhere, e.g. cancelled with Esc or dropped back on the tab bar.
  useEffect(() => {
    const clear = () => setDropSide(null)
    window.addEventListener("dragend", clear)
    window.addEventListener("drop", clear)
    return () => {
      window.removeEventListener("dragend", clear)
      window.removeEventListener("drop", clear)
    }
  }, [])

  /** Tabs dragged onto the page merge into a split view; capture phase, so drop areas in pages don't take them. */
  function onTabDragOver(e: DragEvent<HTMLDivElement>) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (isMobile || tabs.length < 2 || !rect || !e.dataTransfer.types.includes(TAB_DRAG_TYPE)) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = "move"
    const side = e.clientX < rect.left + rect.width / 2 ? "left" : "right"
    if (side !== dropSide) setDropSide(side)
  }

  function onTabDrop(e: DragEvent<HTMLDivElement>) {
    const id = e.dataTransfer.getData(TAB_DRAG_TYPE)
    if (!id || !dropSide) return
    e.preventDefault()
    e.stopPropagation()
    splitWith(id, dropSide)
    setDropSide(null)
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    setResizing(true)
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!resizing || !rect) return
    resizeTo((e.clientX - rect.left) / rect.width)
  }

  function resizeTo(next: number) {
    setRatio(Math.round(Math.min(MAX_RATIO, Math.max(MIN_RATIO, next)) * 1000) / 1000)
  }

  return (
    <div
      ref={containerRef}
      onDragOverCapture={onTabDragOver}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropSide(null)
      }}
      onDropCapture={onTabDrop}
      className={cn("relative flex min-h-0 min-w-0 flex-1", resizing && "select-none")}
    >
      {dropSide && (
        <div className="pointer-events-none absolute inset-0 z-50 flex gap-1">
          {(["left", "right"] as const).map((side) => (
            <div
              key={side}
              className={cn(
                "flex flex-1 items-center justify-center rounded-xl border-2 border-dashed text-sm font-medium transition-colors duration-150",
                side === dropSide
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-transparent text-transparent",
              )}
            >
              {side === "left" ? "Links öffnen" : "Rechts öffnen"}
            </div>
          ))}
        </div>
      )}
      <main
        style={split ? { flex: `0 0 calc(${ratio * 100}% - 2px)` } : undefined}
        className={cn(ISLAND, "flex-1")}
      >
        <div ref={pageRef} className="flex min-h-0 min-w-0 flex-1 flex-col">
          {children}
        </div>
      </main>
      {split !== undefined && active && (
        <>
          {/* Also the gap between the islands. */}
          <Hint label="Ziehen oder Pfeiltasten zum Anpassen, Doppelklick teilt gleichmäßig">
            <div
              role="separator"
              tabIndex={0}
              aria-orientation="vertical"
              aria-label="Split View anpassen"
              aria-valuenow={Math.round(ratio * 100)}
              aria-valuemin={MIN_RATIO * 100}
              aria-valuemax={MAX_RATIO * 100}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={() => setResizing(false)}
              onPointerCancel={() => setResizing(false)}
              onDoubleClick={() => setRatio(DEFAULT_RATIO)}
              onKeyDown={(e) => {
                const step = KEY_STEPS[e.key]
                if (!step || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
                e.preventDefault()
                resizeTo(ratio + step)
              }}
              className="group flex w-1 shrink-0 cursor-col-resize justify-center outline-none animate-in fade-in-0 duration-300"
            >
              <span
                className={cn(
                  "my-3 w-0.5 rounded-full transition-colors group-hover:bg-primary/60 group-focus-visible:bg-primary",
                  resizing && "bg-primary",
                )}
              />
            </div>
          </Hint>
          {/* Keyed by tab, so every tab's split pane keeps its own history. */}
          <SplitPane key={active.id} path={split} />
        </>
      )}
    </div>
  )
}

function SplitPane({ path }: { path: string }) {
  const { featureOf } = useTabs()

  return (
    <section
      aria-label="Split View"
      className={cn(ISLAND, "flex-1 animate-in duration-300 ease-out-quint fade-in-0 slide-in-from-right-6")}
    >
      <PaneContext value="split">
        <PaneErrorBoundary key={featureOf(path)?.path}>
          <IsolatedRouter path={path}>
            <Routes>
              <Route element={<PaneSync path={path} />}>
                <Route index element={<PaneHome />} />
                {features.map((f) => (
                  <Route
                    key={f.path}
                    path={`${f.path}/*`}
                    element={<FeatureRoute path={f.path}>{f.element}</FeatureRoute>}
                  />
                ))}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </IsolatedRouter>
        </PaneErrorBoundary>
      </PaneContext>
    </section>
  )
}

const ROOT_ROUTE = { outlet: null, matches: [], isDataRoute: false }

/**
 * A router of its own for the split pane, so its links and navigation move only
 * that pane. React Router allows no router inside another, so the app router's
 * contexts are cleared first.
 */
function IsolatedRouter({ path, children }: { path: string; children: ReactNode }) {
  return (
    <DataRouterContext.Provider value={null}>
      <DataRouterStateContext.Provider value={null}>
        <DataRouterNavigationContext.Provider value={null}>
          <LocationContext.Provider value={null!}>
            <RouteContext.Provider value={ROOT_ROUTE}>
              <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
            </RouteContext.Provider>
          </LocationContext.Provider>
        </DataRouterNavigationContext.Provider>
      </DataRouterStateContext.Provider>
    </DataRouterContext.Provider>
  )
}

/** Keeps an error in the split pane from taking down the whole app. */
class PaneErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false }

  static getDerivedStateFromError() {
    return { error: true }
  }

  render() {
    if (!this.state.error) return this.props.children
    return <PaneError />
  }
}

function PaneError() {
  const { closeSplit } = useTabs()
  return (
    <Empty className="flex-1">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <TriangleAlertIcon />
        </EmptyMedia>
        <EmptyTitle>Seite konnte nicht angezeigt werden</EmptyTitle>
        <EmptyDescription>Die linke Seite bleibt offen.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" onClick={closeSplit}>
          Split View schließen
        </Button>
      </EmptyContent>
    </Empty>
  )
}

/**
 * Keeps the pane's route and the tab's `split` in step: navigating in the pane
 * updates the tab, a new `path` from outside (picker, swap) moves the pane.
 */
function PaneSync({ path }: { path: string }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { setSplitPath } = useTabs()
  const current = location.pathname + location.search
  const last = useRef(current)
  const pageRef = useRef<HTMLDivElement>(null)
  usePageTransition(pageRef)

  useEffect(() => {
    if (current === last.current) return
    last.current = current
    setSplitPath(current)
  }, [current, setSplitPath])

  useEffect(() => {
    if (path === last.current) return
    last.current = path
    navigate(path, { replace: true })
  }, [path, navigate])

  return (
    <div ref={pageRef} className="flex min-h-0 min-w-0 flex-1 flex-col">
      <Outlet />
    </div>
  )
}

/** The pane without a page: the areas to pick from. */
function PaneHome() {
  const { enabledFeatures } = useEnabledFeatures()
  return (
    <Explorer title="Bereiche">
      <nav className={EXPLORER_CARDS}>
        {enabledFeatures.map((f) => (
          <Link key={f.path} to={`/${f.path}`} className={EXPLORER_CARD}>
            <span className="flex items-center gap-2 text-sm font-medium">
              <f.icon className="size-4 shrink-0 text-muted-foreground" />
              {f.title}
            </span>
            {f.description && <span className="truncate text-xs text-muted-foreground">{f.description}</span>}
          </Link>
        ))}
      </nav>
    </Explorer>
  )
}
