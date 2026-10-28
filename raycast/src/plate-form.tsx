import { Action, ActionPanel, Form, Icon, showHUD, useNavigation } from "@raycast/api"
import { showFailureToast } from "@raycast/utils"
import { call, PLATE_STATUS, type PlateCheck, type PlateStatus } from "./api"

/** Records a plate seen at a scene in the app's Kennzeichen table. */
export function PlateForm({ onCreated }: { onCreated?: (check: PlateCheck) => void }) {
  const { pop } = useNavigation()

  async function submit(form: Form.Values, open: boolean) {
    try {
      const check = await call<PlateCheck>("/plates/create", {
        driver: form.driver,
        holder: form.holder,
        plate: form.plate,
        model: form.model,
        scene: form.scene,
        date: form.date instanceof Date ? localDateTime(form.date) : undefined,
        status: form.status,
        open,
      })
      onCreated?.(check)
      if (open) await showHUD("In FSD Tools geöffnet")
      pop()
    } catch (error) {
      await showFailureToast(error, { title: "Abfrage konnte nicht angelegt werden" })
    }
  }

  return (
    <Form
      navigationTitle="Kennzeichen abfragen"
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Anlegen" icon={Icon.Plus} onSubmit={(v: Form.Values) => submit(v, false)} />
          <Action.SubmitForm
            title="Anlegen und in App öffnen"
            icon={Icon.AppWindow}
            shortcut={{ modifiers: ["ctrl"], key: "o" }}
            onSubmit={(v: Form.Values) => submit(v, true)}
          />
        </ActionPanel>
      }
    >
      <Form.TextField id="driver" title="Fahrzeugführer" placeholder="Name" />
      <Form.TextField id="holder" title="Fahrzeughalter" placeholder="Name" />
      <Form.TextField id="plate" title="Kennzeichen" placeholder="ZZ 0000" />
      <Form.TextField id="model" title="Fahrzeugmodell" placeholder="Modell" />
      <Form.DatePicker id="date" title="Datum" type={Form.DatePicker.Type.DateTime} info="Leer: jetzt." />
      <Form.TextField id="scene" title="Tatort" placeholder="Ort" />
      <Form.Dropdown id="status" title="Status" defaultValue="offen">
        {(Object.keys(PLATE_STATUS) as PlateStatus[]).map((s) => (
          <Form.Dropdown.Item key={s} value={s} title={PLATE_STATUS[s]} />
        ))}
      </Form.Dropdown>
    </Form>
  )
}

/** As a datetime-local input writes it, e.g. "2026-10-27T19:30". */
function localDateTime(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
