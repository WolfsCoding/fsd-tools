import { useEffect, useRef } from "react"
import { RefreshCwIcon, RotateCcwIcon } from "lucide-react"
import { toast } from "sonner"
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
      return `Version ${state.version} gefunden, wird geladen …`
    case "downloading":
      return `Version ${state.version ?? ""} wird geladen (${state.percent ?? 0} %)`
    case "ready":
      return `Version ${state.version} ist bereit. Ein Neustart installiert sie.`
    case "latest":
      return "Du hast die neueste Version."
    case "error":
      return `Fehler beim Suchen: ${state.error}`
    case "unsupported":
      return "Updates gibt es nur in der installierten App."
    default:
      return "Sucht beim Start und jede Stunde automatisch."
  }
}

export function UpdateSettings() {
  const version = useAppVersion()
  const state = useUpdateState()
  const busy = state?.status === "checking" || state?.status === "available" || state?.status === "downloading"

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

/** Offers a restart once an update is downloaded. Renders nothing. */
export function UpdateNotifier() {
  const state = useUpdateState()
  const shown = useRef<string>(undefined)

  useEffect(() => {
    if (state?.status !== "ready" || shown.current === state.version) return
    shown.current = state.version
    toast(`Update ${state.version} ist bereit`, {
      description: "Ein Neustart installiert es.",
      duration: Infinity,
      action: { label: "Neu starten", onClick: () => desktop?.updates.install() },
    })
  }, [state])

  return null
}
