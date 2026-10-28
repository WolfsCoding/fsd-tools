import * as Effect from "effect/Effect"
import { net, protocol } from "electron"
import * as fs from "node:fs"
import * as path from "node:path"
import { pathToFileURL } from "node:url"

export const SCHEME = "app"
/** A fixed, standard origin keeps localStorage (all the app's data) the same across updates. */
export const ORIGIN = `${SCHEME}://fsd-tools`

/** Must run synchronously before Electron emits ready. */
export function registerSchemes() {
  protocol.registerSchemesAsPrivileged([
    { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
  ])
}

/** Serves `dist`, falling back to index.html for the app's own paths (`/fsu/...`). */
export const serveDist = (dist: string) =>
  Effect.sync(() => {
    protocol.handle(SCHEME, (request) => {
      const { pathname } = new URL(request.url)
      const file = path.normalize(path.join(dist, decodeURIComponent(pathname)))
      const inDist = file.startsWith(dist + path.sep)
      const exists = inDist && fs.existsSync(file) && fs.statSync(file).isFile()
      return net.fetch(pathToFileURL(exists ? file : path.join(dist, "index.html")).toString())
    })
  })
