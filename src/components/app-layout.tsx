import { Outlet } from "react-router"
import { AppSidebar } from "@/components/app-sidebar"
import { CommandPaletteProvider } from "@/components/command-palette"
import { SettingsProvider } from "@/components/settings-dialog"
import { SplitLayout } from "@/components/split-view"
import { StatusBar } from "@/components/status-bar"
import { StatusItemsProvider } from "@/components/status-items"
import { TabBar } from "@/components/tab-bar"
import { TabsProvider } from "@/components/tabs-provider"
import { ToolStrip } from "@/components/tool-strip"
import { SidebarProvider } from "@/components/ui/sidebar"
import { DnaLink } from "@/features/case-files/dna-link"

/**
 * IDE-like window in JetBrains' "Islands" style: tool strip and status bar
 * sit on the frame; the tabs and the page below them (two side by side in a
 * split view) are rounded islands floating on it.
 */
export function AppLayout() {
  return (
    <SettingsProvider>
      <CommandPaletteProvider>
        <TabsProvider>
          <StatusItemsProvider>
            {/* The sidebar is only the phone navigation sheet; desktop uses the tool strip. */}
            <SidebarProvider open={false} className="relative h-svh min-h-0 flex-col overflow-clip bg-frame">
              <AppSidebar />
              <div className="flex min-h-0 flex-1 pt-2.5 pr-2.5 pl-1 md:pl-0">
                <ToolStrip />
                <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1">
                  <TabBar />
                  <SplitLayout>
                    <Outlet />
                  </SplitLayout>
                </div>
              </div>
              <StatusBar />
              <DnaLink />
            </SidebarProvider>
          </StatusItemsProvider>
        </TabsProvider>
      </CommandPaletteProvider>
    </SettingsProvider>
  )
}
