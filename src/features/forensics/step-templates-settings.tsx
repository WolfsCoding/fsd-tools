import { SnippetList, SnippetsSettings } from "@/features/case-files/case-files-settings"
import { cyberStepsAtom, itemStepsAtom } from "./step-templates"

/** The Akten's own settings: the Textbausteine, then the templates of the analyses. */
export function CaseFilesPreferences() {
  return (
    <>
      <SnippetsSettings />
      <StepTemplatesSettings />
    </>
  )
}

const EMPTY = "Noch keine Vorlagen. Eine Vorlage ist ein Untersuchungsschritt mit seinem Ergebnis; im Formular fügt „Aus Vorlage“ sie als neuen Schritt ein."

/** Sections of the Akten settings with the templates of the examination steps. */
function StepTemplatesSettings() {
  return (
    <>
      <SnippetList
        atom={cyberStepsAtom}
        title="Vorlagen: Cyberforensische Analyse"
        noun="Vorlage"
        titlePlaceholder="Untersuchung, z. B. Datenextraktion"
        textPlaceholder="Ergebnis; XXX für das, was von Hand ausgefüllt wird"
        empty={EMPTY}
      />
      <SnippetList
        atom={itemStepsAtom}
        title="Vorlagen: Forensische Analyse (Gegenstand)"
        noun="Vorlage"
        titlePlaceholder="Untersuchung, z. B. Echtheitsprüfung"
        textPlaceholder="Ergebnis; XXX für das, was von Hand ausgefüllt wird"
        empty={EMPTY}
      />
    </>
  )
}
