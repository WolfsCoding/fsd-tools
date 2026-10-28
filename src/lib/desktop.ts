import { useAtomValue } from "@effect/atom-react"
import * as Effect from "effect/Effect"
import * as Queue from "effect/Queue"
import * as Stream from "effect/Stream"
import { AsyncResult, Atom } from "effect/reactivity"
import type { DesktopBridge, UpdateState } from "@/contracts/desktop"

export type { UpdateState }

/** The desktop shell (electron/preload.ts); undefined in the browser. */
export const desktop: DesktopBridge | undefined = typeof window === "undefined" ? undefined : window.desktop

/** Thrown by an API handler to answer with that HTTP status. */
export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/**
 * The update state as the shell pushes it; null in the browser. Like T3 Code's: the
 * subscription comes first, so a state pushed while the first read is on its way wins.
 */
export const updateStateAtom = Atom.make(
  Stream.callback<UpdateState | null>((queue) =>
    Effect.gen(function* () {
      if (!desktop) {
        Queue.offerUnsafe(queue, null)
        return yield* Effect.never
      }
      let pushed = false
      yield* Effect.acquireRelease(
        Effect.sync(() =>
          desktop.updates.subscribe((state) => {
            pushed = true
            Queue.offerUnsafe(queue, state)
          }),
        ),
        (unsubscribe) => Effect.sync(unsubscribe),
      )
      const initial = yield* Effect.promise(() => desktop.updates.get()).pipe(
        Effect.catchCause(() => Effect.succeed(null)),
      )
      if (!pushed && initial) Queue.offerUnsafe(queue, initial)
      return yield* Effect.never
    }),
  ),
  { initialValue: null },
).pipe(Atom.keepAlive, Atom.withLabel("desktop:update-state"))

/** The update state of the desktop app; null in the browser. */
export function useUpdateState(): UpdateState | null {
  return AsyncResult.getOrElse(useAtomValue(updateStateAtom), () => null)
}

const appVersionAtom = Atom.make(
  Effect.promise(() => (desktop ? desktop.version() : Promise.resolve(undefined))),
).pipe(Atom.keepAlive, Atom.withLabel("desktop:app-version"))

export function useAppVersion(): string | undefined {
  return AsyncResult.getOrElse(useAtomValue(appVersionAtom), () => undefined)
}
