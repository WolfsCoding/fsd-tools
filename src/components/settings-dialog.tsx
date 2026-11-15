import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react"
import {
  ArchiveIcon,
  DownloadIcon,
  EllipsisIcon,
  LayoutGridIcon,
  RefreshCwIcon,
  Trash2Icon,
  TriangleAlertIcon,
  UploadIcon,
} from "lucide-react"
import { toast } from "sonner"
import {
  SettingsRow,
  SettingsSection,
  SettingsValue,
} from "@/components/settings-layout"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogPanel,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { NoResults } from "@/components/no-results"
import { SearchField } from "@/components/search-field"
import { Switch } from "@/components/ui/switch"
import { UpdateSettings } from "@/components/update-settings"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  features,
  SETTINGS_GROUPS,
  settingsPages,
  type Feature,
  type SettingsPage,
} from "@/features/registry"
import {
  SettingsDialogContext,
  useEnabledFeatures,
} from "@/hooks/use-settings"
import {
  clearFeatureData,
  downloadAllData,
  downloadFeatureData,
  lastBackupAtom,
  readAllData,
  readFeatureData,
  restoreAllData,
  restoreFeatureData,
  storedKeys,
  type FeatureBackup,
  type FullBackup,
} from "@/lib/backup"
import { desktop } from "@/lib/desktop"
import { formatBytes } from "@/lib/format-bytes"
import { useStorageBytes } from "@/lib/storage"
import { useAtomValue } from "@effect/atom-react"
import * as Effect from "effect/Effect"

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [pageId, setPageId] = useState(allPages[0].id)
  const value = useMemo(
    () => ({
      open,
      setOpen,
      openPage: (id: string) => {
        setPageId(id)
        setOpen(true)
      },
    }),
    [open],
  )

  return (
    <SettingsDialogContext.Provider value={value}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        {/* Phones stack the navigation above the page. */}
        <DialogContent className="grid h-[min(48rem,calc(100svh-4rem))] grid-rows-[minmax(0,2fr)_minmax(0,3fr)] gap-1.5 sm:max-w-6xl sm:grid-cols-[15rem_1fr] sm:grid-rows-1">
          <SettingsDialogBody activeId={pageId} setActiveId={setPageId} />
        </DialogContent>
      </Dialog>
    </SettingsDialogContext.Provider>
  )
}

// Both pages list every feature, so its name finds them.
const FEATURE_TITLES = features.map((f) => f.title)

/** The pages from the registry, then those of the app itself. */
const allPages: SettingsPage[] = [
  ...settingsPages,
  {
    id: "funktionen",
    group: "App",
    title: "Funktionen",
    description: "Funktionen ein- und ausblenden",
    icon: LayoutGridIcon,
    content: FeaturesSettings,
    keywords: ["aktivieren", "deaktivieren", "aktiviert", ...FEATURE_TITLES],
  },
  {
    id: "sicherung",
    group: "App",
    title: "Daten & Sicherung",
    description: "Daten sichern, wiederherstellen und löschen",
    icon: ArchiveIcon,
    content: DataSettings,
    keywords: ["backup", "export", "import", "json", "speicher", ...FEATURE_TITLES],
  },
  ...(desktop
    ? [
        {
          id: "updates",
          group: "App" as const,
          title: "Updates",
          description: "Version der App und neue Versionen installieren",
          icon: RefreshCwIcon,
          content: UpdateSettings,
          keywords: ["version", "update", "aktualisieren", "neustart"],
        },
      ]
    : []),
]

