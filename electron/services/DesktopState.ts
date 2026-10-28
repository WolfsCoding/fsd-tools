import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Ref from "effect/Ref"

export class DesktopState extends Context.Service<
  DesktopState,
  {
    /** Set once the app quits (or restarts into an update), so closing the window no longer just hides it. */
    readonly quitting: Ref.Ref<boolean>
  }
>()("fsd-tools/desktop/DesktopState") {}

export const layer = Layer.effect(
  DesktopState,
  Effect.gen(function* () {
    return DesktopState.of({ quitting: yield* Ref.make(false) })
  }),
)
