# FSD Tools

Windows desktop app: Electron around Vite + React + shadcn/ui (always dark). All data lives in the app's localStorage.

```sh
bun install
bun run desktop  # the app on the Vite dev server, with hot reload
bun dev          # the same in the browser, http://localhost:5173
bun run dist     # builds the installer into release/
```

The shell is in `electron/`. It serves `dist/` under `app://fsd-tools` (a fixed origin, so the data survives updates) and falls back to `index.html` for the app's paths (`/fsu/...`). Links to other sites open in the browser. F12 opens the DevTools. Closing the window hides it to the tray icon; "Beenden" in its menu quits.

## Raycast

`raycast/` is a Raycast extension for Windows that creates Akten (e.g. a Speedingticket) and searches the Gesetzbuch through the running app. The app serves a local API for it (`electron/api.cjs`, answered by `src/components/desktop-api.tsx`); see `raycast/README.md`.

## Updates

Every push to `main` runs `.github/workflows/release.yml`: it builds the installer and publishes it as a GitHub release `v0.1.<run number>`. The minor and major version come from `package.json`; bump them there. Installed apps check the releases at start and every hour but never update on their own: a found version shows an update button at the bottom of the tool strip (and in Einstellungen › Updates) that downloads it, then offers "Neu starten" to install it. The repo must be public for the app to read the releases.

## Adding a tool

1. Create `src/features/<tool>/` with a page component.
2. Register it in `src/features/registry.tsx`. That adds its route, its sidebar entry, and its own page in the settings (with an on/off switch).
3. Put page controls in the header with `<HeaderActions>`. Add command palette entries (Ctrl/⌘+K) with `useRegisterCommands(id, groups)`. Memoize `groups`.
4. Save its data with `useLocalStorage("<tool>:<key>", FALLBACK)` from `src/lib/local-storage.ts`. Keys get the `fsd-tools:` prefix automatically.
5. Tabs work automatically: navigating inside the tool stays in its tab, and opening another tool focuses its tab or opens a new one (it never replaces the active tab's page). To name the tab after what's open (e.g. a post or note), call `useTabTitle(title)` from `src/hooks/use-tabs.ts`.
6. List those keys in the registry entry's `storage.keys`. Its settings page then shows export, import, delete and the storage size. Add `storage.validate` to check imports, and `settings` to add extra rows built with `SettingsRow` from `src/components/settings-layout.tsx`. Own settings sections go in `preferences`, built with `SettingsSection`; they appear above "Daten". Listed keys are also part of the full backup (Einstellungen › Sicherung, main menu, command palette).

Shared building blocks: `SearchField`, `NoResults`/`EmptyList`, `Combobox` and `InlineEdit` in `src/components/`, and `copy()` (`lib/clipboard.ts`), `sameText()` (`lib/text.ts`) and `removedToast()` (`lib/undo.ts`) in `src/lib/`. Deleting follows one rule: remove right away and offer "Rückgängig" in a toast instead of asking first.

If saving fails (e.g. the browser storage is full), `useLocalStorage` doesn't throw; the status bar shows a warning and points to the backup.

## FSU-Erklärungen posts

Posts are read-only in the app. Each post is a Markdown file in `src/features/fsu/posts/`, and the file name becomes the URL (`blutanalyse.md` → `/fsu/blutanalyse`). Start each file with:

```md
---
title: Blutanalyse
category: Labor
order: 1
---
```

`category` groups posts in the sidebar. `order` is optional; posts without it are sorted by title. A missing `title` falls back to the file name (with a console warning). Citations like "§ 14 Abs. 3 TO" or "TO § 14" become links into the Gesetzbuch when the paragraph exists. Markdown with tables, checklists (`- [ ]`) and note boxes (`>`) is supported.

## Gesetzbuch

The law texts in `src/features/law-book/data/` are copied from the `law-book` app; update both together. Fines are read from the wording of each Absatz in `offenses.ts` (ranges like "von 900 bis 1.600 Dollar", fixed amounts, "je Einheit", "pro unerlaubter Waffe", numbered tier lists and "gemäß Absatz N"). Only CO and TO can be charged. The Strafakte uses the picker as a calculator only; the Beschuldigten-Bericht writes it to the Markdown as "Potentielle Strafen".

An offense's id is its citation, `<book>-<§>-<Abs.>[-<Nr.>]` (e.g. `co-14-3`, `to-17-2-1`), and saved charges store it. Changing the books elsewhere doesn't change it; renumbering a § or an Absatz does, so keep numbers when editing the texts. `resolveOffense` also reads ids spelled differently (`CO-14-3`) and tier ids of an Absatz without tiers. Charges with ids it can't find stay in the document as a warning row and don't count towards the total.

The data and its helpers stay in `law-book`; the charge UI (`charges.ts`, `charges-input.tsx`, `offense-picker.tsx`) lives in `case-files` and imports from `law-book`. The one way back is the Strafrechner (`/law-book/rechner`, also in the command palette), which uses `ChargesEditor` with its own rows.

The search is in the URL (`?q=`). Search terms of one or two letters and book abbreviations ("to", "co") only match whole words. Local keys: `gesetzbuch:bookmarks` (Favoriten), `gesetzbuch:rechner` (Strafrechner), `gesetzbuch:recent-offenses` (last picked offenses, not in backups).
