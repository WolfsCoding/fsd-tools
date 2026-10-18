import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { useLocation, useNavigate } from "react-router"
import {
  ArrowLeftRightIcon,
  Columns2Icon,
  CopyIcon,
  PinIcon,
  RotateCcwIcon,
  XIcon,
} from "lucide-react"
import {
  useRegisterCommands,
  type CommandGroupDef,
} from "@/hooks/use-command-palette"
import { useEnabledFeatures } from "@/hooks/use-settings"
import {
  routeOf,
  TabsContext,
  type CloseScope,
  type Tab,
  type TabsContextValue,
} from "@/hooks/use-tabs"
import { useLocalStorage } from "@/lib/local-storage"

const TABS_KEY = "layout:tabs"

interface TabsState {
  tabs: Tab[]
  activeId: string | null
  /** Page titles by path, so inactive tabs keep their names. */
  titles: Record<string, string>
  /** Tab ids, most recently used first; closing a tab returns to the previous one. */
  recent: string[]
}

// null until the first tab opens; lets `/` tell "new user" from "closed all tabs".
const NO_STATE: TabsState | null = null
const EMPTY: TabsState = { tabs: [], activeId: null, titles: {}, recent: [] }

function withActive(state: TabsState, id: string | null): TabsState {
  if (!id) return { ...state, activeId: null }
  const recent = [id, ...(state.recent ?? []).filter((r) => r !== id)]
  return { ...state, activeId: id, recent: recent.slice(0, 50) }
}

/** Keeps pinned tabs in front without changing the order within each group. */
function pinnedFirst(tabs: Tab[]) {
  return [...tabs.filter((t) => t.pinned), ...tabs.filter((t) => !t.pinned)]
}

function insertAfter(tabs: Tab[], afterId: string | null, tab: Tab) {
  const index = tabs.findIndex((t) => t.id === afterId)
  const next = [...tabs]
  next.splice(index === -1 ? tabs.length : index + 1, 0, tab)
  return pinnedFirst(next)
}


/** Replaces the tabs and drops titles no open tab uses anymore. */
function withTabs(state: TabsState, tabs: Tab[]): TabsState {
  const paths = new Set(tabs.flatMap((t) => [t.path, ...(t.split ? [t.split] : [])].map(routeOf)))
  const titles = Object.fromEntries(
    Object.entries(state.titles).filter(([path]) => paths.has(path)),
  )
  return { ...state, tabs, titles }
}

function isEditable(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  )
}

/**
 * Editor-style tabs that follow the router: navigating inside a feature
 * updates the active tab, opening another feature opens (or focuses) its tab.
 */
