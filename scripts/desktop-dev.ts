// `bun run desktop`: starts Vite and opens the desktop shell on it.
const URL = "http://localhost:5173"

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
