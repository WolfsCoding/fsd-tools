import { Outlet } from "react-router"
import { AppSidebar } from "@/components/app-sidebar"
import { CommandPaletteProvider } from "@/components/command-palette"
import { SettingsProvider } from "@/components/settings-dialog"
import { SidePanelProvider, SidePanelSlot } from "@/components/side-panel"
import { StatusBar } from "@/components/status-bar"
import { StatusItemsProvider } from "@/components/status-items"
import { TabBar } from "@/components/tab-bar"
import { TabsProvider } from "@/components/tabs-provider"
import { ToolStrip } from "@/components/tool-strip"
import { SidebarProvider } from "@/components/ui/sidebar"
import { DnaLink } from "@/features/case-files/dna-link"

/**
 * IDE-like window in JetBrains' "Islands" style: tool strip and status bar
 * sit on the frame; the tabs, the side panel below them and the page are
 * rounded islands floating on it.
 */
export function AppLayout() {
  return (
    <SettingsProvider>
      <CommandPaletteProvider>
        <TabsProvider>
          <StatusItemsProvider>
            <SidePanelProvider>
              {/* The sidebar is only the phone navigation sheet; desktop uses the tool strip. */}
              <SidebarProvider open={false} className="relative h-svh min-h-0 flex-col overflow-clip bg-frame">
                <AppSidebar />
                <div className="flex min-h-0 flex-1 pt-2.5 pr-2.5 pl-1 md:pl-0">
                  <ToolStrip />
                  {/* The tabs span the side panel and the page below them. */}
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1">
                    <TabBar />
                    <div className="flex min-h-0 flex-1 gap-1">
                      <SidePanelSlot />
                      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-island">
                        <Outlet />
                      </main>
                    </div>
                  </div>
                </div>
                <StatusBar />
                <DnaLink />
              </SidebarProvider>
            </SidePanelProvider>
          </StatusItemsProvider>
        </TabsProvider>
      </CommandPaletteProvider>
    </SettingsProvider>
  )
}
