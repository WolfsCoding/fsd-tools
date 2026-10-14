import { createContext, useContext } from "react"

/** Which half of the split view a page renders in; "main" without a split view. */
export type Pane = "main" | "split"

export const PaneContext = createContext<Pane>("main")

/**
 * The pane of the calling page. App-wide shortcuts and commands belong to the
 * main pane, so a page open on both sides doesn't register them twice.
 */
export function usePane() {
  return useContext(PaneContext)
}
