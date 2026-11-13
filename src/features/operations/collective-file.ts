import type { Row, Values } from "@/features/case-files/types"
import { ED_MEASURES, isAccused, type Operation, type Person } from "./types"

/** `values` without the empty ones, so the template's defaults (e.g. the own name) stay. */
function filled(values: Values): Values {
  return Object.fromEntries(Object.entries(values).filter(([, v]) => (typeof v === "string" ? v.trim() : v.length)))
}

const joined = (...parts: string[]) => parts.map((p) => p.trim()).filter(Boolean).join(" · ")

const pad = (n: number) => String(n).padStart(2, "0")

/** As a datetime-local input writes it, e.g. "2026-10-02T14:30". */
const localDateTime = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`

/** The main document of a Sammelakte about `operation`. */
export function collectiveValues(operation: Operation): Values {
  const vehicles: Row[] = operation.vehicles.map((v) => ({
    id: v.id,
    modell: v.modell,
    kennzeichen: v.kennzeichen,
    halter: v.eigentuemer,
    durchsucht: v.durchsucht,
    anmerkung: joined(v.status && `Status: ${v.status}`, v.anmerkung),
  }))
  const people: Row[] = operation.people
    .filter((p) => p.name.trim())
    .map((p) => ({ id: p.id, name: p.name, rolle: p.rolle, notiz: p.anmerkung }))
  return filled({
    tatort: operation.ort,
    datum: localDateTime(new Date(operation.createdAt)),
    leitung: operation.leitung,
    fahrzeuge: vehicles,
    beteiligte: people,
  })
}

/** The Beschuldigten-Bericht of `person`. */
export function reportValues(person: Person): Values {
  const items: Row[] = person.gegenstaende
    .filter((i) => i.gegenstand.trim())
    .map((i) => ({
      id: i.id,
      gegenstand: i.gegenstand,
      anzahl: i.anzahl,
      verlauf: person.beamter.trim() ? `Abgenommen durch ${person.beamter.trim()}` : "",
      tatmittel: i.tatmittel,
      anmerkung: i.anmerkung,
    }))
  const { anwalt, kanzlei, belehrtVon, zeuge, belehrtUm } = person.belehrung
  return filled({
    name: person.name,
    officer: person.beamter,
    gegenstaende: items,
    anwalt,
    kanzlei,
    belehrtVon,
    belehrtZeuge: zeuge,
    belehrtUm,
    todos: ED_MEASURES.filter((m) => person.ed.includes(m.id)).map((m) => m.option),
  })
}

/** The people who get a Beschuldigten-Bericht of their own. */
export const accused = (operation: Operation) => operation.people.filter((p) => p.name.trim() && isAccused(p))
