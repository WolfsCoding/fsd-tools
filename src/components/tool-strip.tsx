import type { ComponentType, ReactNode } from "react"
import { NavLink, useLocation } from "react-router"
import { cn } from "cn"
import { CommandIcon, SettingsIcon } from "lucide-react"
import { MainMenu } from "@/components/main-menu"
import { Kbd } from "@/components/ui/kbd"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useCommandPalette } from "@/hooks/use-command-palette"
import { useEnabledFeatures, useSettingsDialog } from "@/hooks/use-settings"

const STRIP_BUTTON =
  "flex size-9 items-center justify-center rounded-lg text-strip-foreground outline-none hover:bg-strip-hover focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-5"

/** Icon strip on the frame's left edge that switches tools, like the IDE's tool window bar. */
export function ToolStrip() {
  const { pathname } = useLocation()
  const { setOpen: setPaletteOpen } = useCommandPalette()
  const { setOpen: setSettingsOpen } = useSettingsDialog()
  const { enabledFeatures } = useEnabledFeatures()

  return (
    <nav
      aria-label="Werkzeuge"
      // pt-1 centers the first icon on the tab island (h-11).
      className="hidden w-14 shrink-0 flex-col items-center gap-1.5 pt-1 pb-1 md:flex"
    >
      <MainMenu />
      <div className="h-px w-6 shrink-0 bg-strip-foreground/15" />

      {enabledFeatures.map((f) => {
        const active = pathname.startsWith(`/${f.path}`)
        return (
          <StripTooltip key={f.path} label={f.title}>
            <NavLink
              to={`/${f.path}`}
              aria-label={f.title}
              className={cn(
                STRIP_BUTTON,
                active && "bg-strip-active text-white hover:bg-strip-active",
              )}
            >
              <f.icon />
            </NavLink>
          </StripTooltip>
        )
      })}

      <div className="mt-auto flex flex-col items-center gap-1">
        <StripButton
          icon={CommandIcon}
          label={
            <>
              Befehlspalette <Kbd>Strg K</Kbd>
            </>
          }
          ariaLabel="Befehlspalette"
          onClick={() => setPaletteOpen(true)}
        />
        <StripButton
          icon={SettingsIcon}
          label="Einstellungen"
          onClick={() => setSettingsOpen(true)}
        />
      </div>
    </nav>
  )
}

function StripButton({
  icon: Icon,
  label,
  ariaLabel,
  onClick,
}: {
  icon: ComponentType
  label: ReactNode
  ariaLabel?: string
  onClick: () => void
}) {
  return (
    <StripTooltip label={label}>
      <button
        type="button"
        aria-label={ariaLabel ?? (typeof label === "string" ? label : undefined)}
        onClick={onClick}
        className={STRIP_BUTTON}
      >
        <Icon />
      </button>
    </StripTooltip>
  )
}

function StripTooltip({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}
