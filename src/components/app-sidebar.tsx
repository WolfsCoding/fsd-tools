import { NavLink, useLocation } from "react-router"
import { CommandIcon, SettingsIcon } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useCommandPalette } from "@/hooks/use-command-palette"
import { useEnabledFeatures, useSettingsDialog } from "@/hooks/use-settings"

/** Navigation sheet for phones; desktop navigates with the tool strip. */
export function AppSidebar() {
  const { pathname } = useLocation()
  const { isMobile, setOpenMobile } = useSidebar()
  const { setOpen: setPaletteOpen } = useCommandPalette()
  const { setOpen: setSettingsOpen } = useSettingsDialog()
  const { enabledFeatures } = useEnabledFeatures()
  if (!isMobile) return null

  const close = () => setOpenMobile(false)
  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <NavLink to="/" onClick={close}>
                <img src="/favicon.svg" alt="" className="size-8 shrink-0" />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">FSD Tools</span>
                  <span className="truncate text-xs text-muted-foreground">
                    Werkzeugkasten
                  </span>
                </div>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Werkzeuge</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {enabledFeatures.map((feature) => (
                <SidebarMenuItem key={feature.path}>
                  <SidebarMenuButton
                    isActive={pathname.startsWith(`/${feature.path}`)}
                    asChild
                  >
                    <NavLink to={`/${feature.path}`} onClick={close}>
                      <feature.icon />
                      <span>{feature.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu className="gap-1">
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => {
                close()
                setPaletteOpen(true)
              }}
            >
              <CommandIcon />
              <span>Befehlspalette</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => {
                close()
                setSettingsOpen(true)
              }}
            >
              <SettingsIcon />
              <span>Einstellungen</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
