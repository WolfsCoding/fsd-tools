import { Action, ActionPanel, Icon, List } from "@raycast/api"
import { AppNotRunning, launchApp } from "./api"

/** Empty view of a list whose request failed; offers to start the app when it isn't running. */
export function ErrorView({ error, retry }: { error: Error; retry: () => void }) {
  const notRunning = error instanceof AppNotRunning
  return (
    <List.EmptyView
      icon={notRunning ? Icon.Plug : Icon.Warning}
      title={notRunning ? "FSD Tools läuft nicht" : "Fehler"}
      description={notRunning ? "Starte die App und versuche es noch einmal." : error.message}
      actions={
        <ActionPanel>
          {notRunning && (
            <Action
              title="FSD Tools starten"
              icon={Icon.Play}
              onAction={async () => {
                await launchApp()
                // The app needs a moment to open its API.
                setTimeout(retry, 3000)
              }}
            />
          )}
          <Action title="Erneut versuchen" icon={Icon.ArrowClockwise} onAction={retry} />
        </ActionPanel>
      }
    />
  )
}
