import { List } from "@raycast/api"
import { usePromise } from "@raycast/utils"
import { call, type Template } from "./api"
import { DocumentForm } from "./document-form"
import { ErrorView } from "./not-running"

/** Id of the speeding template in the app. */
const SPEEDING = "geschwindigkeit"

export default function SpeedingTicket() {
  const { data, isLoading, error, revalidate } = usePromise(() => call<Template[]>("/templates"))
  const template = data?.find((t) => t.id === SPEEDING)

  if (template) return <DocumentForm template={template} />
  return (
    <List isLoading={isLoading}>
      {error ? (
        <ErrorView error={error} retry={revalidate} />
      ) : (
        !isLoading && <List.EmptyView title="Vorlage nicht gefunden" description="Die App hat keine Geschwindigkeitsmessung." />
      )}
    </List>
  )
}
