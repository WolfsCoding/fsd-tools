// Templates of the examination steps of the cyber forensics and the other items: an examination
// and its result, edited in the settings. "XXX" marks what is filled in by hand.

import * as Schema from "effect/Schema"
import { Snippet, type SnippetsAtom } from "@/features/case-files/snippets"
import { stored } from "@/lib/storage"

const step = (id: string, title: string, text: string): Snippet => ({ id, title, text })

const CYBER_STEPS = [
  step("cyber-sicht", "Sichtprüfung", "Das Gerät wurde äußerlich begutachtet und fotografiert. Zustand: XXX. Beschädigungen oder Umbauten: XXX."),
  step("cyber-spuren", "Spurensicherung", "Gehäuse, Display und Tasten wurden auf DNA und Fingerabdrücke untersucht. Ergebnis: XXX."),
  step("cyber-entsperrung", "Entsperrung", "Das Gerät war mit XXX gesperrt und wurde mit forensischer Software entsperrt."),
  step("cyber-extraktion", "Datenextraktion", "Der Speicher wurde vollständig ausgelesen und als 1:1-Kopie in der Asservatenkammer gesichert."),
  step("cyber-kontakte", "Kontakte und Anrufliste", "Es wurden XXX Kontakte und XXX Anrufe ausgewertet. Auffällig sind: XXX."),
  step("cyber-chats", "Nachrichten und Chatverläufe", "Die Nachrichten und Chatverläufe wurden ausgewertet. Sie deuten auf XXX hin."),
  step("cyber-standort", "Standortdaten", "Die Standortdaten zeigen, dass sich das Gerät am XXX um XXX Uhr im Bereich XXX befand."),
  step("cyber-medien", "Fotos und Videos", "Auf dem Gerät wurden XXX Fotos bzw. Videos gefunden. Sie zeigen XXX."),
  step("cyber-software", "Installierte Software", "Auf dem Gerät ist folgende auffällige Software installiert: XXX. Sie dient zum XXX."),
  step("cyber-funk", "Funkfrequenzen", "Im Gerät sind die Frequenzen XXX gespeichert. Darunter befindet sich XXX."),
  step("cyber-fahrzeug", "Fahrzeugchip", "Der Chip wurde mit einem Diagnosegerät ausgelesen. Er gehört zum Fahrzeug mit dem Kennzeichen XXX. Auffällig: XXX."),
  step("cyber-nichts", "Keine verwertbaren Daten", "Auf dem Gerät wurden keine verwertbaren Daten gefunden."),
]

const ITEM_STEPS = [
  step("gegenstand-sicht", "Sichtprüfung", "Der Gegenstand wurde begutachtet und fotografiert. Beschreibung (Farbe, Größe, Material, Zustand): XXX."),
  step("gegenstand-spuren", "Spurensicherung", "Der Gegenstand wurde auf DNA und Fingerabdrücke untersucht. Ergebnis: XXX."),
  step(
    "gegenstand-echtheit",
    "Echtheitsprüfung",
    "Merkmale wie Hologramm, Wasserzeichen, Stempel und Unterschrift wurden geprüft. Der Gegenstand ist XXX (echt / gefälscht).",
  ),
  step("gegenstand-register", "Registerabgleich", "Die Angaben wurden mit XXX abgeglichen. Ergebnis: XXX."),
  step("gegenstand-oeffnung", "Öffnung des Behältnisses", "Das Behältnis wurde geöffnet. Darin befanden sich: XXX. Der Inhalt wurde gesondert asserviert."),
  step("gegenstand-zaehlung", "Zählung", "Der Inhalt wurde gezählt: XXX Stück, Gesamtwert $XXX."),
  step("gegenstand-markierung", "Prüfung auf Markierungen", "Der Gegenstand wurde unter UV-Licht geprüft. Festgestellt wurde: XXX."),
  step("gegenstand-probe", "Materialprobe", "Eine Probe von XXX wurde entnommen und zur toxikologischen Analyse übergeben."),
  step("gegenstand-nichts", "Keine Auffälligkeiten", "Es wurden keine Auffälligkeiten festgestellt."),
]

/** The templates of the cyber forensics; the examples above until they're edited. */
export const cyberStepsAtom = stored("forensik:vorlagen:cyber", Schema.Array(Snippet), CYBER_STEPS)
/** The templates of the other items; the examples above until they're edited. */
export const itemStepsAtom = stored("forensik:vorlagen:gegenstand", Schema.Array(Snippet), ITEM_STEPS)

/** The usual examination of a kind of item ("Art"): templates by id, in the order they're done. */
export interface Playbook {
  art: string
  steps: string[]
}

const CYBER_PLAYBOOKS: Playbook[] = [
  {
    art: "Smartphone",
    steps: ["sicht", "spuren", "entsperrung", "extraktion", "kontakte", "chats", "standort", "medien"].map((s) => `cyber-${s}`),
  },
  { art: "Tablet", steps: ["sicht", "spuren", "entsperrung", "extraktion", "chats", "medien", "software"].map((s) => `cyber-${s}`) },
  { art: "Laptop", steps: ["sicht", "spuren", "entsperrung", "extraktion", "chats", "medien", "software"].map((s) => `cyber-${s}`) },
  { art: "Datenträger", steps: ["sicht", "spuren", "extraktion", "medien", "software"].map((s) => `cyber-${s}`) },
  { art: "Funkgerät", steps: ["sicht", "spuren", "funk"].map((s) => `cyber-${s}`) },
  { art: "Fahrzeugchip", steps: ["sicht", "fahrzeug"].map((s) => `cyber-${s}`) },
]

const ITEM_PLAYBOOKS: Playbook[] = [
  { art: "Dokument", steps: ["sicht", "spuren", "echtheit", "register"].map((s) => `gegenstand-${s}`) },
  { art: "Behältnis", steps: ["sicht", "spuren", "oeffnung"].map((s) => `gegenstand-${s}`) },
  { art: "Bargeld", steps: ["sicht", "zaehlung", "markierung", "echtheit"].map((s) => `gegenstand-${s}`) },
  { art: "Unbekannter Stoff", steps: ["sicht", "spuren", "probe"].map((s) => `gegenstand-${s}`) },
]

const PLAYBOOKS = new Map<SnippetsAtom, Playbook[]>([
  [cyberStepsAtom, CYBER_PLAYBOOKS],
  [itemStepsAtom, ITEM_PLAYBOOKS],
])

/** The usual examinations of the kinds of items whose templates are in `atom`. */
export const playbooksOf = (atom: SnippetsAtom | undefined) => (atom && PLAYBOOKS.get(atom)) || []
