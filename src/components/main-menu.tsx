import {
  ArchiveIcon,
  CommandIcon,
  MenuIcon,
  PlusIcon,
  RotateCcwIcon,
  SettingsIcon,
  XIcon,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Hint } from "@/components/hint"
import { useSidebar } from "@/components/ui/sidebar"
import { useCommandPalette } from "@/hooks/use-command-palette"
import { useEnabledFeatures, useSettingsDialog } from "@/hooks/use-settings"
import { useTabs } from "@/hooks/use-tabs"
import { features } from "@/features/registry"
import { downloadAllData } from "@/lib/backup"

const MENU_BUTTON =
  "flex size-9 shrink-0 items-center justify-center rounded-lg text-strip-foreground outline-none hover:bg-strip-hover focus-visible:ring-2 focus-visible:ring-ring aria-expanded:bg-strip-hover [&_svg]:size-5"

/** Hamburger menu, like the IDE's main menu. Opens the sheet on phones. */
export function MainMenu() {
  const { isMobile, setOpenMobile } = useSidebar()
  const { setOpen: setPaletteOpen } = useCommandPalette()
  const { setOpen: setSettingsOpen, openPage } = useSettingsDialog()
  const { enabledFeatures } = useEnabledFeatures()
  const { tabs, activeId, openInNewTab, closeTabs, reopenClosed, canReopen } =
    useTabs()

  if (isMobile) {
    return (
      <button
        type="button"
        aria-label="Menü"
        onClick={() => setOpenMobile(true)}
        className={MENU_BUTTON}
      >
        <MenuIcon />
      </button>
    )
  }

  return (
    <DropdownMenu>
      <Hint label="Hauptmenü">
        <DropdownMenuTrigger aria-label="Hauptmenü" className={MENU_BUTTON}>
          <MenuIcon />
        </DropdownMenuTrigger>
      </Hint>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <PlusIcon /> Neuer Tab
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-56">
            {enabledFeatures.map((f) => (
              <DropdownMenuItem key={f.path} onSelect={() => openInNewTab(`/${f.path}`)}>
                <f.icon />
                <span className="truncate">{f.title}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem
          disabled={!activeId}
          onSelect={() => activeId && closeTabs(activeId)}
        >
          <XIcon /> Tab schließen
          <DropdownMenuShortcut>Alt W</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!canReopen} onSelect={reopenClosed}>
          <RotateCcwIcon /> Tab wiederherstellen
          <DropdownMenuShortcut>Alt ⇧ T</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={tabs.length === 0}
          onSelect={() => closeTabs(tabs[0].id, "all")}
        >
          Alle Tabs schließen
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setPaletteOpen(true)}>
          <CommandIcon /> Befehlspalette
          <DropdownMenuShortcut>Strg K</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setSettingsOpen(true)}>
          <SettingsIcon /> Einstellungen
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => downloadAllData(features)}>
          <ArchiveIcon /> Alle Daten sichern
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openPage("sicherung")}>
          Sicherung wiederherstellen …
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
