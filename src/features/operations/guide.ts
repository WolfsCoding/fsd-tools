import type { Fallback, LageFactor, LeadRole, Priority } from "./types"

// Wording follows the "Leitfaden für Einsatzleitungen" of the HWP Patrol.

export const PRIORITY_LABEL: Record<Priority, string> = {
  eigenschutz: "Eigenschutz",
  leben: "Leib und Leben",
  gefahrenabwehr: "Gefahrenabwehr",
  strafverfolgung: "Strafverfolgung",
  sachwerte: "Sachwerte",
}

export const PRIORITY_HINT: Record<Priority, string> = {
  eigenschutz: "Ich selbst, Kollegen",
  leben: "Alle: Unbeteiligte, Geiseln, Opfer, Verwundete, Tatverdächtige",
  gefahrenabwehr: "Leib und Leben, Infrastruktur, Staatsschutz",
  strafverfolgung: "Täter festnehmen, Beweise sichern",
  sachwerte: "Fahrzeuge, Gebäude, Eigentum",
}

export const FACTOR_LABEL: Record<LageFactor, string> = {
  verletzte: "Verletzte",
  geiseln: "Geiseln",
  bewaffnete: "Bewaffnete",
  fluchtfahrzeuge: "Fluchtfahrzeuge",
  gefahrenbereich: "Gefahrenbereich",
}

export const FACTOR_PLACEHOLDER: Record<LageFactor, string> = {
  verletzte: "Wie viele, wo, EMS informiert?",
  geiseln: "Anzahl, Zustand, wo?",
  bewaffnete: "Anzahl, Bewaffnung, Position?",
  fluchtfahrzeuge: "Modell, Farbe, Kennzeichen, Richtung?",
  gefahrenbereich: "Sperrzone, Schusslinie, Feuer?",
}

export const LEAD_LABEL: Record<LeadRole, string> = {
  el: "Einsatzleitung",
  coel: "Co-Einsatzleitung",
  absperrung: "Absperrung / Straßensperren",
  verhandlung: "Verhandlungsführung",
  zugriff: "Zugriffsteam",
  ems: "EMS / Verwundetenversorgung",
  tv: "Sammelpunkt Tatverdächtige",
  zeugen: "Sammelpunkt Zeugen / Opfer",
  beweise: "Beweissicherung",
  akten: "Aktenpflege / Informationen",
  abhandlung: "Inhaftierung / Abhandlung",
  funk: "Funkkoordination",
}

/** Short names for badges and history lines. */
export const LEAD_SHORT: Record<LeadRole, string> = {
  el: "EL",
  coel: "Co-EL",
  absperrung: "Absperrung",
  verhandlung: "Verhandlung",
  zugriff: "Zugriff",
  ems: "EMS",
  tv: "TV-Sammelpunkt",
  zeugen: "Zeugen/Opfer",
  beweise: "Beweise",
  akten: "Akten",
  abhandlung: "Abhandlung",
  funk: "Funk",
}

export const FALLBACK_LABEL: Record<Fallback, string> = {
  schuesse: "Bei Schüssen",
  flucht: "Bei Flucht",
  verhandlung: "Verhandlung scheitert",
}

/** "Entscheidungen prüfen": asked before every bigger measure. */
export const DECISION_QUESTIONS = [
  "Was ist unser Ziel?",
  "Ist die Maßnahme verhältnismäßig?",
  "Gibt es eine mildere Alternative?",
  "Gefährden wir Bürger, Kollegen oder Geiseln?",
  "Bringt uns die Maßnahme näher zur Lösung?",
  "Können wir sie später sauber erklären?",
]

/** Typical decisions the leader has to make. */
export const TYPICAL_DECISIONS = [
  "Verhandeln, Frist setzen oder Zugriff?",
  "Forderung akzeptieren oder ablehnen?",
  "Bereich sperren?",
  "Wer sichert Zeugen und Verletzte?",
  "Welche Täter verfolgen?",
]

export const RADIO_RULES = [
  "Klare, kurze Befehle. Keine Diskussion während der Lage.",
  "Rückmeldung einfordern: „Verstanden?“, „Status?“, „Position?“",
  "Wichtiges wiederholen lassen, Lagebild regelmäßig durchgeben.",
  "Keine Nebengespräche, keine Panik, keine unnötigen Kommentare.",
]

/** Changes that have to be reported at once. */
export const URGENT_REPORTS = ["Schüsse", "Flucht", "Verletzte", "Neue Gefahr", "Zugriff"]

export const DEBRIEF_POINTS = [
  "Wer wurde festgenommen?",
  "Wer ist verletzt?",
  "Welche Beweise gibt es?",
  "Wer schreibt welche Akte?",
  "Was lief gut, was muss besser laufen?",
]
