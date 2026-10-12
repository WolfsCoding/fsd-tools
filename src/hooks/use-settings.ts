import { createContext, useCallback, useContext, useMemo } from "react"
import { features } from "@/features/registry"
import { useLocalStorage } from "@/lib/local-storage"

// Stores disabled paths so newly added features are enabled by default.
const DISABLED_FEATURES_KEY = "settings:disabled-features"
const NONE: string[] = []

export function useEnabledFeatures() {
  const [disabled, setDisabled] = useLocalStorage(DISABLED_FEATURES_KEY, NONE)

  const enabledFeatures = useMemo(
    () => features.filter((f) => !disabled.includes(f.path)),
    [disabled],
  )

  const setFeatureEnabled = useCallback(
    (path: string, enabled: boolean) =>
      setDisabled((prev) =>
        enabled
          ? prev.filter((p) => p !== path)
          : [...prev.filter((p) => p !== path), path],
      ),
    [setDisabled],
  )

  return { enabledFeatures, setFeatureEnabled }
}

export const SettingsDialogContext = createContext<{
  open: boolean
  setOpen: (open: boolean) => void
  /** Opens the dialog on a page, by settings page id or feature path. */
  openPage: (id: string) => void
} | null>(null)

export function useSettingsDialog() {
  const ctx = useContext(SettingsDialogContext)
  if (!ctx) throw new Error("Must be used inside <SettingsProvider>")
  return ctx
}