function SettingsDialogBody({
  activeId,
  setActiveId,
}: {
  activeId: string
  setActiveId: (id: string) => void
}) {
  const [query, setQuery] = useState("")

  const q = query.trim().toLowerCase()
  const visible = allPages.filter((p) =>
    [p.title, p.description ?? "", ...(p.keywords ?? [])].some((t) => t.toLowerCase().includes(q)),
  )
  // Fall back to the first match when the search hides the active page; without matches it stays.
  const active =
    visible.find((p) => p.id === activeId) ??
    visible[0] ??
    allPages.find((p) => p.id === activeId) ??
    allPages[0]

  return (
    <>
      <DialogTitle className="sr-only">Einstellungen</DialogTitle>
      <DialogDescription className="sr-only">
        Profil, Vorlagen, Funktionen und Daten verwalten.
      </DialogDescription>

      {/* The navigation sits on the frame; the active page is the darker panel. */}
      <nav className="flex min-h-0 flex-col gap-4 overflow-y-auto p-1.5">
        <SearchField
          value={query}
          onChange={setQuery}
          aria-label="Einstellungen durchsuchen"
          // Leaves room for the close button when the navigation spans the dialog.
          className="flex-none max-sm:w-auto max-sm:mr-9"
        />

        {SETTINGS_GROUPS.map((group) => {
          const pages = visible.filter((p) => p.group === group)
          return (
            pages.length > 0 && (
              <NavGroup key={group} title={group}>
                {pages.map((page) => (
                  <NavButton
                    key={page.id}
                    entry={page}
                    active={page === active}
                    onClick={() => setActiveId(page.id)}
                  />
                ))}
              </NavGroup>
            )
          )
        })}

        {visible.length === 0 && <NoResults query={query} onReset={() => setQuery("")} />}
      </nav>

      <div className="flex min-h-0 flex-col overflow-hidden rounded-xl bg-card ring-1 ring-border">
        {/* The dialog's close button sits at the right end of this bar. */}
        <div className="flex h-11 shrink-0 items-center gap-1.5 border-b px-5 pr-14 text-sm">
          <span className="text-muted-foreground">Einstellungen</span>
          <span className="text-muted-foreground/60">/</span>
          <span className="truncate font-medium">{active.title}</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8">
          {/* Keyed so dialogs/state inside reset, and the page fades in, when switching pages. */}
          <div
            key={active.id}
            className="mx-auto max-w-3xl animate-in duration-200 ease-out-quint fade-in-0 slide-in-from-bottom-1"
          >
            <active.content />
          </div>
        </div>
      </div>
    </>
  )
}

function NavGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  )
}

function NavButton({
  entry,
  active,
  onClick,
}: {
  entry: SettingsPage
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      data-active={active}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className="flex h-8 items-center gap-2.5 rounded-lg border border-transparent px-2 text-left text-sm font-medium text-foreground/80 outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:border-input data-[active=true]:bg-card data-[active=true]:text-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground data-[active=true]:[&_svg]:text-primary"
    >
      <entry.icon />
      {entry.title}
    </button>
  )
}

function FeaturesSettings() {
  const { enabledFeatures, setFeatureEnabled } = useEnabledFeatures()

  return (
    <SettingsSection
      title="Funktionen"
      description="Deaktivierte Funktionen werden in der Seitenleiste und der Befehlspalette ausgeblendet. Ihre Daten bleiben erhalten."
    >
      {features.map((feature) => {
        const switchId = `feature-${feature.path}`
        return (
          <SettingsRow
            key={feature.path}
            htmlFor={switchId}
            icon={feature.icon}
            title={feature.title}
            description={feature.description}
          >
            <Switch
              id={switchId}
              checked={enabledFeatures.includes(feature)}
              onCheckedChange={(on) => setFeatureEnabled(feature.path, on)}
            />
          </SettingsRow>
        )
      })}
    </SettingsSection>
  )
}

function DataSettings() {
  return (
    <>
      <FullBackupSettings />
      <SettingsSection title="Nach Funktion">
        {features.map((feature) => feature.storage && <FeatureDataRow key={feature.path} feature={feature} />)}
      </SettingsSection>
    </>
  )
}

