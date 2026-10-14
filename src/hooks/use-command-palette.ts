import { createContext, useContext, useEffect, type ComponentType } from "react"
import { usePane } from "@/hooks/use-pane"

export interface CommandAction {
  id: string
  label: string
  /** Extra text that should match when searching (e.g. IDs). */
  keywords?: string[]
  icon?: ComponentType<{ className?: string }>
  /** Secondary text shown right-aligned, e.g. an ID. */
  hint?: string
  onSelect: () => void
}

export interface CommandGroupDef {
  heading: string
  items: CommandAction[]
  /** Footer hint shown next to ↵ while an item of this group is selected. */
  actionLabel?: string
}

export interface CommandPaletteContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  register: (id: string, groups: CommandGroupDef[]) => () => void
}

export const CommandPaletteContext =
  createContext<CommandPaletteContextValue | null>(null)

function useCommandPaletteContext() {
  const ctx = useContext(CommandPaletteContext)
  if (!ctx) throw new Error("Must be used inside <CommandPaletteProvider>")
  return ctx
}

export function useCommandPalette() {
  const { open, setOpen } = useCommandPaletteContext()
  return { open, setOpen }
}

/**
 * Adds command groups to the palette while the calling component is mounted.
 * Memoize `groups` so it only re-registers when its contents change. Pages in
 * the split pane register nothing; their commands come from the main pane.
 */
export function useRegisterCommands(id: string, groups: CommandGroupDef[]) {
  const { register } = useCommandPaletteContext()
  const pane = usePane()
  useEffect(() => (pane === "main" ? register(id, groups) : undefined), [pane, id, groups, register])
}
