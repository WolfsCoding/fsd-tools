import { useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogPanel, DialogTitle } from "@/components/ui/dialog"

/** One page of a `StepDialog`; what it shows is up to the caller. */
export interface Step {
  title: string
  description?: string
  content: ReactNode
}

/**
 * A dialog that walks through `steps`, one page each, listed in a rail beside it (above it on
 * phones). It knows nothing of what the steps edit: the caller keeps the draft and saves it in
 * `onSave`. Every step can be jumped to and saving works from any of them, so changing one
 * thing later doesn't mean walking through all.
 */
export function StepDialog({
  open,
  title,
  steps,
  saveLabel = "Speichern",
  onSave,
  onCancel,
}: {
  open: boolean
  title: string
  steps: Step[]
  saveLabel?: string
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent
        className="h-[min(40rem,calc(100dvh-2rem))] sm:max-w-4xl"
        // A stray click next to the dialog shouldn't throw away what was entered.
        onInteractOutside={(e) => e.preventDefault()}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {open && <Steps title={title} steps={steps} saveLabel={saveLabel} onSave={onSave} onCancel={onCancel} />}
      </DialogContent>
    </Dialog>
  )
}

type State = "done" | "current" | "next"

/** The number of a step in a circle; a check once it's behind. */
function Marker({ n, state }: { n: number; state: State }) {
  return (
    <span
      className={cn(
        "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums transition-colors",
        state === "done" && "border-primary bg-primary text-primary-foreground",
        state === "current" && "border-primary bg-background text-primary ring-4 ring-primary/15",
        state === "next" && "bg-background text-muted-foreground",
      )}
    >
      {state === "done" ? <CheckIcon className="size-3.5" /> : n}
    </span>
  )
}

function Steps({
  title,
  steps,
  saveLabel,
  onSave,
  onCancel,
}: {
  title: string
  steps: Step[]
  saveLabel: string
  onSave: () => void
  onCancel: () => void
}) {
  const [at, setAt] = useState(0)
  // Steps may come and go with what is entered; stay on the last one there is.
  const index = Math.min(at, steps.length - 1)
  const step = steps[index]
  const last = index === steps.length - 1
  const body = useRef<HTMLDivElement>(null)
  const state = (i: number): State => (i < index ? "done" : i === index ? "current" : "next")

  // The first field of a step takes the focus when it is shown.
  useLayoutEffect(() => {
    body.current?.querySelector<HTMLElement>("input, textarea, [role=radio], button")?.focus()
  }, [index])

  return (
    <>
      <DialogPanel className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden p-0 sm:flex-row">
        <nav aria-label="Schritte" className="shrink-0 border-b bg-muted/30 p-4 sm:w-56 sm:border-r sm:border-b-0 sm:p-5">
          <DialogTitle className="mb-4 truncate pr-8 sm:mb-6 sm:pr-0">{title}</DialogTitle>
          <ol className="flex gap-2 sm:flex-col sm:gap-0">
            {steps.map((s, i) => (
              <li key={s.title} className="relative flex-1 sm:flex-none">
                {/* The line to the next step, filled once this one is behind. */}
                {i < steps.length - 1 && (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute top-3.5 left-9 h-px w-[calc(100%-2.75rem)] sm:top-9 sm:left-3.5 sm:h-[calc(100%-2.5rem)] sm:w-px",
                      i < index ? "bg-primary" : "bg-border",
                    )}
                  />
                )}
                <button
                  type="button"
                  onClick={() => setAt(i)}
                  aria-current={i === index ? "step" : undefined}
                  className="group flex items-start gap-3 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-full sm:pb-6"
                >
                  <Marker n={i + 1} state={state(i)} />
                  <span className="hidden min-w-0 gap-0.5 pt-1 sm:grid">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        i === index ? "text-foreground" : "text-muted-foreground group-hover:text-foreground",
                      )}
                    >
                      {s.title}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <div className="flex min-h-0 flex-1 flex-col">
          <header className="grid gap-1 px-5 pt-5 pb-4">
            <span className="text-xs font-medium text-muted-foreground">
              Schritt {index + 1} von {steps.length}
            </span>
            <h3 className="text-lg font-semibold">{step.title}</h3>
            {step.description && <DialogDescription className="text-xs">{step.description}</DialogDescription>}
          </header>
          <div ref={body} className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto px-5 pb-5">
            {step.content}
          </div>
        </div>
      </DialogPanel>
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel} className="sm:mr-auto">
          Abbrechen
        </Button>
        {index > 0 && (
          <Button variant="outline" onClick={() => setAt(index - 1)}>
            <ChevronLeftIcon /> Zurück
          </Button>
        )}
        <Button variant={last ? "default" : "outline"} onClick={onSave}>
          {saveLabel}
        </Button>
        {!last && (
          <Button onClick={() => setAt(index + 1)}>
            Weiter <ChevronRightIcon />
          </Button>
        )}
      </DialogFooter>
    </>
  )
}
