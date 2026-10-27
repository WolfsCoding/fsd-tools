import type { ComponentType, ReactNode } from "react"
import { NavLink, useLocation } from "react-router"
import { cn } from "cn"
import { CommandIcon, DownloadIcon, RotateCcwIcon, SettingsIcon } from "lucide-react"
import { Kbd } from "@/components/ui/kbd"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useCommandPalette } from "@/hooks/use-command-palette"
import { useEnabledFeatures, useSettingsDialog } from "@/hooks/use-settings"
import { desktop, useUpdateState } from "@/lib/desktop"

const STRIP_BUTTON =
  "flex size-9 items-center justify-center rounded-lg text-strip-foreground outline-none transition-[background-color,color,scale] duration-150 hover:bg-strip-hover active:scale-90 focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-5"

/** Icon strip on the frame's left edge that switches tools, like the IDE's tool window bar. */
export function ToolStrip() {
  const { pathname } = useLocation()
  const { setOpen: setPaletteOpen } = useCommandPalette()
  const { setOpen: setSettingsOpen } = useSettingsDialog()
  const { enabledFeatures } = useEnabledFeatures()

  return (
    <nav
      aria-label="Werkzeuge"
      className="hidden w-14 shrink-0 flex-col items-center gap-1.5 pb-1 md:flex"
    >
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
        <UpdateButton />
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

/**
 * Shown only while there's an update: loads it on click, shows the progress, then restarts
 * into it. Nothing is downloaded or installed without these clicks.
 */
function UpdateButton() {
  const state = useUpdateState()
  const version = state?.version

  if (state?.status === "available" || (state?.status === "error" && version)) {
    const failed = state.status === "error"
    return (
      <StripButton
        icon={DownloadIcon}
        label={failed ? `Update ${version} fehlgeschlagen – erneut versuchen` : `Update ${version} laden`}
        onClick={() => desktop?.updates.download()}
        className={failed ? "text-destructive" : "text-primary"}
      />
    )
  }
  if (state?.status === "downloading") {
    const percent = state.percent ?? 0
    return (
      <StripTooltip label={`Update ${version ?? ""} wird geladen (${percent} %)`}>
        <div role="progressbar" aria-valuenow={percent} aria-label="Update wird geladen" className={STRIP_BUTTON}>
          <ProgressRing percent={percent} />
        </div>
      </StripTooltip>
    )
  }
  if (state?.status === "ready") {
    return (
      <StripButton
        icon={RotateCcwIcon}
        label={`Neu starten, um ${version} zu installieren`}
        onClick={() => desktop?.updates.install()}
        className="text-primary"
      />
    )
  }
  return null
}

function ProgressRing({ percent }: { percent: number }) {
  const r = 8
  const length = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 20 20" className="-rotate-90 text-primary">
      <circle cx="10" cy="10" r={r} fill="none" strokeWidth="2.5" className="stroke-strip-hover" />
      <circle
        cx="10"
        cy="10"
        r={r}
        fill="none"
        strokeWidth="2.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeDasharray={length}
        strokeDashoffset={length * (1 - percent / 100)}
        className="transition-[stroke-dashoffset] duration-300"
      />
    </svg>
  )
}

function StripButton({
  icon: Icon,
  label,
  ariaLabel,
  onClick,
  className,
}: {
  icon: ComponentType
  label: ReactNode
  ariaLabel?: string
  onClick: () => void
  className?: string
}) {
  return (
    <StripTooltip label={label}>
      <button
        type="button"
        aria-label={ariaLabel ?? (typeof label === "string" ? label : undefined)}
        onClick={onClick}
        className={cn(STRIP_BUTTON, className)}
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
