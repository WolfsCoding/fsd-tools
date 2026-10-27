import { Action, ActionPanel, Icon, List } from "@raycast/api"
import { usePromise } from "@raycast/utils"
import { call, type Template } from "./api"
import { DocumentForm } from "./document-form"
import { ErrorView } from "./not-running"

export default function CreateDocument() {
  const { data, isLoading, error, revalidate } = usePromise(() => call<Template[]>("/templates"))
  const groups = [...new Set((data ?? []).map((t) => t.group))]

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Vorlage suchen">
      {error && <ErrorView error={error} retry={revalidate} />}
      {groups.map((group) => (
        <List.Section key={group} title={group}>
          {data
            ?.filter((t) => t.group === group)
            .map((t) => (
              <List.Item
                key={t.id}
                icon={t.emoji}
                title={t.label}
                subtitle={t.description}
                keywords={[t.id]}
                actions={
                  <ActionPanel>
                    <Action.Push title="Ausfüllen" icon={Icon.Pencil} target={<DocumentForm template={t} />} />
                  </ActionPanel>
                }
              />
            ))}
        </List.Section>
      ))}
    </List>
  )
}
