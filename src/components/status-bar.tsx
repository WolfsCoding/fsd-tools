import { Fragment, useEffect, useState } from "react"
import { useLocation } from "react-router"
import { ChevronRightIcon, HardDriveIcon, TriangleAlertIcon } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"
import { Hint } from "@/components/hint"
import { StatusItemsSlot } from "@/components/status-items"
import { useSettingsDialog } from "@/hooks/use-settings"
import { routeOf, useTabs } from "@/hooks/use-tabs"
import { LAST_BACKUP_KEY } from "@/lib/backup"
import { features } from "@/features/registry"
import { useLocalStorage, useStorageBytes, WRITE_FAILED_EVENT } from "@/lib/local-storage"

const NEVER: string | null = null
/** After this many days without a full backup, the status bar reminds of one. */
const BACKUP_REMINDER_DAYS = 7
const DAY = 24 * 60 * 60 * 1000
const DATA_KEYS = features.flatMap((f) => f.storage?.keys ?? [])

/** Bottom bar on the frame: where you are on the left, status items on the right. */
export function StatusBar() {
  return (
    <footer className="flex h-7 shrink-0 items-center gap-3 px-3 text-xs text-frame-foreground select-none">
      <StatusPath />
      <StatusItemsSlot className="ml-auto flex min-w-0 items-center gap-3" />
      <StorageStatus />
    </footer>
  )
}

/**
 * "Lokal gespeichert", or a warning when saving failed or no full backup was made
 * for a while. Clicking it opens the backup settings.
 */
function StorageStatus() {
  const { openPage } = useSettingsDialog()
  const [lastBackup] = useLocalStorage(LAST_BACKUP_KEY, NEVER)
  const [failed, setFailed] = useState(false)
  const hasData = useStorageBytes(DATA_KEYS) > 0
  // Read once per mount; the reminder doesn't need to tick over at midnight.
  const [now] = useState(() => Date.now())

  useEffect(() => {
    function onFail() {
      setFailed(true)
      toast.error("Änderung konnte nicht gespeichert werden", {
        id: "storage-full",
        description: "Der Browserspeicher ist voll. Exportiere deine Daten und lösche Nicht-Benötigtes.",
        duration: Infinity,
        action: { label: "Sicherung", onClick: () => openPage("sicherung") },
      })
    }
    window.addEventListener(WRITE_FAILED_EVENT, onFail)
    return () => window.removeEventListener(WRITE_FAILED_EVENT, onFail)
  }, [openPage])

  const days = lastBackup ? Math.floor((now - new Date(lastBackup).getTime()) / DAY) : undefined
  const remind = hasData && (days === undefined || days >= BACKUP_REMINDER_DAYS)
  const warning = failed || remind
  const label = failed
    ? "Speichern fehlgeschlagen"
    : !remind
      ? "Lokal gespeichert"
      : days === undefined
        ? "Noch keine Sicherung"
        : `Letzte Sicherung vor ${days} Tagen`

  return (
    <Hint label={warning ? "Alle Daten liegen nur in diesem Browser – jetzt sichern" : "Alle Daten bleiben auf diesem Gerät"}>
      <button
        type="button"
        onClick={() => openPage("sicherung")}
        className={cn(
          "hidden shrink-0 items-center gap-1.5 rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:flex",
          failed && "text-destructive",
          !failed && remind && "text-amber-400",
        )}
      >
        {warning ? <TriangleAlertIcon className="size-3.5" /> : <HardDriveIcon className="size-3.5" />}
        {label}
      </button>
    </Hint>
  )
}

/** App › feature › page, like the IDE's navigation bar. */
function StatusPath() {
  const { pathname } = useLocation()
  const { tabs, activeId, featureOf, titleOf } = useTabs()
  const feature = featureOf(pathname)
  const active = tabs.find((t) => t.id === activeId)
  const pageTitle =
    active && routeOf(active.path) === pathname && titleOf(active) !== feature?.title
      ? titleOf(active)
      : undefined

  const parts = ["FSD Tools", feature?.title, pageTitle].filter(
    (p): p is string => !!p,
  )

  return (
    <nav aria-label="Pfad" className="flex min-w-0 items-center gap-1">
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && <ChevronRightIcon className="size-3 shrink-0" />}
          <span
            className={
              i === parts.length - 1
                ? "truncate text-foreground/90"
                : "shrink-0"
            }
          >
            {part}
          </span>
        </Fragment>
      ))}
    </nav>
  )
}
