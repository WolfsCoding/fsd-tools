import { useState } from "react"
import { PlusIcon, RotateCcwIcon, Trash2Icon } from "lucide-react"
import { Hint } from "@/components/hint"
import { SettingsRow, SettingsSection, SettingsValue } from "@/components/settings-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { removedToast } from "@/lib/undo"
import { DEFAULT_COLORS, DEFAULT_DEPARTMENT, ME, NOW, type Colors } from "./markdown"
import { usePoliceFiles } from "./police-files"
import { snippetLabel, useSnippets, type Snippet } from "./snippets"
import { useColors, useOwnIdentity } from "./use-case-files"

/** Settings page "Eigene Person": who fills in the Akten and analyses. */
export function OwnPersonSettings() {
  const { name, rank, department, setName, setRank, setDepartment } = useOwnIdentity()
  return (
    <SettingsSection>
      <SettingsRow
        htmlFor="akten-me-rank"
        title="Rang"
        description="Steht vor deinem Namen und wird in der Streifenbesetzung eingetragen."
      >
        <Input
          id="akten-me-rank"
          value={rank}
          onChange={(e) => setRank(e.target.value)}
          placeholder="Officer I"
          className="w-60"
        />
      </SettingsRow>
      <SettingsRow
        htmlFor="akten-me-name"
        title="Name"
        description="Wird mit deinem Rang überall eingesetzt, wo du selbst gemeint bist, etwa als aussagender Officer oder Forensiker."
      >
        <Input
          id="akten-me-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ryan Shaw"
          className="w-60"
        />
      </SettingsRow>
      <SettingsRow
        htmlFor="akten-me-department"
        title="Department"
        description="Steht im Kopf jeder Akte und Analyse und gilt in der Streifenbesetzung, solange dort kein anderes eingetragen ist."
      >
        <Input
          id="akten-me-department"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          placeholder={DEFAULT_DEPARTMENT}
          className="w-60"
        />
      </SettingsRow>
    </SettingsSection>
  )
}

/** Settings page "Markdown": how the copied markdown looks. */
export function MarkdownSettings() {
  return (
    <SettingsSection title="Farben">
      <ColorRow
        colorKey="heading"
        title="Farbe der Abschnitte"
        description="Überschriften wie „1. Tathergang:“."
      />
    </SettingsSection>
  )
}

/** Color names that may be typed instead of a code, so the picker can show them. */
const NAMED: Record<string, string> = { orange: "#ffa500" }

/** A color picker next to the color code, which also accepts names like "orange". */
function ColorRow({ colorKey, title, description }: { colorKey: keyof Colors; title: string; description: string }) {
  const { colors, stored, setColor } = useColors()
  const value = stored[colorKey] ?? colors[colorKey]
  const hex = /^#[0-9a-f]{6}$/i.test(colors[colorKey]) ? colors[colorKey] : (NAMED[colors[colorKey].toLowerCase()] ?? "#000000")
  const id = `akten-color-${colorKey}`
  return (
    <SettingsRow htmlFor={id} title={title} description={description}>
      <input
        type="color"
        value={hex}
        onChange={(e) => setColor(colorKey, e.target.value.toUpperCase())}
        aria-label={`${title} wählen`}
        // The swatch fills the square, so it shows as one rounded color block.
        className="size-9 shrink-0 cursor-pointer appearance-none overflow-hidden rounded-lg border bg-transparent p-0 [&::-moz-color-swatch]:rounded-lg [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded-lg [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
      />
      <Input
        id={id}
        value={value}
        onChange={(e) => setColor(colorKey, e.target.value)}
        placeholder={DEFAULT_COLORS[colorKey]}
        spellCheck={false}
        className="w-32 font-mono"
      />
      {/* The span keeps the tooltip working while the button is disabled. */}
      <Hint label={`Zurücksetzen auf ${DEFAULT_COLORS[colorKey]}`}>
        <span className="flex shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setColor(colorKey, "")}
            disabled={colors[colorKey] === DEFAULT_COLORS[colorKey]}
            aria-label={`${title} zurücksetzen`}
          >
            <RotateCcwIcon />
          </Button>
        </span>
      </Hint>
    </SettingsRow>
  )
}

/** Section "Textbausteine" of the Akten settings: own snippets for the multi-line fields. */
export function SnippetsSettings() {
  const { snippets, addSnippet, updateSnippet, removeSnippet, restoreSnippet } = useSnippets()
  // The snippet just added; its title gets the focus.
  const [added, setAdded] = useState<string>()

  function remove(snippet: Snippet) {
    const index = snippets.indexOf(snippet)
    removeSnippet(snippet.id)
    // An empty snippet isn't worth putting back.
    if (snippet.title.trim() || snippet.text.trim())
      removedToast(`Textbaustein „${snippetLabel(snippet)}“`, () => restoreSnippet(snippet, index))
  }

  return (
    <SettingsSection title="Textbausteine">
      {snippets.length === 0 && (
        <p className="py-4 text-sm text-muted-foreground">
          Noch keine Textbausteine. Lege wiederkehrende Formulierungen an, etwa die Belehrung oder Bausteine für den
          Tathergang. Im Formular fügt „Textbaustein einfügen“ sie an der Cursorposition ein. Platzhalter wie{" "}
          <code className="rounded bg-muted px-1 font-mono text-xs">{ME}</code> oder{" "}
          <code className="rounded bg-muted px-1 font-mono text-xs">{NOW}</code> werden beim Kopieren ersetzt; jede
          Zeile wird ein eigener Punkt.
        </p>
      )}
      {snippets.map((s) => (
        <div key={s.id} className="grid gap-2 py-4">
          <div className="flex items-center gap-2">
            <Input
              value={s.title}
              onChange={(e) => updateSnippet(s.id, { title: e.target.value })}
              placeholder="Titel, z. B. Belehrung"
              aria-label="Titel des Textbausteins"
              autoFocus={s.id === added}
              className="flex-1"
            />
            <Hint label="Löschen">
              <Button variant="ghost" size="icon" onClick={() => remove(s)} aria-label={`${snippetLabel(s)} löschen`}>
                <Trash2Icon />
              </Button>
            </Hint>
          </div>
          <Textarea
            value={s.text}
            onChange={(e) => updateSnippet(s.id, { text: e.target.value })}
            placeholder="Text des Bausteins; jede Zeile wird ein eigener Punkt"
            aria-label={`Text von ${snippetLabel(s)}`}
            spellCheck={false}
          />
        </div>
      ))}
      <div className="py-4">
        <Button variant="outline" onClick={() => setAdded(addSnippet())}>
          <PlusIcon /> Textbaustein hinzufügen
        </Button>
      </div>
    </SettingsSection>
  )
}

/** Rows for the "Daten" section of the feature's settings page. */
export function CaseFilesSettings() {
  const { caseFiles } = usePoliceFiles()
  return (
    <SettingsRow title="Akten">
      <SettingsValue>{caseFiles.length.toLocaleString("de-DE")}</SettingsValue>
    </SettingsRow>
  )
}