export function TabsProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const { enabledFeatures } = useEnabledFeatures()
  const [stored, setStored] = useLocalStorage(TABS_KEY, NO_STATE)
  const [closed, setClosed] = useState<{ tab: Tab; index: number }[]>([])

  const featureOf = useCallback(
    (path: string) => {
      const route = routeOf(path)
      return enabledFeatures.find(
        (f) => route === `/${f.path}` || route.startsWith(`/${f.path}/`),
      )
    },
    [enabledFeatures],
  )

  const update = useCallback(
    (fn: (state: TabsState) => TabsState) =>
      setStored((prev) => fn(prev ?? EMPTY)),
    [setStored],
  )

  // Tabs of disabled features are hidden, not deleted, so they return when re-enabled.
  const state = stored ?? EMPTY
  const tabs = useMemo(
    () => state.tabs.filter((t) => featureOf(t.path)),
    [state.tabs, featureOf],
  )
  const activeId = tabs.some((t) => t.id === state.activeId)
    ? state.activeId
    : null
  const recent = state.recent

  const show = useCallback(
    (tab: Tab | undefined) => {
      update((s) => withActive(s, tab?.id ?? null))
      navigate(tab?.path ?? "/")
    },
    [update, navigate],
  )

  const onPathChange = useEffectEvent((path: string) => {
    const feature = featureOf(path)
    if (!feature) return
    let redirect: string | undefined
    // Decides on the stored state rather than this render's: StrictMode runs
    // the effect twice, and redirects can land before the last update renders.
    update((s) => {
      const tabs = s.tabs.filter((t) => featureOf(t.path))
      const active = tabs.find((t) => t.id === s.activeId)
      if (active?.path === path) return s
      const showInActive = (id: string) =>
        withTabs(s, s.tabs.map((t) => (t.id === id ? { ...t, path } : t)))

      // Navigating within a feature (including its redirects) stays in its tab.
      if (active && featureOf(active.path) === feature) {
        return showInActive(active.id)
      }
      const exact = tabs.find((t) => t.path === path)
      if (exact) return withActive(s, exact.id)
      // Opening a feature from the sidebar returns to its tab where it was left.
      const existing = tabs.find((t) => featureOf(t.path) === feature)
      if (existing && path === `/${feature.path}`) {
        redirect = existing.path
        return withActive(s, existing.id)
      }
      // Links into a feature with an open tab (e.g. a DNA-ID from an Akte) reuse
      // that tab unless it's pinned.
      if (existing && !existing.pinned) {
        return withActive(
          withTabs(s, s.tabs.map((t) => (t.id === existing.id ? { ...t, path } : t))),
          existing.id,
        )
      }
      // A feature without a tab replaces the active tab's page, unless that tab is pinned.
      if (active && !active.pinned) return showInActive(active.id)
      const tab = { id: crypto.randomUUID(), path }
      return withActive(withTabs(s, insertAfter(s.tabs, s.activeId, tab)), tab.id)
    })
    if (redirect) navigate(redirect, { replace: true })
  })

  // The query is part of the tab, so e.g. a search survives switching tabs.
  useEffect(() => onPathChange(pathname + search), [pathname, search])

  const activate = useCallback(
    (id: string) => show(tabs.find((t) => t.id === id)),
    [tabs, show],
  )

  const openInNewTab = useCallback(
    (path: string) => {
      const tab = { id: crypto.randomUUID(), path }
      update((s) =>
        withActive(withTabs(s, insertAfter(s.tabs, activeId, tab)), tab.id),
      )
      navigate(path)
    },
    [activeId, update, navigate],
  )

  const closeTabs = useCallback(
    (id: string, scope: CloseScope = "this") => {
      const index = tabs.findIndex((t) => t.id === id)
      if (index === -1) return
      const keep = (t: Tab, i: number) => {
        switch (scope) {
          case "this":
            return t.id !== id
          case "others":
            return t.id === id || !!t.pinned
          case "left":
            return i >= index || !!t.pinned
          case "right":
            return i <= index || !!t.pinned
          case "unpinned":
            return !!t.pinned
          case "all":
            return false
        }
      }
      const remaining = tabs.filter(keep)
      const removed = tabs.flatMap((tab, i) => (keep(tab, i) ? [] : [{ tab, index: i }]))
      if (removed.length === 0) return

      setClosed((prev) => [...prev, ...removed.reverse()].slice(-20))
      const removedIds = new Set(removed.map((r) => r.tab.id))
      update((s) => withTabs(s, s.tabs.filter((t) => !removedIds.has(t.id))))

      if (activeId && !removedIds.has(activeId)) return
      const previous = recent?.find((rid) =>
        remaining.some((t) => t.id === rid),
      )
      show(
        remaining.find((t) => t.id === previous) ??
          remaining[Math.min(index, remaining.length - 1)],
      )
    },
    [tabs, activeId, recent, update, show],
  )

  const reopenClosed = useCallback(() => {
    const last = closed.at(-1)
    if (!last) return
    setClosed((prev) => prev.slice(0, -1))
    update((s) => {
      const next = [...s.tabs]
      next.splice(Math.min(last.index, next.length), 0, last.tab)
      return withTabs(s, pinnedFirst(next))
    })
    show(last.tab)
  }, [closed, update, show])

  const togglePin = useCallback(
    (id: string) =>
      update((s) =>
        withTabs(
          s,
          pinnedFirst(
            s.tabs.map((t) => (t.id === id ? { ...t, pinned: !t.pinned } : t)),
          ),
        ),
      ),
    [update],
  )

  const duplicate = useCallback(
    (id: string) => {
      const source = tabs.find((t) => t.id === id)
      if (!source) return
      const tab = { id: crypto.randomUUID(), path: source.path, split: source.split }
      update((s) =>
        withActive(withTabs(s, insertAfter(s.tabs, id, tab)), tab.id),
      )
      navigate(tab.path)
    },
    [tabs, update, navigate],
  )

  const move = useCallback(
    (id: string, targetId: string, side: "before" | "after") => {
      if (id === targetId) return
      update((s) => {
        const tab = s.tabs.find((t) => t.id === id)
        if (!tab) return s
        const next = s.tabs.filter((t) => t.id !== id)
        const target = next.findIndex((t) => t.id === targetId)
        if (target === -1) return s
        next.splice(side === "before" ? target : target + 1, 0, tab)
        return withTabs(s, pinnedFirst(next))
      })
    },
    [update],
  )

  const cycle = useCallback(
    (offset: number) => {
      if (tabs.length < 2) return
      const index = tabs.findIndex((t) => t.id === activeId)
      show(tabs[(index + offset + tabs.length) % tabs.length])
    },
    [tabs, activeId, show],
  )

  const setTitle = useCallback(
    (path: string, title: string | undefined) =>
      update((s) => {
        if (s.titles[path] === title) return s
        const titles = { ...s.titles }
        if (title) titles[path] = title
        else delete titles[path]
        return { ...s, titles }
      }),
    [update],
  )

  const titleOfPath = useCallback(
    (path: string) => state.titles[routeOf(path)] ?? featureOf(path)?.title ?? routeOf(path),
    [state.titles, featureOf],
  )
  const titleOf = useCallback((tab: Tab) => titleOfPath(tab.path), [titleOfPath])

  /** Changes the active tab with `fn`; without an active tab nothing happens. */
  const updateActive = useCallback(
    (fn: (tab: Tab) => Tab) =>
      update((s) => withTabs(s, s.tabs.map((t) => (t.id === s.activeId ? fn(t) : t)))),
    [update],
  )

  const openSplit = useCallback(
    (path?: string) => updateActive((t) => ({ ...t, split: path ?? t.path })),
    [updateActive],
  )
  const closeSplit = useCallback(
    () => updateActive((t) => ({ ...t, split: undefined })),
    [updateActive],
  )
  const setSplitPath = useCallback(
    (path: string) => updateActive((t) => (t.split === undefined || t.split === path ? t : { ...t, split: path })),
    [updateActive],
  )
  const swapSplit = useCallback(() => {
    const active = tabs.find((t) => t.id === activeId)
    if (!active?.split) return
    updateActive((t) => ({ ...t, path: active.split!, split: active.path }))
    navigate(active.split)
  }, [tabs, activeId, updateActive, navigate])

  const splitWith = useCallback(
    (id: string, side: "left" | "right") => {
      const dragged = tabs.find((t) => t.id === id)
      const targetId =
        activeId !== id ? activeId : recent?.find((r) => r !== id && tabs.some((t) => t.id === r))
      const target = tabs.find((t) => t.id === targetId)
      if (!dragged || !target) return
      const merged: Tab =
        side === "left"
          ? { ...target, path: dragged.path, split: target.split ?? target.path }
          : { ...target, split: dragged.path }
      // Pages that no longer fit stay open where the dragged tab was.
      const displaced = target.split === undefined ? undefined : side === "left" ? target.path : target.split
      const leftovers = [dragged.split, displaced]
        .filter((p): p is string => p !== undefined)
        .map((path, i): Tab => (i === 0 ? { ...dragged, path, split: undefined } : { id: crypto.randomUUID(), path }))
      update((s) =>
        withActive(
          withTabs(
            s,
            pinnedFirst(
              s.tabs.flatMap((t) => (t.id === target.id ? [merged] : t.id === dragged.id ? leftovers : [t])),
            ),
          ),
          target.id,
        ),
      )
      navigate(merged.path)
    },
    [tabs, activeId, recent, update, navigate],
  )

  const unsplit = useCallback(() => {
    const active = tabs.find((t) => t.id === activeId)
    if (!active?.split) return
    const tab = { id: crypto.randomUUID(), path: active.split }
    update((s) =>
      withTabs(s, insertAfter(s.tabs.map((t) => (t.id === active.id ? { ...t, split: undefined } : t)), active.id, tab)),
    )
  }, [tabs, activeId, update])

  // Ctrl/⌘+click on any in-app link opens it in a new app tab instead of a
  // browser tab. Capture phase, so it runs before the router's link handler.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.button !== 0) return
      const href = (e.target as Element | null)
        ?.closest("a[href^='/']:not([href^='//'])")
        ?.getAttribute("href")
      if (!href) return
      e.preventDefault()
      openInNewTab(href)
    }
    window.addEventListener("click", onClick, true)
    return () => window.removeEventListener("click", onClick, true)
  }, [openInNewTab])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!e.altKey || e.ctrlKey || e.metaKey) return
      // e.code, because Alt changes e.key on macOS (Option+W types "∑").
      if (e.code === "KeyW" && !e.shiftKey && activeId) {
        e.preventDefault()
        closeTabs(activeId)
      } else if (e.code === "KeyT" && e.shiftKey) {
        e.preventDefault()
        reopenClosed()
      } else if (
        (e.key === "ArrowLeft" || e.key === "ArrowRight") &&
        !e.shiftKey &&
        !isEditable(e.target)
      ) {
        // Also keeps Alt+← from triggering the browser's back navigation.
        e.preventDefault()
        cycle(e.key === "ArrowLeft" ? -1 : 1)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [activeId, closeTabs, reopenClosed, cycle])

  const commandGroups = useMemo<CommandGroupDef[]>(() => {
    const active = tabs.find((t) => t.id === activeId)
    const actions: CommandGroupDef["items"] = []
    if (active) {
      actions.push(
        {
          id: "tabs:close",
          label: "Tab schließen",
          icon: XIcon,
          hint: "Alt W",
          onSelect: () => closeTabs(active.id),
        },
        {
          id: "tabs:close-others",
          label: "Andere Tabs schließen",
          icon: XIcon,
          onSelect: () => closeTabs(active.id, "others"),
        },
        {
          id: "tabs:close-all",
          label: "Alle Tabs schließen",
          icon: XIcon,
          onSelect: () => closeTabs(active.id, "all"),
        },
        {
          id: "tabs:pin",
          label: active.pinned ? "Tab lösen" : "Tab anheften",
          icon: PinIcon,
          onSelect: () => togglePin(active.id),
        },
        {
          id: "tabs:duplicate",
          label: "Tab duplizieren",
          icon: CopyIcon,
          onSelect: () => duplicate(active.id),
        },
        active.split
          ? { id: "tabs:split", label: "Split View schließen", icon: Columns2Icon, onSelect: closeSplit }
          : { id: "tabs:split", label: "Split View öffnen", icon: Columns2Icon, onSelect: () => openSplit() },
      )
      if (active.split) {
        actions.push(
          { id: "tabs:split-swap", label: "Seiten im Split View tauschen", icon: ArrowLeftRightIcon, onSelect: swapSplit },
          { id: "tabs:unsplit", label: "Split View in zwei Tabs auflösen", icon: Columns2Icon, onSelect: unsplit },
        )
      }
    }
    if (closed.length > 0) {
      actions.push({
        id: "tabs:reopen",
        label: "Geschlossenen Tab wiederherstellen",
        icon: RotateCcwIcon,
        hint: "Alt ⇧ T",
        onSelect: reopenClosed,
      })
    }
    return [
      {
        heading: "Offene Tabs",
        actionLabel: "Zum Tab wechseln",
        items: tabs
          .filter((t) => t.id !== activeId)
          .map((t) => ({
            id: `tab:${t.id}`,
            label: titleOf(t),
            icon: featureOf(t.path)?.icon,
            keywords: [featureOf(t.path)?.title ?? ""],
            onSelect: () => activate(t.id),
          })),
      },
      { heading: "Tabs", items: actions },
    ]
  }, [
    tabs,
    activeId,
    closed.length,
    closeTabs,
    togglePin,
    duplicate,
    reopenClosed,
    activate,
    openSplit,
    closeSplit,
    swapSplit,
    unsplit,
    titleOf,
    featureOf,
  ])
  useRegisterCommands("tabs", commandGroups)

  const value = useMemo<TabsContextValue>(
    () => ({
      tabs,
      activeId,
      initialized: stored !== null,
      featureOf,
      titleOf,
      titleOfPath,
      openSplit,
      closeSplit,
      setSplitPath,
      swapSplit,
      splitWith,
      unsplit,
      activate,
      openInNewTab,
      closeTabs,
      reopenClosed,
      canReopen: closed.length > 0,
      togglePin,
      duplicate,
      move,
      cycle,
      setTitle,
    }),
    [
      tabs,
      activeId,
      stored,
      featureOf,
      titleOf,
      titleOfPath,
      openSplit,
      closeSplit,
      setSplitPath,
      swapSplit,
      splitWith,
      unsplit,
      activate,
      openInNewTab,
      closeTabs,
      reopenClosed,
      closed.length,
      togglePin,
      duplicate,
      move,
      cycle,
      setTitle,
    ],
  )

  return <TabsContext.Provider value={value}>{children}</TabsContext.Provider>
}
