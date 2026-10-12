import type { ReactNode } from "react"
import {
  BookOpenIcon,
  CheckIcon,
  ClipboardCheckIcon,
  type LucideIcon,
  RadioIcon,
  ScaleIcon,
  SearchIcon,
  UsersIcon,
} from "lucide-react"
import { Hint } from "@/components/hint"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import {
  DEBRIEF_POINTS,
  DECISION_QUESTIONS,
  FALLBACK_LABEL,
  LEAD_SHORT,
  PRIORITY_HINT,
  PRIORITY_LABEL,
  RADIO_RULES,
  TYPICAL_DECISIONS,
  URGENT_REPORTS,
} from "./guide"
import { FALLBACKS, LEAD_ROLES, PRIORITIES } from "./types"

const QUESTIONS = ["Was?", "Wo?", "Wer?", "Verletzte?", "Geiseln?", "Bewaffnete?", "Fluchtfahrzeuge?", "Gefahrenbereich?"]

/** The "Kurz-Merkzettel" of the guide, opened from the header. */
export function GuideSheet() {
  return (
    <Sheet>
      <Hint label="Kurz-Merkzettel für die Einsatzleitung">
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" aria-label="Merkzettel">
            <BookOpenIcon /> <span className="hidden xl:inline">Merkzettel</span>
          </Button>
        </SheetTrigger>
      </Hint>
      <SheetContent className="gap-0 overflow-y-auto data-[side=right]:sm:max-w-lg">
        <SheetHeader className="border-b pb-4">
          <SheetTitle className="text-lg">Einsatzleitung</SheetTitle>
          <SheetDescription>Überblick behalten · entscheiden · delegieren</SheetDescription>
        </SheetHeader>

        <div className="grid gap-6 p-4">
          <Priorities />

          <ol className="grid gap-5">
            <Step n={1} icon={SearchIcon} title="Lage klären">
              <Chips items={QUESTIONS} />
            </Step>
            <Step n={2} icon={UsersIcon} title="Aufgaben verteilen">
              <Chips items={LEAD_ROLES.filter((r) => r !== "el").map((r) => LEAD_SHORT[r])} />
              <Note>
                Konkrete Beamte und Einheiten benennen. Bereichsleitungen arbeiten eigenständig und melden nur
                wichtige Änderungen.
              </Note>
            </Step>
            <Step n={3} icon={ScaleIcon} title="Entscheiden">
              <ul className="grid gap-1.5">
                {DECISION_QUESTIONS.map((q) => (
                  <li key={q} className="flex gap-2">
                    <CheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                    {q}
                  </li>
                ))}
              </ul>
              <SubHeading>Typische Fragen</SubHeading>
              <List items={TYPICAL_DECISIONS} />
              <SubHeading>Rückfallebene planen</SubHeading>
              <Chips items={FALLBACKS.map((f) => FALLBACK_LABEL[f])} />
            </Step>
            <Step n={4} icon={RadioIcon} title="Funk">
              <List items={RADIO_RULES} />
              <SubHeading>Sofort melden</SubHeading>
              <Chips items={URGENT_REPORTS} tone="alert" />
            </Step>
            <Step n={5} icon={ClipboardCheckIcon} title="Nachbereitung">
              <List items={DEBRIEF_POINTS} />
              <Note>Kurze Manöverkritik mit wenigen Beamten.</Note>
            </Step>
          </ol>

          <section className="rounded-lg border bg-muted/30 p-4 text-sm">
            <h4 className="mb-1 font-semibold">Grundsätze</h4>
            <p className="text-muted-foreground">
              Jede Entscheidung braucht einen nachvollziehbaren Grund. Gerade harte Maßnahmen müssen begründbar sein,
              auch gegenüber TVs in Gewahrsam. Gesprächsbereit, professionell, keine unnötige Eskalation.
            </p>
          </section>

          <blockquote className="rounded-lg border-l-4 border-primary bg-primary/5 px-4 py-3 text-center font-semibold">
            EL steht gesichert. Kopf frei halten.
          </blockquote>
        </div>
      </SheetContent>
    </Sheet>
  )
}

/** The five priorities as a ladder, highest first. */
function Priorities() {
  return (
    <section className="grid gap-2">
      <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Prioritäten</h4>
      <ol className="overflow-hidden rounded-lg border">
        {PRIORITIES.map((p, i) => (
          <li key={p} className="flex items-center gap-3 border-b px-3 py-2 last:border-b-0">
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white tabular-nums"
              style={{ backgroundColor: `color-mix(in oklab, var(--color-red-600) ${100 - i * 22}%, var(--color-zinc-600))` }}
            >
              {i + 1}
            </span>
            <span className="grid min-w-0">
              <span className="text-sm font-medium">{PRIORITY_LABEL[p]}</span>
              <span className="truncate text-xs text-muted-foreground">{PRIORITY_HINT[p]}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function Step({ n, icon: Icon, title, children }: { n: number; icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <div className="grid min-w-0 flex-1 gap-2 text-sm">
        <h4 className="pt-1.5 font-semibold">
          <span className="mr-1.5 text-muted-foreground tabular-nums">{n}.</span>
          {title}
        </h4>
        {children}
      </div>
    </li>
  )
}

function Chips({ items, tone }: { items: string[]; tone?: "alert" }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <li
          key={t}
          className={
            tone === "alert"
              ? "rounded-md bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-300"
              : "rounded-md bg-muted px-2 py-0.5 text-xs font-medium"
          }
        >
          {t}
        </li>
      ))}
    </ul>
  )
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="grid list-disc gap-1 pl-4 text-muted-foreground marker:text-muted-foreground/50">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  )
}

function SubHeading({ children }: { children: ReactNode }) {
  return <h5 className="mt-1 text-xs font-medium text-muted-foreground">{children}</h5>
}

function Note({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>
}
