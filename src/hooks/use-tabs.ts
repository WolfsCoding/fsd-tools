import { createContext, useContext, useEffect } from "react"
import { useLocation } from "react-router"
import type { Feature } from "@/features/registry"

export interface Tab {
  id: string
  /** Current route of the tab including its query, e.g. "/fsu/dna-extraction-blood" or "/dna-db?q=x". */
  path: string
  pinned?: boolean
  /** Route shown right of the tab's page in a split view, including its query. */
  split?: string
}

/** Which tabs `closeTabs` closes, relative to the tab it's called with. */
export type CloseScope = "this" | "others" | "left" | "right" | "unpinned" | "all"

export interface TabsContextValue {
  tabs: Tab[]
  activeId: string | null
  /** True once tabs were used; an empty list then means the user closed them all. */
  initialized: boolean
  featureOf: (path: string) => Feature | undefined
  /** Page title of a tab, set by its page via `useTabTitle`, else the feature title. */
  titleOf: (tab: Tab) => string
  /** The same for any route, e.g. the split pane's. */
  titleOfPath: (path: string) => string
  /** Shows `path` (default: the active page) right of the active tab's page. */
  openSplit: (path?: string) => void
  closeSplit: () => void
  /**
   * Merges tab `id` into the active tab (or, if it is the active one, the last used
   * other tab) as one split view, its page on `side`. A page it pushes out keeps a tab.
   */
  splitWith: (id: string, side: "left" | "right") => void
  /** Turns the active tab's split view back into two tabs. */
  unsplit: () => void
  /** Follows navigation inside the split pane. */
  setSplitPath: (path: string) => void
  /** Swaps the pages of the active tab's two panes. */
  swapSplit: () => void
  activate: (id: string) => void
  /** Opens `path` in a new tab next to the active one. */
  openInNewTab: (path: string) => void
  closeTabs: (id: string, scope?: CloseScope) => void
  reopenClosed: () => void
  canReopen: boolean
  togglePin: (id: string) => void
  duplicate: (id: string) => void
  /** Moves tab `id` next to tab `targetId`. */
  move: (id: string, targetId: string, side: "before" | "after") => void
  /** Activates the tab `offset` places away, wrapping around. */
  cycle: (offset: number) => void
  setTitle: (path: string, title: string | undefined) => void
}

/** A tab's route without its query, e.g. "/dna-db?q=x" → "/dna-db"; titles are keyed by it. */
export function routeOf(path: string) {
  const i = path.indexOf("?")
  return i === -1 ? path : path.slice(0, i)
}

/** Drag data type of a dragged tab, holding its id; lets drop zones tell tabs apart. */
export const TAB_DRAG_TYPE = "application/x-fsd-tab"

export const TabsContext =createContext<TabsContextValue | null>(null)

export function useTabs() {
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error("Must be used inside <TabsProvider>")
  return ctx
}

/**
 * Names the tab showing the current route, e.g. after the open post.
 * Without it the tab shows the feature title.
 */
export function useTabTitle(title: string | undefined) {
  const { pathname } = useLocation()
  const { setTitle } = useTabs()
  useEffect(() => setTitle(pathname, title), [pathname, title, setTitle])
}
