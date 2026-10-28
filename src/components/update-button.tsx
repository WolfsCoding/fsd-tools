import { useEffect, useRef, useState } from "react"
import { cn } from "cn"
import ReactMarkdown from "react-markdown"
import rehypeRaw from "rehype-raw"
import rehypeSanitize from "rehype-sanitize"
import { CheckIcon, DownloadIcon, RotateCcwIcon, RotateCwIcon } from "lucide-react"
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

// The update button at the bottom of the tool strip, like T3 Code's in its sidebar. It only
// appears once an update exists: download, progress, then restart, with the release notes on
// hover. Nothing loads or installs without a click. Checking by hand lives in the settings.

const PROGRESS_RADIUS = 14
const PROGRESS_LENGTH = 2 * Math.PI * PROGRESS_RADIUS

type Action = "download" | "install" | "none"

function actionOf(state: UpdateState): Action {
  switch (state.status) {
    case "available":
    case "error":
      return "download"
    case "ready":
      return "install"
    default:
      return "none"
  }
}

function tooltipOf(state: UpdateState) {
  switch (state.status) {
    case "available":
      return `Update ${state.version} bereit zum Laden`
    case "downloading":
      return `Update wird geladen (${Math.floor(state.percent ?? 0)} %)`
    case "ready":
      return `Update ${state.version} geladen. Klicken zum Neustarten und Installieren.`
    case "error":
      return `Laden von ${state.version} fehlgeschlagen. Klicken zum Wiederholen.`
    default:
      return ""
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

  const hasUpdate = status === "available" || status === "downloading" || status === "ready" || (status === "error" && !!state.version)
  if (!hasUpdate) return null

  const action = actionOf(state)
  const disabled = action === "none"

  const onClick = () => {
    if (action === "download") desktop!.updates.download()
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
              "inline-flex size-9 items-center justify-center rounded-full bg-strip-hover text-foreground outline-none transition-[background-color,color,scale] duration-150 focus-visible:ring-2 focus-visible:ring-ring",
              disabled ? "cursor-not-allowed" : "cursor-pointer hover:bg-strip-hover/70 active:scale-90",
            )}
          >
            <StatusIcon state={state} />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          align="end"
          className={cn(state.notes && "max-w-sm flex-col items-stretch gap-2 py-2")}
        >
          <span className="whitespace-pre-line">{tooltipOf(state)}</span>
          {state.notes && <ReleaseNotes html={state.notes} />}
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
    case "downloading":
      return <DownloadingIcon percent={state.percent ?? 0} />
    case "ready":
      return <ReadyIcon />
    default:
      return <AvailableIcon />
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

/** The GitHub release body, sanitized; links open in the browser. */
function ReleaseNotes({ html }: { html: string }) {
  return (
    <div className="max-h-80 overflow-y-auto border-t border-tooltip-foreground/15 pt-2 text-xs leading-relaxed [&_a]:underline [&_a]:underline-offset-2 [&_h1]:text-[13px] [&_h1]:font-semibold [&_h2]:text-[13px] [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:ml-4 [&_li]:list-disc [&_p]:my-1 [&_ul]:my-1 [&_ul]:space-y-0.5">
      <ReactMarkdown
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        components={{
          a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
        }}
      >
        {html}
      </ReactMarkdown>
    </div>
  )
}
