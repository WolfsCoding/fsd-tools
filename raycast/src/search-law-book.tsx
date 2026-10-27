import { Action, ActionPanel, Icon, List } from "@raycast/api"
import { showFailureToast, usePromise } from "@raycast/utils"
import { useState } from "react"
import { call, openInApp, type Paragraph } from "./api"
import { ErrorView } from "./not-running"

export default function SearchLawBook() {
  const [query, setQuery] = useState("")
  // The app searches like its own Gesetzbuch: "§ 5", "to", whole words for short terms.
  const { data, isLoading, error, revalidate } = usePromise(
    (q: string) => call<Paragraph[]>("/law-book/search", { q }),
    [query],
  )
  const books = [...new Map((data ?? []).map((p) => [p.book.id, p.book])).values()]

  return (
    <List
      isLoading={isLoading}
      isShowingDetail={!!data?.length}
      filtering={false}
      throttle
      onSearchTextChange={setQuery}
      searchBarPlaceholder="Paragraph, Begriff oder § 17 TO"
    >
      {error && <ErrorView error={error} retry={revalidate} />}
      {!error && !isLoading && !data?.length && <List.EmptyView title="Nichts gefunden" />}
      {books.map((book) => (
        <List.Section key={book.id} title={book.title}>
          {data
            ?.filter((p) => p.book.id === book.id)
            .map((p) => (
              <List.Item
                key={`${book.id}-${p.number}`}
                title={p.citation}
                subtitle={p.title}
                detail={<List.Item.Detail markdown={markdown(p)} />}
                actions={<ParagraphActions paragraph={p} />}
              />
            ))}
        </List.Section>
      ))}
    </List>
  )
}

function ParagraphActions({ paragraph: p }: { paragraph: Paragraph }) {
  const text = [`${p.citation} – ${p.title}`, ...p.sections.map((s, i) => `(${i + 1}) ${s.text}`)].join("\n")
  return (
    <ActionPanel>
      <Action.CopyToClipboard title="Paragraph kopieren" content={p.citation} />
      <Action.Paste title="Paragraph einfügen" content={p.citation} />
      <Action.CopyToClipboard title="Wortlaut kopieren" content={text} shortcut={{ modifiers: ["ctrl", "shift"], key: "c" }} />
      {p.sections.length > 1 && (
        <ActionPanel.Submenu title="Absatz kopieren" icon={Icon.Paragraph} shortcut={{ modifiers: ["ctrl"], key: "a" }}>
          {p.sections.map((s) => (
            <Action.CopyToClipboard key={s.citation} title={s.citation} content={s.citation} />
          ))}
        </ActionPanel.Submenu>
      )}
      <Action
        title="In App öffnen"
        icon={Icon.AppWindow}
        shortcut={{ modifiers: ["ctrl"], key: "o" }}
        onAction={() => openInApp(p.path).catch((e) => showFailureToast(e, { title: "Konnte nicht öffnen" }))}
      />
    </ActionPanel>
  )
}

function markdown(p: Paragraph) {
  const sections = p.sections.map((s, i) => `**(${i + 1})** ${s.text.replace(/\n/g, "  \n")}`).join("\n\n")
  const offenses = p.offenses.length
    ? [
        "### Strafen",
        "| Paragraph | Tatbestand | Strafe |",
        "| --- | --- | --- |",
        ...p.offenses.map((o) => `| ${o.ref} | ${o.title} | ${[o.fine, ...o.notes].filter(Boolean).join(", ") || "–"} |`),
      ].join("\n")
    : ""
  return [`## ${p.citation}: ${p.title}`, `*${p.chapter}*`, sections, offenses].filter(Boolean).join("\n\n")
}
