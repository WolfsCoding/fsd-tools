import { Action, ActionPanel, Color, Icon, List } from "@raycast/api"
import { showFailureToast, usePromise } from "@raycast/utils"
import { useState } from "react"
import { call, openInApp, PLATE_STATUS, type PlateCheck, type PlateStatus } from "./api"
import { ErrorView } from "./not-running"
import { PlateForm } from "./plate-form"

/** The choices of the dropdown: a status or a date range, as the app's filter menu offers them. */
const FILTERS = [
  { value: "", title: "Alle Abfragen", section: "Status" },
  { value: "status:offen", title: "Offen", section: "Status" },
  { value: "status:gueltig", title: "Gültig", section: "Status" },
  { value: "status:ungueltig", title: "Ungültig", section: "Status" },
  { value: "date:heute", title: "Heute", section: "Datum" },
  { value: "date:woche", title: "Letzte 7 Tage", section: "Datum" },
  { value: "date:monat", title: "Letzte 30 Tage", section: "Datum" },
]
const SECTIONS = [...new Set(FILTERS.map((f) => f.section))]

const STATUS_COLOR: Record<PlateStatus, Color> = { offen: Color.SecondaryText, gueltig: Color.Green, ungueltig: Color.Red }

export default function CheckPlates() {
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState("")
  const { data, isLoading, error, revalidate } = usePromise(
    (q: string, f: string) => {
      const [key, value] = f.split(":")
      return call<PlateCheck[]>("/plates", { q, ...(key && value ? { [key]: value } : {}) })
    },
    [query, filter],
  )

  async function setStatus(check: PlateCheck, status: PlateStatus) {
    try {
      await call("/plates/status", { id: check.id, status })
      revalidate()
    } catch (e) {
      await showFailureToast(e, { title: "Status konnte nicht gesetzt werden" })
    }
  }

  const create = (
    <Action.Push
      title="Neue Abfrage"
      icon={Icon.Plus}
      shortcut={{ modifiers: ["ctrl"], key: "n" }}
      target={<PlateForm onCreated={revalidate} />}
    />
  )

  return (
    <List
      isLoading={isLoading}
      isShowingDetail={!!data?.length}
      filtering={false}
      throttle
      onSearchTextChange={setQuery}
      searchBarPlaceholder="Fahrer, Halter, Kennzeichen, Modell oder Tatort"
      searchBarAccessory={
        <List.Dropdown tooltip="Filter" value={filter} onChange={setFilter}>
          {SECTIONS.map((section) => (
            <List.Dropdown.Section key={section} title={section}>
              {FILTERS.filter((f) => f.section === section).map((f) => (
                <List.Dropdown.Item key={f.value} value={f.value} title={f.title} />
              ))}
            </List.Dropdown.Section>
          ))}
        </List.Dropdown>
      }
    >
      {error && <ErrorView error={error} retry={revalidate} />}
      {!error && !isLoading && !data?.length && <List.EmptyView title="Keine Abfragen" actions={<ActionPanel>{create}</ActionPanel>} />}
      {data?.map((c) => (
        <List.Item
          key={c.id}
          title={c.plate || "Ohne Kennzeichen"}
          subtitle={c.driver || undefined}
          accessories={[{ tag: { value: PLATE_STATUS[c.status], color: STATUS_COLOR[c.status] } }]}
          detail={<List.Item.Detail markdown={c.ticket} metadata={<Metadata check={c} />} />}
          actions={
            <ActionPanel>
              {c.ticket && <Action.CopyToClipboard title="Ticket kopieren" content={c.ticket} />}
              {c.ticket && <Action.Paste title="Ticket einfügen" content={c.ticket} />}
              <ActionPanel.Submenu title="Status setzen" icon={Icon.Tag} shortcut={{ modifiers: ["ctrl"], key: "s" }}>
                {(Object.keys(PLATE_STATUS) as PlateStatus[]).map((s) => (
                  <Action
                    key={s}
                    title={PLATE_STATUS[s]}
                    icon={{ source: Icon.Circle, tintColor: STATUS_COLOR[s] }}
                    onAction={() => setStatus(c, s)}
                  />
                ))}
              </ActionPanel.Submenu>
              {create}
              <Action
                title="In App öffnen"
                icon={Icon.AppWindow}
                shortcut={{ modifiers: ["ctrl"], key: "o" }}
                onAction={() => openInApp(c.path).catch((e) => showFailureToast(e, { title: "Konnte nicht öffnen" }))}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  )
}

function Metadata({ check: c }: { check: PlateCheck }) {
  const dash = (s: string) => s.trim() || "–"
  return (
    <List.Item.Detail.Metadata>
      <List.Item.Detail.Metadata.Label title="Fahrzeugführer" text={dash(c.driver)} />
      <List.Item.Detail.Metadata.Label title="Fahrzeughalter" text={dash(c.holder)} />
      <List.Item.Detail.Metadata.Label title="Kennzeichen" text={dash(c.plate)} />
      <List.Item.Detail.Metadata.Label title="Fahrzeugmodell" text={dash(c.model)} />
      <List.Item.Detail.Metadata.Label title="Datum" text={formatDate(c.date)} />
      <List.Item.Detail.Metadata.Label title="Tatort" text={dash(c.scene)} />
      <List.Item.Detail.Metadata.TagList title="Status">
        <List.Item.Detail.Metadata.TagList.Item text={PLATE_STATUS[c.status]} color={STATUS_COLOR[c.status]} />
      </List.Item.Detail.Metadata.TagList>
    </List.Item.Detail.Metadata>
  )
}

/** "2026-10-27T19:30" as "27.10.2026 19:30". */
function formatDate(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value)
  return m ? `${m[3]}.${m[2]}.${m[1]} ${m[4]}:${m[5]}` : value
}