function FeatureDataRow({ feature }: { feature: Feature }) {
  const keys = useMemo(() => storedKeys(feature), [feature])
  const bytes = useStorageBytes(keys)
  const fileInput = useRef<HTMLInputElement>(null)
  const [pendingImport, setPendingImport] = useState<FeatureBackup>()
  const [confirmClear, setConfirmClear] = useState(false)

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    try {
      setPendingImport(await Effect.runPromise(readFeatureData(file, feature)))
    } catch {
      toast.error("Datei konnte nicht importiert werden", {
        description: `Erwartet wird ein JSON-Export von ${feature.title}.`,
      })
    }
  }

  function confirmImport() {
    if (!pendingImport) return
    restoreFeatureData(feature, pendingImport)
    setPendingImport(undefined)
    toast.success(`${feature.title}: Daten importiert`)
  }

  function clearData() {
    clearFeatureData(feature)
    toast.success(`${feature.title}: Alle Daten gelöscht`)
  }

  return (
    <>
      <SettingsRow
        icon={feature.icon}
        title={feature.title}
        description={feature.summary && <feature.summary />}
      >
        <SettingsValue>{formatBytes(bytes)}</SettingsValue>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Daten von ${feature.title} verwalten`}>
              <EllipsisIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={() => downloadFeatureData(feature)}>
              <DownloadIcon /> Exportieren
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => fileInput.current?.click()}>
              <UploadIcon /> Importieren…
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" disabled={bytes === 0} onSelect={() => setConfirmClear(true)}>
              <Trash2Icon /> Alle Daten löschen…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleFile}
        />
      </SettingsRow>

      <ConfirmDialog
        open={pendingImport !== undefined}
        onOpenChange={(o) => !o && setPendingImport(undefined)}
        title="Daten ersetzen?"
        description={`Die aktuellen Daten von ${feature.title} werden durch den Export${
          pendingImport
            ? ` vom ${new Date(pendingImport.exportedAt).toLocaleString("de-DE")}`
            : ""
        } ersetzt. Das kann nicht rückgängig gemacht werden.`}
        action="Ersetzen"
        onConfirm={confirmImport}
      />
      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Alle Daten löschen?"
        description={`Alle Daten von ${feature.title} werden dauerhaft gelöscht. Exportiere sie vorher, wenn du sie behalten möchtest.`}
        action="Löschen"
        onConfirm={clearData}
      />
    </>
  )
}

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  action,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  action: string
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogPanel>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <TriangleAlertIcon />
            </AlertDialogMedia>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
        </AlertDialogPanel>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

const ALL_KEYS = features.flatMap(storedKeys)

function FullBackupSettings() {
  const lastBackup = useAtomValue(lastBackupAtom)
  const keys = ALL_KEYS
  const bytes = useStorageBytes(keys)
  const fileInput = useRef<HTMLInputElement>(null)
  const [pendingImport, setPendingImport] = useState<FullBackup>()

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    try {
      setPendingImport(await Effect.runPromise(readAllData(file, features)))
    } catch {
      toast.error("Datei konnte nicht importiert werden", {
        description: "Erwartet wird eine vollständige Sicherung von FSD Tools.",
      })
    }
  }

  function confirmImport() {
    if (!pendingImport) return
    restoreAllData(features, pendingImport)
    setPendingImport(undefined)
    toast.success("Sicherung wiederhergestellt")
  }

  const included = pendingImport
    ? features.filter((f) => f.path in pendingImport.features).map((f) => f.title)
    : []

  return (
    <>
      <SettingsSection title="Alle Daten">
        <SettingsRow
          title="Belegter Speicher"
          description="Browser erlauben meist etwa 5 MB pro Seite. Wird es voll, können Änderungen nicht mehr gespeichert werden."
        >
          <SettingsValue>{formatBytes(bytes)}</SettingsValue>
        </SettingsRow>
        <SettingsRow
          title="Letzte Sicherung"
          description="Alle Daten liegen nur in diesem Browser. Wird der Browserspeicher geleert, sind sie ohne Sicherung verloren."
        >
          <SettingsValue>
            {lastBackup ? new Date(lastBackup).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" }) : "Nie"}
          </SettingsValue>
        </SettingsRow>
        <SettingsRow
          title="Alles exportieren"
          description="Lädt die Daten aller Funktionen als eine JSON-Datei herunter."
        >
          <Button variant="outline" onClick={() => downloadAllData(features)}>
            <DownloadIcon /> Exportieren
          </Button>
        </SettingsRow>
        <SettingsRow
          title="Sicherung wiederherstellen"
          description="Ersetzt die Daten aller Funktionen, die in der Sicherung enthalten sind."
        >
          <Button variant="outline" onClick={() => fileInput.current?.click()}>
            <UploadIcon /> Importieren
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleFile}
          />
        </SettingsRow>
      </SettingsSection>

      <ConfirmDialog
        open={pendingImport !== undefined}
        onOpenChange={(o) => !o && setPendingImport(undefined)}
        title="Daten ersetzen?"
        description={`Die aktuellen Daten von ${included.join(", ") || "keiner Funktion"} werden durch die Sicherung${
          pendingImport
            ? ` vom ${new Date(pendingImport.exportedAt).toLocaleString("de-DE")}`
            : ""
        } ersetzt. Das kann nicht rückgängig gemacht werden.`}
        action="Ersetzen"
        onConfirm={confirmImport}
      />
    </>
  )
}