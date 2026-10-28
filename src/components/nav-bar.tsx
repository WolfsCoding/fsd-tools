import { Fragment, useEffect, useRef, useState, type ComponentType } from "react"
import { useNavigate } from "react-router"
import { cn } from "cn"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  ChevronRightIcon,
  MonitorIcon,
  RotateCwIcon,
  SearchIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Hint } from "@/components/hint"
import { useCommandPalette } from "@/hooks/use-command-palette"
import { routeOf, useTabs, type Tab } from "@/hooks/use-tabs"

const NAV_BUTTON =
  "flex size-9 shrink-0 items-center justify-center rounded-lg text-strip-foreground outline-none transition-[background-color,color,scale] duration-150 hover:bg-strip-hover active:scale-90 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:text-strip-foreground/35 [&_svg]:size-5"

const CRUMB =
  "px-1.5 py-0.5 transition-colors animate-in duration-200 ease-out-quint fade-in-0 slide-in-from-left-1"

type History ={ back: string[]; forward: string[] }

/**
 * The toolbar under the tabs, like Explorer's: back, forward, up and reload, the
 * address bar with the active page's path, and search (the command palette).
 */
export function NavBar({ onReload }: { onReload: () => void }) {
  const navigate = useNavigate()
  const { tabs, activeId, featureOf, trailOfPath } = useTabs()
  const active = tabs.find((t) => t.id === activeId)
  const history = useTabHistory(active)
  const feature = active && featureOf(active.path)
  const up = active && feature ? (trailOfPath(active.path).at(-1)?.to ?? parentOf(active.path, `/${feature.path}`)) : undefined

  return (
    <div className="flex h-12 shrink-0 items-center gap-1 bg-frame px-2">
      <div className="hidden items-center gap-1 sm:flex">
        <NavButton label="Zurück" icon={ArrowLeftIcon} disabled={!history.canBack} onClick={history.back} />
        <NavButton label="Vorwärts" icon={ArrowRightIcon} disabled={!history.canForward} onClick={history.forward} />
        <NavButton label="Nach oben" icon={ArrowUpIcon} disabled={!up} onClick={() => up && navigate(up)} />
        <NavButton label="Aktualisieren" icon={RotateCwIcon} disabled={!active} onClick={onReload} />
      </div>
      <AddressBar />
      <SearchButton />
    </div>
  )
}

/** The route one level up within its feature, e.g. "/fsu/post" → "/fsu"; none at the feature's root. */
function parentOf(path: string, root: string) {
  const route = routeOf(path)
  if (route === root) return undefined
  return route.slice(0, route.lastIndexOf("/")) || root
}

/** Back and forward per tab, like Explorer's, kept while the app is open. */
function useTabHistory(active: Tab | undefined) {
  const navigate = useNavigate()
  const [histories, setHistories] = useState<Record<string, History>>({})
  const last = useRef<{ id: string; path: string } | null>(null)
  // Set while going back or forward, so that step isn't recorded as a new one.
  const stepping = useRef(false)

  useEffect(() => {
    if (!active) return
    const prev = last.current
    last.current = { id: active.id, path: active.path }
    if (stepping.current) {
      stepping.current = false
      return
    }
    if (prev?.id !== active.id || prev.path === active.path) return
    setHistories((h) => ({
      ...h,
      [active.id]: { back: [...(h[active.id]?.back ?? []), prev.path].slice(-50), forward: [] },
    }))
  }, [active])

  const history = active ? histories[active.id] : undefined

  function step(from: "back" | "forward") {
    const target = history?.[from].at(-1)
    if (!active || !history || !target) return
    const to = from === "back" ? "forward" : "back"
    stepping.current = true
    setHistories((h) => ({
      ...h,
      [active.id]: { [from]: history[from].slice(0, -1), [to]: [...history[to], active.path] } as History,
    }))
    navigate(target)
  }

  return {
    canBack: !!history?.back.length,
    canForward: !!history?.forward.length,
    back: () => step("back"),
    forward: () => step("forward"),
  }
}

