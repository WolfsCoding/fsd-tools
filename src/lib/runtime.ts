import { AtomRegistry } from "effect/reactivity"

/** The one atom registry of the app; modules outside React read and write atoms through it. */
export const appRegistry = AtomRegistry.make()
