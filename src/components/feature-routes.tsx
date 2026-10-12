import type { ReactNode } from "react"
import { Navigate } from "react-router"
import { SettingsIcon, ToggleLeftIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Separator } from "@/components/ui/separator"
import { useEnabledFeatures, useSettingsDialog } from "@/hooks/use-settings"
import { useTabs } from "@/hooks/use-tabs"

/** Renders a feature only while it's enabled in the settings. */
export function FeatureRoute({
  path,
  children,
}: {
  path: string
  children: ReactNode
}) {
  const { enabledFeatures } = useEnabledFeatures()
  if (!enabledFeatures.some((f) => f.path === path)) {
    return <Navigate to="/" replace />
  }
  return children
}

/**
 * Sends `/` to the active tab, else to the first enabled feature. Explains
 * when all tabs were closed or no feature is enabled.
 */
export function HomeRoute() {
  const { enabledFeatures } = useEnabledFeatures()
  const { setOpen } = useSettingsDialog()
  const { tabs, activeId, initialized } = useTabs()

  const tab = tabs.find((t) => t.id === activeId) ?? tabs[0]
  if (tab) return <Navigate to={tab.path} replace />

  if (initialized && enabledFeatures.length > 0) {
    return (
      // m-auto centers the content but still lets it scroll when it overflows.
      <div className="flex flex-1 flex-col overflow-y-auto">
        <div className="m-auto flex flex-col items-center py-10">
          <img src="/favicon.svg" alt="" className="mb-8 size-24" />
          <Disclaimer />
        </div>
      </div>
    )
  }

  if (enabledFeatures.length > 0) {
    return <Navigate to={`/${enabledFeatures[0].path}`} replace />
  }

  return (
    <Empty className="flex-1">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ToggleLeftIcon />
        </EmptyMedia>
        <EmptyTitle>Keine Funktionen aktiviert</EmptyTitle>
        <EmptyDescription>
          Aktiviere mindestens eine Funktion in den Einstellungen.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={() => setOpen(true)}>
          <SettingsIcon /> Einstellungen öffnen
        </Button>
      </EmptyContent>
    </Empty>
  )
}

/** Shown while no tab is open. */
function Disclaimer() {
  return (
    <section className="w-full max-w-3xl px-6 text-center text-sm text-muted-foreground">
      <h2 className="mb-3 text-lg font-semibold text-foreground">Disclaimer</h2>
      <div className="space-y-1">
        <p>Diese Website hat keine offizielle Verbindung zu Homestate.</p>
        <p>
          Sie ist vom Homestate Support nicht erlaubt, aber auch nicht verboten.
        </p>
        <p>
          Eine genaue Aussage gab es auf Anfrage beim Homestate Support nicht.
        </p>
      </div>
      <Separator className="my-6" />
      <div className="space-y-1">
        <p>
          Diese Website dient nur dazu, Arbeitsschritte auf Homestate zu
          erleichtern und zu beschleunigen.
        </p>
        <p>
          Alle Daten werden lediglich lokal im Browser und nicht online
          gespeichert.
        </p>
        <p>
          Ein Informationsaustausch von IC-Daten ist über diese Website nicht
          möglich.
        </p>
      </div>
    </section>
  )
}
