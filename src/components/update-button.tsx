import { useEffect, useRef, useState } from "react"
import { cn } from "cn"
import { CheckIcon, DownloadIcon, RefreshCwIcon, RotateCcwIcon, RotateCwIcon } from "lucide-react"
import { toast } from "sonner"
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { desktop, useUpdateState, type UpdateState } from "@/lib/desktop"

// The update button at the bottom of the tool strip, like T3 Code's in its sidebar: a check
// while idle, then download, progress and restart. Nothing loads or installs without a click.

const PROGRESS_RADIUS = 14
const PROGRESS_LENGTH = 2 * Math.PI * PROGRESS_RADIUS

type Action = "check" | "download" | "install" | "none"

function actionOf(state: UpdateState | null): Action {
  switch (state?.status) {
    case "available":
      return "download"
    case "ready":
      return "install"
    case "error":
      return state.version ? "download" : "check"
    case "idle":
    case "latest":
      return "check"
    default:
      return "none"
  }
}

function tooltipOf(state: UpdateState | null) {
  switch (state?.status) {
    case "available":
      return `Update ${state.version} bereit zum Laden`
    case "downloading":
      return `Update wird geladen (${Math.floor(state.percent ?? 0)} %)`
    case "ready":
      return `Update ${state.version} geladen. Klicken zum Neustarten und Installieren.`
    case "error":
      return state.version
        ? `Laden von ${state.version} fehlgeschlagen. Klicken zum Wiederholen.`
        : (state.error ?? "Update fehlgeschlagen")
    case "checking":
      return "Suche nach Updates …"
    case "unsupported":
      return "Updates nicht verfügbar"
    default:
      return "Nach Updates suchen"
  }
}

export function UpdateButton() {
  const state = useUpdateState()
  const [confirming, setConfirming] = useState(false)
  const status = state?.status

  // A toast once a download is done, pointing back to this button.
  const previous = useRef(status)
  useEffect(() => {
    if (previous.current === "downloading" && status === "ready") {
      toast.success("Update geladen", {
        description: "Starte die App über den Update-Button neu, um es zu installieren.",
      })
    }
    previous.current = status
  }, [status])

  if (!desktop || !state) return null

  const action = actionOf(state)
  const hasUpdate = status === "available" || status === "downloading" || status === "ready" || (status === "error" && !!state.version)
  const disabled = action === "none"

  const onClick = () => {
    if (action === "check") desktop!.updates.check()
    else if (action === "download") desktop!.updates.download()
    else if (action === "install") setConfirming(true)
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={tooltipOf(state)}
            aria-disabled={disabled || undefined}
            onClick={disabled ? undefined : onClick}
            className={cn(
              "inline-flex size-9 items-center justify-center rounded-full outline-none transition-[background-color,color,scale] duration-150 focus-visible:ring-2 focus-visible:ring-ring",
              disabled ? "cursor-not-allowed" : "cursor-pointer active:scale-90",
              hasUpdate
                ? cn("bg-strip-hover text-foreground", !disabled && "hover:bg-strip-hover/70")
                : cn("text-strip-foreground", !disabled && "hover:bg-strip-hover hover:text-foreground"),
              disabled && !hasUpdate && "opacity-60",
            )}
          >
            <StatusIcon state={state} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          <span className="whitespace-pre-line">{tooltipOf(state)}</span>
        </TooltipContent>
      </Tooltip>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogPanel>
            <AlertDialogHeader>
              <AlertDialogMedia>
                <RotateCcwIcon />
              </AlertDialogMedia>
              <AlertDialogTitle>Update {state.version} installieren und FSD Tools neu starten?</AlertDialogTitle>
              <AlertDialogDescription>
                Die App schließt sich kurz und startet in der neuen Version wieder.
              </AlertDialogDescription>
            </AlertDialogHeader>
          </AlertDialogPanel>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => desktop!.updates.install()}>Neu starten</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function StatusIcon({ state }: { state: UpdateState }) {
  switch (state.status) {
    case "available":
      return <AvailableIcon />
    case "downloading":
      return <DownloadingIcon percent={state.percent ?? 0} />
    case "ready":
      return <ReadyIcon />
    case "error":
      return state.version ? <AvailableIcon /> : <RefreshCwIcon className="size-4" />
    default:
      return (
        <RefreshCwIcon
          className={cn("size-4", state.status === "checking" && "animate-spin motion-reduce:animate-none")}
        />
      )
  }
}

/** Download arrow with a dot: there's something to load. */
function AvailableIcon() {
  return (
    <span className="relative grid size-4 place-items-center">
      <DownloadIcon className="size-4" />
      <span
        aria-hidden
        className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-current ring-2 ring-strip-hover"
      />
    </span>
  )
}

/** Download arrow inside a ring that fills with the progress. */
function DownloadingIcon({ percent }: { percent: number }) {
  const offset = PROGRESS_LENGTH * (1 - Math.min(100, Math.max(0, percent)) / 100)
  return (
    <span className="relative grid size-8 place-items-center">
      <svg aria-hidden className="pointer-events-none absolute inset-0 size-full -rotate-90" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r={PROGRESS_RADIUS} fill="none" className="stroke-current/22" strokeWidth="1.5" />
        <circle
          cx="16"
          cy="16"
          r={PROGRESS_RADIUS}
          fill="none"
          stroke="currentColor"
          strokeDasharray={PROGRESS_LENGTH}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth="1.5"
          className="transition-[stroke-dashoffset] duration-300 ease-out motion-reduce:transition-none"
        />
      </svg>
      <DownloadIcon className="size-4" />
    </span>
  )
}

/** Restart arrow with a check: loaded and ready to install. */
function ReadyIcon() {
  return (
    <span className="relative grid size-4 place-items-center">
      <RotateCwIcon className="size-4" />
      <span className="absolute -right-1 -bottom-1 grid size-2.5 place-items-center rounded-full bg-foreground text-background ring-2 ring-strip-hover">
        <CheckIcon className="size-2" strokeWidth={3} />
      </span>
    </span>
  )
}
