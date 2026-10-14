import { Component, useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react"
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
import { ArrowLeftRightIcon, ChevronDownIcon, TriangleAlertIcon, XIcon } from "lucide-react"
import { cn } from "cn"
import { Explorer, EXPLORER_LIST, EXPLORER_ROW } from "@/components/explorer"
import { FeatureRoute } from "@/components/feature-routes"
import { Hint } from "@/components/hint"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { features } from "@/features/registry"
import { useIsMobile } from "@/hooks/use-mobile"
import { PaneContext } from "@/hooks/use-pane"
import { useEnabledFeatures } from "@/hooks/use-settings"
import { useTabs } from "@/hooks/use-tabs"
import { useLocalStorage } from "@/lib/local-storage"

const RATIO_KEY = "layout:split-ratio"
const DEFAULT_RATIO = 0.5
const MIN_RATIO = 0.2
const MAX_RATIO = 0.8

const ISLAND = "relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl bg-island"

/**
 * The active tab's page and, if the tab has a split view, a second page right
 * of it. The second page navigates on its own; the tab remembers where.
 */
export function SplitLayout({ children }: { children: ReactNode }) {
  const { tabs, activeId } = useTabs()
  const isMobile = useIsMobile()
  const active = tabs.find((t) => t.id === activeId)
  // Phones have no room for two pages; the split returns on a wider screen.
  const split = isMobile ? undefined : active?.split
  const [ratio, setRatio] = useLocalStorage(RATIO_KEY, DEFAULT_RATIO)
  const [resizing, setResizing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    setResizing(true)
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!resizing || !rect) return
    const next = (e.clientX - rect.left) / rect.width
    setRatio(Math.round(Math.min(MAX_RATIO, Math.max(MIN_RATIO, next)) * 1000) / 1000)
  }

  return (
    <div ref={containerRef} className={cn("flex min-h-0 min-w-0 flex-1", resizing && "select-none")}>
      <main
        style={split ? { flex: `0 0 calc(${ratio * 100}% - 2px)` } : undefined}
        className={cn(ISLAND, "flex-1")}
      >
        {children}
      </main>
      {split !== undefined && active && (
        <>
          {/* Also the gap between the islands. */}
          <Hint label="Ziehen zum Anpassen, Doppelklick teilt gleichmäßig">
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Split View anpassen"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={() => setResizing(false)}
              onPointerCancel={() => setResizing(false)}
              onDoubleClick={() => setRatio(DEFAULT_RATIO)}
              className="group flex w-1 shrink-0 cursor-col-resize justify-center"
            >
              <span
                className={cn(
                  "my-3 w-0.5 rounded-full transition-colors group-hover:bg-primary/60",
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
  const { featureOf, titleOfPath, setSplitPath, swapSplit, closeSplit } = useTabs()
  const { enabledFeatures } = useEnabledFeatures()
  const feature = featureOf(path)

  return (
    <section aria-label="Split View" className={cn(ISLAND, "flex-1")}>
      <header className="flex h-10 shrink-0 items-center gap-1 border-b px-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="min-w-0 justify-start">
              {feature && <feature.icon />}
              <span className="truncate">{feature ? titleOfPath(path) : "Bereich wählen"}</span>
              <ChevronDownIcon className="text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            <DropdownMenuLabel>Im Split View öffnen</DropdownMenuLabel>
            {enabledFeatures.map((f) => (
              <DropdownMenuItem key={f.path} onSelect={() => setSplitPath(`/${f.path}`)}>
                <f.icon />
                <span className="truncate">{f.title}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex-1" />
        <Hint label="Seiten tauschen">
          <Button variant="ghost" size="icon-sm" onClick={swapSplit} aria-label="Seiten tauschen">
            <ArrowLeftRightIcon />
          </Button>
        </Hint>
        <Hint label="Split View schließen">
          <Button variant="ghost" size="icon-sm" onClick={closeSplit} aria-label="Split View schließen">
            <XIcon />
          </Button>
        </Hint>
      </header>
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
    return (
      <Empty className="flex-1">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlertIcon />
          </EmptyMedia>
          <EmptyTitle>Seite konnte nicht angezeigt werden</EmptyTitle>
          <EmptyDescription>Wähle oben einen anderen Bereich oder schließe den Split View.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
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
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <Outlet />
    </div>
  )
}

/** The pane without a page: the areas to pick from. */
function PaneHome() {
  const { enabledFeatures } = useEnabledFeatures()
  return (
    <Explorer title="Bereiche">
      <nav className={EXPLORER_LIST}>
        {enabledFeatures.map((f) => (
          <Link key={f.path} to={`/${f.path}`} className={EXPLORER_ROW}>
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
