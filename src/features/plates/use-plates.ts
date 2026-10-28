import { useAtom } from "@effect/atom-react"
import * as Schema from "effect/Schema"
import { useCallback } from "react"
import { localNow } from "@/features/case-files/markdown"
import { move } from "@/components/use-reorder"
import { stored } from "@/lib/storage"
import { PlateCheck, type PlateCheckInput, type PlateStatus } from "./types"

export const PLATES_KEY = "plates:checks"
const NO_CHECKS: PlateCheck[] = []

export const platesAtom = stored(PLATES_KEY, Schema.Array(PlateCheck), NO_CHECKS)

export function usePlates() {
  const [checks, setChecks] = useAtom(platesAtom)

  /** Adds a row on top, empty and dated now unless `input` says otherwise, and returns it. */
  const addCheck = useCallback(
    (input: Partial<PlateCheckInput> = {}, status: PlateStatus = "offen") => {
      const check: PlateCheck = {
        id: crypto.randomUUID(),
        driver: "",
        holder: "",
        model: "",
        plate: "",
        date: localNow(),
        scene: "",
        ...input,
        status,
        createdAt: new Date().toISOString(),
      }
      setChecks((prev) => [check, ...prev])
      return check
    },
    [setChecks],
  )

  const updateCheck = useCallback(
    (id: string, input: Partial<PlateCheckInput>) =>
      setChecks((prev) => prev.map((c) => (c.id === id ? { ...c, ...input } : c))),
    [setChecks],
  )

  const setStatus = useCallback(
    (id: string, status: PlateStatus) => setChecks((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c))),
    [setChecks],
  )

  /** Puts the check `id` where `beforeId` is, e.g. after dragging it there; by ids, so a filtered table can reorder too. */
  const moveCheck = useCallback(
    (id: string, beforeId: string) =>
      setChecks((prev) => {
        const from = prev.findIndex((c) => c.id === id)
        const to = prev.findIndex((c) => c.id === beforeId)
        return from < 0 || to < 0 ? prev : move(prev, from, to)
      }),
    [setChecks],
  )

  /** Deletes the check; the returned function puts it back where it was. */
  const deleteCheck = useCallback(
    (id: string) => {
      const index = checks.findIndex((c) => c.id === id)
      const check = checks[index]
      setChecks((prev) => prev.filter((c) => c.id !== id))
      return () =>
        setChecks((prev) =>
          !check || prev.some((c) => c.id === id) ? prev : [...prev.slice(0, index), check, ...prev.slice(index)],
        )
    },
    [checks, setChecks],
  )

  return { checks, addCheck, updateCheck, setStatus, moveCheck, deleteCheck }
}

export type PlatesApi = ReturnType<typeof usePlates>
