import { useCallback, useMemo } from "react"
import { useAtom } from "@effect/atom-react"
import * as Schema from "effect/Schema"
import { stored } from "@/lib/storage"
import { Operation, type Item, type Patrol, type Person, type Vehicle } from "./types"

const NO_OPERATIONS: Operation[] = []

export const operationsAtom = stored("einsatzleitung:einsaetze", Schema.Array(Operation), NO_OPERATIONS)

const uid = () => crypto.randomUUID()

export const newPatrol = (): Patrol => ({
  id: uid(),
  checked: false,
  einheit: "",
  aufgabe: "",
  beamte: ["", "", "", ""],
  anmerkung: "",
})

export const newVehicle = (): Vehicle => ({
  id: uid(),
  modell: "",
  kennzeichen: "",
  eigentuemer: "",
  status: "",
  durchsucht: "",
  anmerkung: "",
})

export const newPerson = (): Person => ({
  id: uid(),
  name: "",
  beamter: "",
  rolle: "",
  anmerkung: "",
  belehrung: { anwalt: "", kanzlei: "", belehrtVon: "", zeuge: "", belehrtUm: "" },
  gegenstaende: [],
  ed: [],
})

export const newItem = (): Item => ({ id: uid(), gegenstand: "", anzahl: "", tatmittel: "", anmerkung: "" })

/** The stored operations, newest first, and everything that changes them. */
export function useOperations() {
  const [stored, setOperations] = useAtom(operationsAtom)
  const operations = useMemo(() => [...stored].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [stored])

  /** Applies `fn` to operation `id` as it is stored by then. */
  const change = useCallback(
    (id: string, fn: (o: Operation) => Operation) =>
      setOperations((prev) => prev.map((o) => (o.id === id ? { ...fn(o), updatedAt: new Date().toISOString() } : o))),
    [setOperations],
  )

  const actions = useMemo(
    () => ({
      change,
      /** Creates an operation with one empty patrol and returns its id. */
      create(title: string) {
        const at = new Date().toISOString()
        const operation: Operation = {
          id: uid(),
          title,
          ort: "",
          leitung: "",
          patrols: [newPatrol()],
          vehicles: [],
          people: [],
          infos: [],
          createdAt: at,
          updatedAt: at,
        }
        setOperations((prev) => [...prev, operation])
        return operation.id
      },
      remove(id: string) {
        setOperations((prev) => prev.filter((o) => o.id !== id))
      },
      /** Puts back an operation removed with `remove`. */
      restore(operation: Operation) {
        setOperations((prev) => (prev.some((o) => o.id === operation.id) ? prev : [...prev, operation]))
      },
    }),
    [change, setOperations],
  )

  return useMemo(() => ({ operations, ...actions }), [operations, actions])
}

export type OperationsApi = ReturnType<typeof useOperations>
