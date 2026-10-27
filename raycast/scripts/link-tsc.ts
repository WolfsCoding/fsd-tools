// `ray build` type-checks with ./node_modules/.bin/tsc, which bun doesn't create on Windows
// (only tsc.exe). This adds it, run by bun through its shebang.
const shim = `#!/usr/bin/env bun\nrequire("../typescript/lib/tsc.js")\n`
await Bun.write(new URL("../node_modules/.bin/tsc", import.meta.url), shim)
