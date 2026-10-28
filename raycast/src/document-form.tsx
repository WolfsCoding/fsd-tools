import { Action, ActionPanel, Clipboard, closeMainWindow, Form, Icon, showHUD } from "@raycast/api"
import { showFailureToast, usePromise } from "@raycast/utils"
import { useEffect, useState } from "react"
import { call, type CreatedDocument, type Field, type Offense, type Template } from "./api"

/** Value of a suggestions dropdown that shows a text field for an own value. */
const CUSTOM = "__custom"

type Mode = "copy" | "paste" | "open" | "draft"

/** How long typing may pause before the app is asked for the derived fields. */
const PREVIEW_DELAY = 300

/** The template's form, built from what the app describes; submitting creates the Akte in the app. */
export function DocumentForm({ template }: { template: Template }) {
  const fields = template.sections.flatMap((s) => s.fields)
  const { data: offenses, isLoading } = usePromise(() => call<Offense[]>("/offenses"), [], {
    execute: fields.some((f) => f.type === "charges"),
  })
  // Suggestions dropdowns where "Eigener Wert" is picked.
  const [custom, setCustom] = useState<Record<string, boolean>>({})
  // What's typed so far, by the fields' ids; the app derives the choices (e.g. the fine tier) from it.
  const [values, setValues] = useState<Form.Values>({})
  const [settled, setSettled] = useState(values)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(values), PREVIEW_DELAY)
    return () => clearTimeout(timer)
  }, [values])
  const { data: preview } = usePromise(
    (form: Form.Values) => call<CreatedDocument>("/documents", { template: template.id, values: collect(fields, form), save: false }),
    [settled],
    { execute: fields.some((f) => f.type === "choice"), onError: () => undefined },
  )
  const ctx: FieldContext = { offenses: offenses ?? [], custom, setCustom, choices: preview?.choices, onChange: setValues }

  async function submit(form: Form.Values, mode: Mode) {
    try {
      const doc = await call<CreatedDocument>("/documents", {
        template: template.id,
        values: collect(fields, form),
        save: mode !== "draft",
        open: mode === "open",
      })
      const warning = doc.missing.length ? ` (leer: ${doc.missing.join(", ")})` : ""
      if (mode === "paste") {
        await closeMainWindow()
        await Clipboard.paste(doc.markdown)
        return
      }
      if (mode === "open") return showHUD(`In FSD Tools geöffnet${warning}`)
      await Clipboard.copy(doc.markdown)
      await showHUD(mode === "draft" ? `Markdown kopiert, nicht gespeichert${warning}` : `Akte angelegt, Markdown kopiert${warning}`)
    } catch (error) {
      await showFailureToast(error, { title: "Akte konnte nicht erstellt werden" })
    }
  }

  return (
    <Form
      navigationTitle={`${template.emoji} ${template.label}`}
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Anlegen und kopieren" icon={Icon.CopyClipboard} onSubmit={(v: Form.Values) => submit(v, "copy")} />
          <Action.SubmitForm title="Anlegen und einfügen" icon={Icon.Clipboard} onSubmit={(v: Form.Values) => submit(v, "paste")} />
          <Action.SubmitForm
            title="Anlegen und in App öffnen"
            icon={Icon.AppWindow}
            shortcut={{ modifiers: ["ctrl"], key: "o" }}
            onSubmit={(v: Form.Values) => submit(v, "open")}
          />
          <Action.SubmitForm
            title="Nur kopieren, nicht speichern"
            icon={Icon.Document}
            shortcut={{ modifiers: ["ctrl", "shift"], key: "c" }}
            onSubmit={(v: Form.Values) => submit(v, "draft")}
          />
        </ActionPanel>
      }
    >
      <Form.Description text={template.description} />
      {template.sections.map((section) => [
        <Form.Separator key={`${section.title}-separator`} />,
        <Form.Description key={`${section.title}-title`} title={section.title} text={section.description} />,
        ...section.fields.flatMap((f) => renderField(f, ctx)),
      ])}
    </Form>
  )
}

const title = (f: Exclude<Field, { type: "choice" }>) => (f.required ? `${f.label} *` : f.label)