function NavButton({
  label,
  icon: Icon,
  disabled,
  onClick,
}: {
  label: string
  icon: ComponentType
  disabled?: boolean
  onClick: () => void
}) {
  // A disabled button gets no pointer events, so the hint sits on a wrapper.
  return (
    <Hint label={label}>
      <span className="flex">
        <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className={NAV_BUTTON}>
          <Icon />
        </button>
      </span>
    </Hint>
  )
}

/**
 * FSD Tools › feature › page. Clicking the free space turns it into a text field
 * for typing a path, like Explorer's address bar.
 */
function AddressBar() {
  const navigate = useNavigate()
  const { tabs, activeId, featureOf, titleOf, trailOfPath } = useTabs()
  const [editing, setEditing] = useState(false)
  const active = tabs.find((t) => t.id === activeId)
  const feature = active && featureOf(active.path)
  const pageTitle = active && feature && titleOf(active) !== feature.title ? titleOf(active) : undefined
  const Icon = feature?.icon ?? MonitorIcon

  // Strg+L like Explorer's address bar.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!e.ctrlKey || e.altKey || e.shiftKey || e.key?.toLowerCase() !== "l") return
      e.preventDefault()
      setEditing(true)
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  const crumbs: { label: string; to?: string }[] = [
    { label: "FSD Tools" },
    ...(feature ? [{ label: feature.title, to: `/${feature.path}` }] : []),
    ...(active && feature ? trailOfPath(active.path) : []),
    ...(pageTitle ? [{ label: pageTitle }] : []),
  ]

  if (editing) {
    return (
      <input
        autoFocus
        aria-label="Adresse"
        defaultValue={active?.path ?? "/"}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setEditing(false)
          if (e.key !== "Enter") return
          const value = e.currentTarget.value.trim()
          const path = value.startsWith("/") ? value : `/${value}`
          if (value && path !== "/" && !featureOf(path)) {
            toast.error(`Keine Seite unter ${path}`, { description: "Prüfe die Schreibweise, z. B. /notes." })
            return
          }
          setEditing(false)
          if (value) navigate(path)
        }}
        className="h-8 min-w-0 flex-1 rounded-lg border-b-2 border-primary bg-field px-3 text-xs text-foreground outline-none animate-in duration-150 fade-in-0"
      />
    )
  }

  return (
    <nav
      aria-label="Pfad"
      onClick={(e) => e.target === e.currentTarget && setEditing(true)}
      className="flex h-8 min-w-0 flex-1 cursor-text items-center gap-0.5 rounded-lg bg-field px-2 text-xs text-foreground transition-colors hover:bg-field-hover"
    >
      <Icon className="mr-1 size-4 shrink-0" />
      {/* Keyed by label, so a crumb that changes fades in. */}
      {crumbs.map((crumb, i) => (
        <Fragment key={`${i}:${crumb.label}`}>
          <ChevronRightIcon className="size-3.5 shrink-0 text-foreground/70" />
          {crumb.to ? (
            <button
              type="button"
              onClick={() => navigate(crumb.to!)}
              className={cn(CRUMB, "shrink-0 rounded-sm outline-none hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring")}
            >
              {crumb.label}
            </button>
          ) : (
            <span className={cn(CRUMB, i === crumbs.length - 1 ? "truncate" : "shrink-0")}>
              {crumb.label}
            </span>
          )}
        </Fragment>
      ))}
      <ChevronRightIcon className="size-3.5 shrink-0 text-foreground/70" />
    </nav>
  )
}

/** Looks like Explorer's search box; opens the command palette. */
function SearchButton() {
  const { setOpen } = useCommandPalette()
  return (
    <>
      <Hint label="Suchen">
        <button type="button" aria-label="Suchen" onClick={() => setOpen(true)} className={cn(NAV_BUTTON, "lg:hidden")}>
          <SearchIcon />
        </button>
      </Hint>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-8 w-72 shrink-0 items-center gap-2 rounded-lg bg-field px-3 text-xs text-muted-foreground outline-none transition-colors hover:bg-field-hover focus-visible:ring-2 focus-visible:ring-ring lg:flex xl:w-96"
      >
        <span className="flex-1 truncate text-left">FSD Tools durchsuchen</span>
        <SearchIcon className="size-4 shrink-0 text-foreground" />
      </button>
    </>
  )
}
