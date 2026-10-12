import { cn } from "cn"
import { FACTOR_LABEL, FACTOR_PLACEHOLDER, FALLBACK_LABEL } from "./guide"
import { DebriefFields } from "./debrief"
import { useLocked } from "./edit-state"
import { QuietField, Section } from "./panel"
import { FALLBACKS, LAGE_FACTORS, type FactorState, type LageFactor, type Operation } from "./types"
import type { useOperations } from "./use-operations"

type Api = ReturnType<typeof useOperations>

const PICTURE = [
  {
    field: "situation",
    label: "Was ist passiert?",
    placeholder: "z. B. Bankraub, 3 TVs, Geiselnahme in der Schalterhalle",
  },
  { field: "involved", label: "Wer ist beteiligt?", placeholder: "TVs, Opfer, Zeugen, Beschreibungen" },
  { field: "goal", label: "Ziel", placeholder: "z. B. Geiseln unverletzt befreien, TVs festnehmen" },
] as const

const STATES: { value: FactorState; label: string; active: string }[] = [
  { value: "unklar", label: "?", active: "bg-muted text-foreground" },
  { value: "nein", label: "Nein", active: "bg-emerald-500/15 text-emerald-300" },
  { value: "ja", label: "Ja", active: "bg-red-500/20 text-red-300" },
]

/** "Lage klären" from the guide: what happened, the yes/no questions and the fallback plan. */
export function LageTab({ operation, api }: { operation: Operation; api: Api }) {
  const id = operation.id
  const answered = LAGE_FACTORS.filter((f) => operation.factors[f].state !== "unklar").length

  return (
    <div className="grid gap-6">
      {operation.endedAt && (
        <Section title="Nachbesprechung">
          <DebriefFields operation={operation} api={api} />
        </Section>
      )}

      <Section title="Lagebild">
        {PICTURE.map((p) => (
          <label key={p.field} className="grid gap-1 px-4 py-3">
            <span className="text-xs font-medium text-muted-foreground">{p.label}</span>
            <QuietField
              value={operation[p.field]}
              onChange={(v) => api.setField(id, p.field, v)}
              onCommit={(before, after) => api.commitField(id, p.field, before, after)}
              placeholder={p.placeholder}
            />
          </label>
        ))}
      </Section>

      <Section title="Lagefragen" aside={`${answered}/${LAGE_FACTORS.length} geklärt`}>
        {LAGE_FACTORS.map((f) => (
          <FactorRow key={f} operation={operation} factor={f} api={api} />
        ))}
      </Section>

      <Section title="Rückfallebene">
        {FALLBACKS.map((f) => (
          <label key={f} className="grid gap-1 px-4 py-3">
            <span className="text-xs font-medium text-muted-foreground">{FALLBACK_LABEL[f]}</span>
            <QuietField
              value={operation.fallback[f]}
              onChange={(v) => api.setFallback(id, f, v)}
              onCommit={(before, after) => api.commitFallback(id, f, before, after)}
              placeholder="Plan festlegen…"
            />
          </label>
        ))}
      </Section>
    </div>
  )
}

/** A yes/no question of the Lage. Details can be added once it's answered with yes. */
function FactorRow({ operation, factor, api }: { operation: Operation; factor: LageFactor; api: Api }) {
  const locked = useLocked()
  const { state, note } = operation.factors[factor]
  const details = state === "ja" || note.trim() !== ""
  return (
    <div className="grid gap-1.5 px-4 py-2.5">
      <div className="flex items-center gap-3">
        <span className={cn("flex-1 text-sm", state === "ja" && "font-medium text-red-300")}>
          {FACTOR_LABEL[factor]}
        </span>
        <div role="radiogroup" aria-label={FACTOR_LABEL[factor]} className="flex rounded-md bg-muted/50 p-0.5">
          {STATES.map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={state === s.value}
              disabled={locked}
              aria-label={s.value === "unklar" ? "Unklar" : s.label}
              onClick={() => api.setFactor(operation.id, factor, s.value)}
              className={cn(
                "min-w-9 rounded-[5px] px-2 py-0.5 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
                state === s.value ? s.active : "text-muted-foreground enabled:hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      {details && (
        <QuietField
          value={note}
          onChange={(v) => api.setFactorNote(operation.id, factor, v)}
          placeholder={FACTOR_PLACEHOLDER[factor]}
          aria-label={`${FACTOR_LABEL[factor]}: Details`}
          className="text-muted-foreground focus:text-foreground"
        />
      )}
    </div>
  )
}
