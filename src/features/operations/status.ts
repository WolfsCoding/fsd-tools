import type { UnitStatus } from "./types"

export const STATUS_LABEL: Record<UnitStatus, string> = {
  verfuegbar: "Verfügbar",
  anfahrt: "Anfahrt",
  einsatz: "Im Einsatz",
  gebunden: "Beschäftigt",
  pause: "Pause",
  abgezogen: "Abgezogen",
}

/** Letter shown in the status square of a unit. */
export const STATUS_LETTER: Record<UnitStatus, string> = {
  verfuegbar: "V",
  anfahrt: "A",
  einsatz: "E",
  gebunden: "B",
  pause: "P",
  abgezogen: "X",
}

export const STATUS_HINT: Record<UnitStatus, string> = {
  verfuegbar: "Frei für neue Aufgaben",
  anfahrt: "Auf dem Weg zum Einsatzort",
  einsatz: "Am Einsatzort, arbeitet die Aufgabe ab",
  gebunden: "Durch Festnahme, Transport o. Ä. gebunden",
  pause: "Kurz nicht einsatzbereit",
  abgezogen: "Nicht mehr im Einsatz",
}

// Literal class names so Tailwind picks them up.
export const STATUS_SQUARE: Record<UnitStatus, string> = {
  verfuegbar: "bg-green-700 text-white",
  anfahrt: "bg-sky-600 text-white",
  einsatz: "bg-orange-500 text-white",
  gebunden: "bg-red-700 text-white",
  pause: "bg-zinc-500 text-white",
  abgezogen: "bg-zinc-700 text-zinc-300",
}
