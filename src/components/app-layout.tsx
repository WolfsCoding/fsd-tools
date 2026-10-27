import { useState } from "react"
import { Outlet } from "react-router"
import { AppSidebar } from "@/components/app-sidebar"
import { CommandPaletteProvider } from "@/components/command-palette"
import { DesktopApi } from "@/components/desktop-api"
import { NavBar } from "@/components/nav-bar"
import { SettingsProvider } from "@/components/settings-dialog"
import { SplitLayout } from "@/components/split-view"
import { StorageWarning } from "@/components/storage-warning"
import { TabBar } from "@/components/tab-bar"
import { TabsProvider } from "@/components/tabs-provider"
import { TitleBarSync } from "@/components/title-bar-sync"
import { ToolStrip } from "@/components/tool-strip"
import { SidebarProvider } from "@/components/ui/sidebar"
import { DnaLink } from "@/features/case-files/dna-link"

/**
 * A window like Windows 11's File Explorer: tabs in the title bar, the toolbar
 * with the address bar below, then the tool strip and the page (two side by
 * side in a split view) on islands inset in the frame.
 */
export function AppLayout() {
  // Bumped by the toolbar's reload button to remount the pages.
  const [reloads, setReloads] = useState(0)

  return (
    <SettingsProvider>
      <CommandPaletteProvider>
        <TabsProvider>
          {/* The sidebar is only the phone navigation sheet; desktop uses the tool strip. */}
          <SidebarProvider open={false} className="relative h-svh min-h-0 flex-col overflow-clip bg-frame">
            <AppSidebar />
            <TabBar />
            <NavBar onReload={() => setReloads((n) => n + 1)} />
            <div className="flex min-h-0 flex-1 pr-2.5 pb-2.5 pl-1 md:pl-0">
              <ToolStrip />
              <SplitLayout key={reloads}>
                <Outlet />
              </SplitLayout>
            </div>
            <StorageWarning />
            <DnaLink />
            <DesktopApi />
            <TitleBarSync />
          </SidebarProvider>
        </TabsProvider>
      </CommandPaletteProvider>
    </SettingsProvider>
  )
}
