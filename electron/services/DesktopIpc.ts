import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import type * as Scope from "effect/Scope"
import type { IpcMain } from "electron"

/** An invoke handler: the payload and the result are checked against their schemas, like T3 Code's IPC methods. */
export interface IpcMethod<P, PE, R, RE, E, Ctx> {
  readonly channel: string
  readonly payload: Schema.Codec<P, PE>
  readonly result: Schema.Codec<R, RE>
  readonly handler: (payload: P) => Effect.Effect<R, E, Ctx>
}

/** A one-way message from the page (`ipcRenderer.send`). */
export interface IpcListener<P, PE, E, Ctx> {
  readonly channel: string
  readonly payload: Schema.Codec<P, PE>
  readonly handler: (payload: P) => Effect.Effect<void, E, Ctx>
}

export class DesktopIpc extends Context.Service<
  DesktopIpc,
  {
    readonly handle: <P, PE, R, RE, E, Ctx>(
      method: IpcMethod<P, PE, R, RE, E, Ctx>,
    ) => Effect.Effect<void, never, Ctx | Scope.Scope>
    readonly on: <P, PE, E, Ctx>(listener: IpcListener<P, PE, E, Ctx>) => Effect.Effect<void, never, Ctx | Scope.Scope>
  }
>()("fsd-tools/desktop/DesktopIpc") {}

export const layer = (ipcMain: IpcMain) =>
  Layer.succeed(
    DesktopIpc,
    DesktopIpc.of({
      handle: Effect.fn("DesktopIpc.handle")(function* <P, PE, R, RE, E, Ctx>({
        channel,
        payload,
        result,
        handler,
      }: IpcMethod<P, PE, R, RE, E, Ctx>) {
        const context = yield* Effect.context<Ctx>()
        const run = Effect.runPromiseWith(context)
        const decode = Schema.decodeUnknownEffect(payload)
        const encode = Schema.encodeUnknownEffect(result)
        yield* Effect.acquireRelease(
          Effect.sync(() => {
            ipcMain.removeHandler(channel)
            ipcMain.handle(channel, (_event, raw: unknown) =>
              run(decode(raw).pipe(Effect.flatMap(handler), Effect.flatMap(encode))),
            )
          }),
          () => Effect.sync(() => ipcMain.removeHandler(channel)),
        )
      }),
      on: Effect.fn("DesktopIpc.on")(function* <P, PE, E, Ctx>({ channel, payload, handler }: IpcListener<P, PE, E, Ctx>) {
        const context = yield* Effect.context<Ctx>()
        const run = Effect.runPromiseWith(context)
        const decode = Schema.decodeUnknownEffect(payload)
        const listener = (_event: unknown, raw: unknown) => {
          void run(
            decode(raw).pipe(
              Effect.flatMap(handler),
              Effect.catchCause((cause) => Effect.logError(`IPC ${channel} failed`, cause)),
            ),
          )
        }
        yield* Effect.acquireRelease(
          Effect.sync(() => {
            ipcMain.on(channel, listener)
          }),
          () => Effect.sync(() => ipcMain.removeListener(channel, listener)),
        )
      }),
    }),
  )
