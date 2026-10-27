// Local API for other apps on this PC, e.g. the Raycast extension in `raycast/`. Listens on
// 127.0.0.1 only and asks for the token written to `api.json` in the user data folder, so
// websites can't use it. The page answers the requests (src/components/desktop-api.tsx),
// as the data lives in its localStorage.
const { app, ipcMain } = require("electron")
const crypto = require("node:crypto")
const fs = require("node:fs")
const http = require("node:http")
const path = require("node:path")

/** Tried first so the port stays the same; another one is taken if it is busy. */
const PREFERRED_PORT = 47821
const TIMEOUT = 10_000
const MAX_BODY = 1024 * 1024

/** @type {Map<string, (response: { ok: boolean, data?: unknown, error?: string }) => void>} */
const pending = new Map()

/** Starts the API; `getWindow` returns the window whose page answers. */
function startApi(getWindow) {
  const token = crypto.randomBytes(32).toString("hex")
  const file = path.join(app.getPath("userData"), "api.json")

  ipcMain.on("api:response", (_, { id, ...response }) => {
    pending.get(id)?.(response)
    pending.delete(id)
  })

  /** Forwards a request to the page and waits for its answer. */
  function ask(route, body) {
    const win = getWindow()
    if (!win) return Promise.resolve({ ok: false, error: "Das Fenster ist geschlossen." })
    const id = crypto.randomUUID()
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        pending.delete(id)
        resolve({ ok: false, error: "Die App hat nicht rechtzeitig geantwortet." })
      }, TIMEOUT)
      pending.set(id, (response) => {
        clearTimeout(timer)
        resolve(response)
      })
      win.webContents.send("api:request", { id, route, body })
    })
  }

  const server = http.createServer(async (req, res) => {
    const send = (status, payload) => {
      res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" })
      res.end(JSON.stringify(payload))
    }
    const auth = req.headers.authorization ?? ""
    const given = Buffer.from(auth.replace(/^Bearer\s+/i, ""))
    const expected = Buffer.from(token)
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected))
      return send(401, { error: "Ungültiger Token." })

    const url = new URL(req.url ?? "/", "http://localhost")
    const chunks = []
    let size = 0
    for await (const chunk of req) {
      chunks.push(chunk)
      size += chunk.length
      if (size > MAX_BODY) return send(413, { error: "Anfrage zu groß." })
    }
    // Joined as bytes, so characters split across chunks stay whole.
    const raw = Buffer.concat(chunks).toString("utf8")
    let body = Object.fromEntries(url.searchParams)
    if (raw) {
      try {
        body = { ...body, ...JSON.parse(raw) }
      } catch {
        return send(400, { error: "Ungültiges JSON." })
      }
    }

    // Opening something brings the window to the front.
    if (body.open) {
      const win = getWindow()
      if (win?.isMinimized()) win.restore()
      win?.show()
      win?.focus()
    }

    const response = await ask(url.pathname, body)
    if (response.ok) send(200, response.data ?? null)
    else send(response.status ?? 500, { error: response.error ?? "Unbekannter Fehler." })
  })

  const write = () => {
    const { port } = /** @type {import("node:net").AddressInfo} */ (server.address())
    fs.writeFileSync(file, JSON.stringify({ port, token, pid: process.pid }), { mode: 0o600 })
  }
  server.on("listening", write)
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") server.listen(0, "127.0.0.1")
  })
  server.listen(PREFERRED_PORT, "127.0.0.1")

  app.on("will-quit", () => {
    server.close()
    try {
      fs.rmSync(file)
    } catch {}
  })
}

module.exports = { startApi }
