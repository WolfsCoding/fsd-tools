// `bun run desktop`: builds the desktop shell, starts Vite and opens the shell on it.
const URL = "http://localhost:5173"

const shell = Bun.spawn(["bun", "run", "build:electron"], { stdout: "inherit", stderr: "inherit" })
if ((await shell.exited) !== 0) process.exit(1)

const vite = Bun.spawn(["bunx", "vite", "--port", "5173", "--strictPort"], { stdout: "inherit", stderr: "inherit" })

// Wait for Vite to answer before opening the window.
for (;;) {
  try {
    await fetch(URL)
    break
  } catch {
    await Bun.sleep(200)
  }
}

const electron = Bun.spawn(["bunx", "electron", "."], {
  stdout: "inherit",
  stderr: "inherit",
  env: { ...process.env, ELECTRON_DEV_URL: URL },
})
await electron.exited
vite.kill()