/** An option's text without the markdown's code spans; `{key}` stands for a field filled in above. */
const optionLabel = (o: string) => o.replace(/`/g, "").replace(/\{\w+\}/g, "…")

interface FieldContext {
  offenses: Offense[]
  custom: Record<string, boolean>
  setCustom: (fn: (prev: Record<string, boolean>) => Record<string, boolean>) => void
  /** The app's derived choices for what's typed so far; undefined until its first answer. */
  choices: Record<string, string> | undefined
  onChange: (fn: (prev: Form.Values) => Form.Values) => void
}

function renderField(f: Field, ctx: FieldContext): React.ReactNode[] {
  const { offenses, custom, setCustom, choices } = ctx
  const track = (id: string) => (value: unknown) => ctx.onChange((prev) => ({ ...prev, [id]: value }))
  switch (f.type) {
    case "text":
      if (f.suggestions?.length) {
        return [
          <Form.Dropdown
            key={f.key}
            id={f.key}
            title={title(f)}
            info={f.hint}
            onChange={(v) => {
              setCustom((prev) => ({ ...prev, [f.key]: v === CUSTOM }))
              track(f.key)(v)
            }}
          >
            <Form.Dropdown.Item value="" title="Keine Angabe" />
            {f.suggestions.map((s) => (
              <Form.Dropdown.Item key={s} value={s} title={s} />
            ))}
            <Form.Dropdown.Item value={CUSTOM} title="Eigener Wert …" />
          </Form.Dropdown>,
          custom[f.key] && (
            <Form.TextField
              key={`${f.key}-custom`}
              id={`${f.key}${CUSTOM}`}
              title=""
              placeholder={f.placeholder}
              onChange={track(`${f.key}${CUSTOM}`)}
            />
          ),
        ]
      }
      return [
        <Form.TextField
          key={f.key}
          id={f.key}
          title={title(f)}
          info={f.hint}
          placeholder={f.placeholder}
          defaultValue={f.default}
          onChange={track(f.key)}
        />,
      ]
    case "list":
      return [
        <Form.TextArea
          key={f.key}
          id={f.key}
          title={title(f)}
          info={f.hint ?? "Ein Punkt pro Zeile."}
          placeholder={f.placeholder}
          onChange={track(f.key)}
        />,
      ]
    case "datetime":
      return [
        <Form.DatePicker
          key={f.key}
          id={f.key}
          title={title(f)}
          type={Form.DatePicker.Type.DateTime}
          info={f.hint ?? "Leer: die Zeit des Anlegens."}
          onChange={track(f.key)}
        />,
      ]
    case "checks":
      return [
        ...f.inline.flatMap((i) => renderField(i, ctx)),
        ...f.options.map((o, i) => (
          <Form.Checkbox
            key={`${f.key}-${i}`}
            id={`${f.key}::${i}`}
            title={i === 0 ? title(f) : undefined}
            label={optionLabel(o)}
            onChange={track(`${f.key}::${i}`)}
          />
        )),
      ]
    case "table":
      return [
        <Form.TextArea
          key={f.key}
          id={f.key}
          title={title(f)}
          info={`Eine Zeile pro Eintrag, Spalten mit | trennen: ${f.columns.map((c) => c.label).join(" | ")}`}
          placeholder={f.columns.map((c) => c.placeholder).join(" | ")}
          onChange={track(f.key)}
        />,
      ]
    case "charges":
      return [
        <Form.TagPicker
          key={f.key}
          id={f.key}
          title={title(f)}
          info={f.hint ?? "Anzahl und Betrag in der App anpassen."}
          onChange={track(f.key)}
        >
          {offenses.map((o) => (
            <Form.TagPicker.Item key={o.id} value={o.id} title={`${o.ref} · ${o.title}${o.fine ? ` · ${o.fine}` : ""}`} />
          ))}
        </Form.TagPicker>,
      ]
    case "choice":
      return [
        <Form.Description
          key={f.key}
          title={f.label}
          text={choices?.[f.key] ? optionLabel(choices[f.key]) : "– (ergibt sich aus den Angaben oben)"}
        />,
      ]
  }
}

/** The form's values as the app stores them; empty ones are left out so the template's defaults stay. */
function collect(fields: Field[], form: Form.Values) {
  const values: Record<string, unknown> = {}
  const put = (key: string, value: unknown) => {
    if (Array.isArray(value) ? value.length : typeof value === "string" && value.trim()) values[key] = value
  }
  for (const f of fields) {
    const raw = form[f.key]
    switch (f.type) {
      case "text":
        put(f.key, raw === CUSTOM ? form[`${f.key}${CUSTOM}`] : raw)
        break
      case "list":
        put(f.key, lines(raw))
        break
      case "datetime":
        if (raw instanceof Date) put(f.key, localDateTime(raw))
        break
      case "checks":
        for (const i of f.inline) put(i.key, form[i.key])
        put(
          f.key,
          f.options.filter((_, i) => form[`${f.key}::${i}`]),
        )
        break
      case "table":
        put(
          f.key,
          lines(raw).map((line) => {
            const cells = line.split("|").map((c) => c.trim())
            return Object.fromEntries(f.columns.flatMap((c, i) => (cells[i] ? [[c.key, cells[i]]] : [])))
          }),
        )
        break
      case "charges":
        put(f.key, raw)
        break
      case "choice":
        break
    }
  }
  return values
}

const lines = (text: unknown) =>
  typeof text === "string"
    ? text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
    : []

/** As a datetime-local input writes it, e.g. "2026-10-27T19:30". */
function localDateTime(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
