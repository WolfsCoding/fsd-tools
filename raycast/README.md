# FSD Tools for Raycast (Windows)

Talks to the running FSD Tools app; it has no data of its own. Akten created here are saved in the app like any other.

- **Speedingticket**: the Geschwindigkeitsmessung form.
- **Akte erstellen**: any template of the app that can start an Akte.
- **Gesetzbuch durchsuchen**: the app's search ("§ 17 TO", "to", "raub"), with the wording and fines of each paragraph.
- **Kennzeichen abfragen**: the app's Kennzeichen table, searchable and filtered by status or date; new plates can be recorded, a status set, and the ticket of a fake plate copied.

Forms are built from the app's templates, so new fields show up without changing the extension. Fields the app works out itself (e.g. the fine tier of a Speedingticket) aren't asked; the form shows them as soon as the fields they follow from are filled. Tables are one row per line with the cells separated by `|`. Straftaten are picked from the law books; quantities and amounts are set in the app. A form can create the Akte and copy or paste its Markdown, open it in the app, or only copy the Markdown without saving.

If the app isn't running, the commands offer to start it. Set the app's path in the extension's preferences if it isn't installed in the default folder (`%LOCALAPPDATA%\Programs\fsd-tools`).

## Setup

```sh
cd raycast
bun install
bun run dev     # adds the extension to Raycast and rebuilds on changes
bun run build   # builds it into Raycast's extensions folder (~/.config/raycast-x/extensions/fsd-tools)
```

`ray build` type-checks with `node_modules/.bin/tsc`, which bun doesn't create on Windows; `postinstall` adds it (`scripts/link-tsc.ts`).

## The app's API

The desktop app listens on `127.0.0.1` (port 47821, or a free one if that's busy) and writes `{ port, token }` to `%APPDATA%\FSD Tools\api.json` while it runs. Every request needs `Authorization: Bearer <token>`. Parameters go in the query or a JSON body; `open: true` brings the window to the front.

| Route | Parameters | Returns |
| --- | --- | --- |
| `/status` | | own name and department |
| `/templates` | | the templates with their sections and fields |
| `/documents` | `template`, `values`, `save` (default true), `open` | `{ id, title, path, markdown, missing, choices }`; `choices` are the fields the app derives, e.g. the fine tier |
| `/offenses` | | every chargeable offense with its fine |
| `/law-book/search` | `q` | matching paragraphs with their sections and offenses |
| `/open` | `path`, e.g. `/law-book/to/17` | |
| `/plates` | `q`, `status` (offen/gueltig/ungueltig), `date` (heute/woche/monat) | the plate checks, with the `ticket` markdown of a fake plate |
| `/plates/create` | `driver`, `holder`, `plate`, `model`, `date`, `scene`, `status`, `open` | the new check |
| `/plates/status` | `id`, `status` | the check |

The routes are answered by the page in `src/components/desktop-api.tsx`; the server is `electron/services/LocalApi.ts`.
