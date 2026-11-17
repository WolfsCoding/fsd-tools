import { useState } from "react"
import { Input } from "@/components/ui/input"

/** A number typed with comma or point; half typed numbers stay in a draft. */
export function NumberField({ id, value, onChange, label }: { id?: string; value: number; onChange: (value: number) => void; label: string }) {
  const [draft, setDraft] = useState(String(value).replace(".", ","))
  const [shown, setShown] = useState(value)
  if (shown !== value) {
    setShown(value)
    setDraft(String(value).replace(".", ","))
  }
  const parse = (v: string) => Number(v.trim().replace(",", "."))
  const valid = draft.trim() !== "" && Number.isFinite(parse(draft)) && parse(draft) >= 0

  return (
    <Input
      id={id}
      value={draft}
      inputMode="decimal"
      onChange={(e) => {
        setDraft(e.target.value)
        const next = parse(e.target.value)
        if (e.target.value.trim() !== "" && Number.isFinite(next) && next >= 0) {
          setShown(next)
          onChange(next)
        }
      }}
      onBlur={() => setDraft(String(value).replace(".", ","))}
      aria-label={id ? undefined : label}
      aria-invalid={!valid}
      className="tabular-nums"
    />
  )
}
