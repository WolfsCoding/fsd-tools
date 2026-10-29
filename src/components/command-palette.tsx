import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { useNavigate } from "react-router"
import {
  ArchiveIcon,
  ArrowRightIcon,
  ChevronRightIcon,
  CornerDownLeftIcon,
  SettingsIcon,
} from "lucide-react"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command"
import { Kbd } from "@/components/ui/kbd"
import {
  CommandPaletteContext,
  type CommandGroupDef,
} from "@/hooks/use-command-palette"
import { features } from "@/features/registry"
import { useEnabledFeatures, useSettingsDialog } from "@/hooks/use-settings"
import { downloadAllData } from "@/lib/backup"

/** Global ⌘K / Ctrl+K palette. Pages add their own groups via `useRegisterCommands`. */
export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [registered, setRegistered] = useState<
    Record<string, CommandGroupDef[]>
  >({})

  const register = useCallback((id: string, groups: CommandGroupDef[]) => {
    setRegistered((prev) => ({ ...prev, [id]: groups }))
    return () =>
      setRegistered((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Autofill fires keydown events without a key.
      if (e.key?.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  const value = useMemo(() => ({ open, setOpen, register }), [open, register])

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <CommandPalette
        open={open}
        onOpenChange={setOpen}
        groups={Object.values(registered).flat()}
      />
    </CommandPaletteContext.Provider>
  )
}

function CommandPalette({
  open,
  onOpenChange,
  groups,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  groups: CommandGroupDef[]
}) {
  const navigate = useNavigate()
  const { enabledFeatures } = useEnabledFeatures()
  const { setOpen: setSettingsOpen, openPage } = useSettingsDialog()
  const [selected, setSelected] = useState("")

  function run(action: () => void) {
    onOpenChange(false)
    // Let the palette dialog close first so a dialog opened by the action
    // isn't affected by the palette's focus restoration.
    setTimeout(action, 0)
  }

  const pages: CommandGroupDef = {
    heading: "Seiten",
    actionLabel: "Seite öffnen",
    items: enabledFeatures.map((f) => ({
      id: `nav:${f.path}`,
      label: f.title,
      icon: ArrowRightIcon,
      keywords: f.description ? [f.description] : undefined,
      onSelect: () => navigate(`/${f.path}`),
    })),
  }

  const general: CommandGroupDef = {
    heading: "Allgemein",
    items: [
      {
        id: "app:settings",
        label: "Einstellungen öffnen",
        icon: SettingsIcon,
        onSelect: () => setSettingsOpen(true),
      },
      {
        id: "app:backup",
        label: "Alle Daten sichern",
        icon: ArchiveIcon,
        keywords: ["backup", "export", "sicherung"],
        onSelect: () => downloadAllData(features),
      },
      {
        id: "app:restore",
        label: "Sicherung wiederherstellen",
        icon: ArchiveIcon,
        keywords: ["backup", "import"],
        onSelect: () => openPage("sicherung"),
      },
    ],
  }

  const allGroups = [pages, ...groups, general].filter(
    (g) => g.items.length > 0,
  )

  // cmdk reports the selected item's value; map it back to its group and item for the footer.
  const selection = new Map(
    allGroups.flatMap((g) =>
      g.items.map((item) => [itemValue(item.label, item.id), { group: g, item }]),
    ),
  ).get(selected.toLowerCase())

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Befehlspalette"
      description="Suche nach einem Befehl…"
      className="pb-0 sm:max-w-xl"
    >
      <Command
        value={selected}
        onValueChange={setSelected}
        // A darker rounded panel inside the lighter frame; the footer sits on the frame.
        className="rounded-xl! bg-card p-0 ring-1 ring-border [&_[data-slot=command-input-wrapper]]:p-2 [&_[data-slot=input-group]]:h-9! [&_[data-slot=input-group]]:rounded-lg! [&_[data-slot=input-group]]:border-input! [&_[data-slot=input-group]]:bg-popover/50! [&_[data-slot=input-group-addon]]:pl-2.5!"
      >
        <CommandInput placeholder="Befehl oder Suchbegriff eingeben…" />
        {/* Sized to end above the window's bottom edge, since the dialog starts a third down. */}
        <CommandList className="max-h-[min(24rem,calc(66svh-8.5rem))] scroll-py-2 px-2 pb-2 [&_[data-slot=command-group]]:px-0 [&_[data-slot=command-group]]:pt-0 [&_[data-slot=command-group]]:pb-1">
          <CommandEmpty className="py-12 text-muted-foreground">
            Keine Ergebnisse gefunden.
          </CommandEmpty>
          {allGroups.map((group) => (
            <CommandGroup key={group.heading} heading={group.heading}>
              {group.items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={itemValue(item.label, item.id)}
                  keywords={item.keywords}
                  onSelect={() => run(item.onSelect)}
                  className="h-9 rounded-lg! border border-transparent px-3! font-medium data-selected:border-input data-selected:bg-popover"
                >
                  {item.icon && <item.icon className="text-muted-foreground" />}
                  <span className="truncate">{item.label}</span>
                  {item.hint && (
                    <CommandShortcut className="font-mono tracking-normal">
                      {item.hint}
                    </CommandShortcut>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
      <div className="flex h-14 items-center gap-3 px-3.5 text-sm text-muted-foreground">
        {selection && (
          <>
            {/* Where the selected item lives: group › item. */}
            <nav aria-label="Auswahl" className="flex min-w-0 items-center gap-1.5">
              <span className="shrink-0">{selection.group.heading}</span>
              <ChevronRightIcon className="size-4 shrink-0" />
              <span className="truncate text-foreground">{selection.item.label}</span>
            </nav>
            <span className="ml-auto flex shrink-0 items-center gap-2 font-medium">
              <Kbd className="h-7 min-w-7 border bg-card text-sm [&_svg]:size-3.5">
                <CornerDownLeftIcon />
              </Kbd>
              {selection.group.actionLabel ?? "Ausführen"}
            </span>
          </>
        )}
      </div>
    </CommandDialog>
  )
}

function itemValue(label: string, id: string) {
  // cmdk lowercases values internally, so keep them lowercase for lookups.
  return `${label} ${id}`.toLowerCase()
}
