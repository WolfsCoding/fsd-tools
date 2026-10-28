// Local API for other apps on this PC, e.g. the Raycast extension in `raycast/`. Listens on
// 127.0.0.1 only and asks for the token written to `api.json` in the user data folder, so
// websites can't use it. The page answers the requests (src/components/desktop-api.tsx),
// as the data lives in its localStorage.

import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as HttpRouter from "effect/http/HttpRouter"
import * as HttpServer from "effect/http/HttpServer"
import type * as HttpServerRequest from "effect/http/HttpServerRequest"
import * as HttpServerResponse from "effect/http/HttpServerResponse"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import type * as Scope from "effect/Scope"
import * as crypto from "node:crypto"
import * as fs from "node:fs"
import * as http from "node:http"
import * as net from "node:net"
import * as path from "node:path"
import { ApiResponse, type ApiRequest } from "../../src/contracts/desktop"
import { IpcChannels } from "../../src/contracts/ipc"
import { DesktopIpc } from "./DesktopIpc"
import { ElectronApp } from "./ElectronApp"
import { MainWindow } from "./MainWindow"

/** Tried first so the port stays the same; another one is taken if it is busy. */
const PREFERRED_PORT = 47821
const HOST = "127.0.0.1"
const TIMEOUT = "10 seconds"
const MAX_BODY = 1024 * 1024

export class LocalApi extends Context.Service<
  LocalApi,
  {
    /** Serves the API while the scope lives and keeps `api.json` current. */
    readonly start: Effect.Effect<void, never, Scope.Scope>
  }
>()("fsd-tools/desktop/LocalApi") {}

const json = (status: number, payload: unknown) => HttpServerResponse.jsonUnsafe(payload, { status })

/** `preferred` while it is free, else 0 (any free port). */
const freePort = (preferred: number) =>
  Effect.callback<number>((resume) => {
    const probe = net.createServer()
    probe.once("error", () => resume(Effect.succeed(0)))
    probe.listen(preferred, HOST, () => probe.close(() => resume(Effect.succeed(preferred))))
  })

export const make = Effect.gen(function* () {
  const app = yield* ElectronApp
  const ipc = yield* DesktopIpc
  const window = yield* MainWindow

  const token = crypto.randomBytes(32).toString("hex")
  const file = path.join(app.userDataPath, "api.json")
  const pending = new Map<string, (response: ApiResponse) => void>()

  const authorized = (header: string) => {
    const given = Buffer.from(header.replace(/^Bearer\s+/i, ""))
    const expected = Buffer.from(token)
    return given.length === expected.length && crypto.timingSafeEqual(given, expected)
  }

  /** Forwards a request to the page and waits for its answer. */
  const ask = (route: string, body: Record<string, unknown>): Effect.Effect<ApiResponse> =>
    Effect.gen(function* () {
      const win = yield* window.current
      const id = crypto.randomUUID()
      if (Option.isNone(win)) return { id, ok: false, error: "Das Fenster ist geschlossen." }
      const answer = yield* Effect.callback<ApiResponse>((resume) => {
        pending.set(id, (response) => resume(Effect.succeed(response)))
        const request: ApiRequest = { id, route, body }
        win.value.webContents.send(IpcChannels.apiRequest, request)
        return Effect.sync(() => pending.delete(id))
      }).pipe(Effect.timeoutOption(TIMEOUT))
      return Option.getOrElse(answer, (): ApiResponse => ({ id, ok: false, error: "Die App hat nicht rechtzeitig geantwortet." }))
    })

  const handle = (request: HttpServerRequest.HttpServerRequest) =>
    Effect.gen(function* () {
      if (!authorized(request.headers["authorization"] ?? "")) return json(401, { error: "Ungültiger Token." })
      const url = new URL(request.url, "http://localhost")
      const raw = yield* request.text
      if (raw.length > MAX_BODY) return json(413, { error: "Anfrage zu groß." })
      let body: Record<string, unknown> = Object.fromEntries(url.searchParams)
      if (raw) {
        try {
          body = { ...body, ...(JSON.parse(raw) as Record<string, unknown>) }
        } catch {
          return json(400, { error: "Ungültiges JSON." })
        }
      }
      // Opening something brings the window to the front.
      if (body.open) yield* window.show
      const response = yield* ask(url.pathname, body)
      return response.ok ? json(200, response.data ?? null) : json(response.status ?? 500, { error: response.error })
    }).pipe(Effect.catchCause(() => Effect.succeed(json(400, { error: "Ungültige Anfrage." }))))

  const routes = HttpRouter.add("*", "/*", handle)

  // Written once the server listens, so the Raycast extension finds the port and the token.
  const announce = HttpRouter.use(() =>
    Effect.gen(function* () {
      const { address } = yield* HttpServer.HttpServer
      if (address._tag === "UnixPathAddress") return
      fs.writeFileSync(file, JSON.stringify({ port: address.port, token, pid: process.pid }), { mode: 0o600 })
    }),
  )

  const start = Effect.gen(function* () {
    yield* ipc.on({
      channel: IpcChannels.apiResponse,
      payload: ApiResponse,
      handler: (response) =>
        Effect.sync(() => {
          pending.get(response.id)?.(response)
          pending.delete(response.id)
        }),
    })

    const port = yield* freePort(PREFERRED_PORT)
    const server = HttpRouter.serve(Layer.mergeAll(routes, announce), { disableLogger: true, disableListenLog: true }).pipe(
      Layer.provide(NodeHttpServer.layer(() => http.createServer(), { port, host: HOST })),
    )
    yield* Layer.launch(server).pipe(
      Effect.catchCause((cause) => Effect.logError("The local API could not start", cause)),
      Effect.forkScoped,
    )
    yield* Effect.addFinalizer(() => Effect.sync(() => fs.rmSync(file, { force: true })))
    yield* app.on("will-quit", () => fs.rmSync(file, { force: true }))
  })

  return LocalApi.of({ start })
})

export const layer = Layer.effect(LocalApi, make)
