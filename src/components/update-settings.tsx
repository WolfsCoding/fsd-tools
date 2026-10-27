import { DownloadIcon, RefreshCwIcon, RotateCcwIcon } from "lucide-react"
import {
  SettingsRow,
  SettingsSection,
  SettingsValue,
} from "@/components/settings-layout"
import { Button } from "@/components/ui/button"
import {
  desktop,
  useAppVersion,
  useUpdateState,
  type UpdateState,
} from "@/lib/desktop"

function describe(state: UpdateState | undefined) {
  switch (state?.status) {
    case "checking":
      return "Suche nach Updates …"
    case "available":
      return `Version ${state.version} ist verfügbar.`
    case "downloading":
      return `Version ${state.version ?? ""} wird geladen (${state.percent ?? 0} %)`
    case "ready":
      return `Version ${state.version} ist bereit. Ein Neustart installiert sie.`
    case "latest":
      return "Du hast die neueste Version."
    case "error":
      return `Fehler beim Update: ${state.error}`
    case "unsupported":
      return "Updates gibt es nur in der installierten App."
    default:
      return "Sucht kurz nach dem Start und alle 4 Minuten. Geladen und installiert wird nur auf Klick."
  }
}

export function UpdateSettings() {
  const version = useAppVersion()
  const state = useUpdateState()
  const busy = state?.status === "checking" || state?.status === "downloading"
  const canDownload = state?.status === "available" || (state?.status === "error" && !!state.version)

  return (
    <SettingsSection title="Updates">
      <SettingsRow title="Version">
        <SettingsValue>{version ?? "–"}</SettingsValue>
      </SettingsRow>
      <SettingsRow title="Status" description={describe(state)}>
        {state?.status === "ready" ? (
          <Button onClick={() => desktop?.updates.install()}>
            <RotateCcwIcon /> Neu starten
          </Button>
        ) : canDownload ? (
          <Button onClick={() => desktop?.updates.download()}>
            <DownloadIcon /> Update laden
          </Button>
        ) : (
          <Button
            variant="outline"
            disabled={busy || state?.status === "unsupported"}
            onClick={() => desktop?.updates.check()}
          >
            <RefreshCwIcon className={busy ? "animate-spin" : undefined} /> Nach Updates suchen
          </Button>
        )}
      </SettingsRow>
    </SettingsSection>
  )
}
