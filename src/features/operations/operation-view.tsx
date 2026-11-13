import { useMemo, useState, type ReactNode } from "react"
import { useNavigate, useSearchParams } from "react-router"
import { EllipsisIcon, FolderOpenIcon, FolderPlusIcon, PencilIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"
import { BackButton } from "@/components/explorer"
import { Hint } from "@/components/hint"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { caseFilePath } from "@/features/case-files/paths"
import { usePoliceFiles } from "@/features/case-files/police-files"
import { PERSON } from "@/features/case-files/templates"
import { lookupPerson } from "@/features/case-files/traces"
import { useOwnName } from "@/features/case-files/use-case-files"
import { useDnaEntries } from "@/features/dna-db/use-dna-entries"
import { useTabTitle } from "@/hooks/use-tabs"
import { accused, collectiveValues, reportValues } from "./collective-file"
import { EditOperationDialog } from "./edit-operation-dialog"
import { InfoPanel } from "./info-panel"
import { OPERATIONS_BASE } from "./paths"
import { LeadsTab } from "./leads-tab"
import { PatrolsTab } from "./patrols-tab"
import { PeopleTab } from "./people-tab"
import type { Operation } from "./types"
import type { OperationsApi } from "./use-operations"
import { VehiclesTab } from "./vehicles-tab"

const TABS = [
  { id: "streifen", label: "Streifen" },
  { id: "bereichsleitung", label: "Bereichsleitung" },
  { id: "personen", label: "Personen" },
  { id: "fahrzeuge", label: "Fahrzeuge" },
] as const
type TabId = (typeof TABS)[number]["id"]

const unique = (values: string[]) => [...new Set(values.map((v) => v.trim()).filter(Boolean))]

/** One operation: the Streifenblatt and the other sheets in tabs, with the infos beside them. */
export function OperationView({
  operation,
  api,
  onDelete,
}: {
  operation: Operation
  api: OperationsApi
  onDelete: (operation: Operation) => void
}) {
  const navigate = useNavigate()
  const me = useOwnName()
  const police = usePoliceFiles()
  const { entries } = useDnaEntries()
  const [editing, setEditing] = useState(false)
  useTabTitle(operation.title)

  // The open tab is part of the URL, so reloading and going back keep it.
  const [params, setParams] = useSearchParams()
  const tab: TabId = TABS.find((t) => t.id === params.get("tab"))?.id ?? "streifen"
  const setTab = (next: TabId) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        if (next === "streifen") p.delete("tab")
        else p.set("tab", next)
        return p
      },
      { replace: true },
    )

  const onChange = (fn: (o: Operation) => Operation) => api.change(operation.id, fn)
  const nameOf = (value: string) => lookupPerson(entries, PERSON.or ?? [], value).name || value

  const officers = useMemo(
    () =>
      unique([
        me,
        operation.leitung,
        ...operation.patrols.flatMap((p) => p.beamte),
        ...operation.people.flatMap((p) => [p.beamter, p.belehrung.belehrtVon, p.belehrung.zeuge]),
      ]),
    [me, operation.leitung, operation.patrols, operation.people],
  )
  const peopleNames = unique(operation.people.map((p) => nameOf(p.name)))

  const linked = police.caseFiles.find((c) => c.id === operation.caseFileId)

  function createCollectiveFile() {
    const id = police.createCaseFile("sammelakte", collectiveValues(operation), {
      type: "sa",
      title: operation.title,
      ...(operation.fallakte && { caseNumber: operation.fallakte }),
    })
    const suspects = accused(operation)
    for (const person of suspects) police.setValues(id, police.addDoc(id, "bericht"), reportValues(person))
    onChange((o) => ({ ...o, caseFileId: id }))
    toast.success("Sammelakte erstellt", {
      description: suspects.length === 1 ? "Mit 1 Beschuldigten-Bericht" : `Mit ${suspects.length} Beschuldigten-Berichten`,
    })
    navigate(caseFilePath(id))
  }

  const tabPanel: Record<TabId, ReactNode> = {
    streifen: <PatrolsTab operation={operation} onChange={onChange} officers={officers} />,
    bereichsleitung: <LeadsTab operation={operation} onChange={onChange} />,
    personen: <PeopleTab operation={operation} onChange={onChange} officers={officers} me={me} nameOf={nameOf} />,
    fahrzeuge: <VehiclesTab operation={operation} onChange={onChange} people={peopleNames} />,
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b px-6 pt-5">
        <div className="flex flex-wrap items-center gap-3">
          <BackButton to={OPERATIONS_BASE} label="Alle Einsätze" />
          <div className="flex min-w-32 flex-1 items-center gap-2.5">
            <h1 className="min-w-0 truncate text-xl font-semibold">{operation.title}</h1>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {linked ? (
              <Button size="sm" variant="outline" onClick={() => navigate(caseFilePath(linked.id))}>
                <FolderOpenIcon /> Sammelakte öffnen
              </Button>
            ) : (
              <Hint label="Mit Fahrzeugen, Beteiligten und einem Bericht je Beschuldigtem">
                <Button size="sm" onClick={createCollectiveFile}>
                  <FolderPlusIcon /> Sammelakte erstellen
                </Button>
              </Hint>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Weitere Aktionen">
                  <EllipsisIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60" onCloseAutoFocus={(e) => e.preventDefault()}>
                <DropdownMenuItem onSelect={() => setEditing(true)}>
                  <PencilIcon /> Einsatz bearbeiten
                </DropdownMenuItem>
                {linked && (
                  <DropdownMenuItem onSelect={createCollectiveFile}>
                    <FolderPlusIcon /> Neue Sammelakte erstellen
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => onDelete(operation)}>
                  <Trash2Icon /> Einsatz löschen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-3 text-xs sm:grid-cols-4">
          <Meta label="Fallakte">{operation.fallakte || "—"}</Meta>
          <Meta label="Funk">{operation.funk || "—"}</Meta>
          <Meta label="Ort">{operation.ort || "—"}</Meta>
          <Meta label="Einsatzleitung">{operation.leitung || me || "—"}</Meta>
        </dl>

        <div role="tablist" aria-label="Teile des Einsatzes" className="-mx-3 mt-3 flex items-center gap-0.5 no-scrollbar overflow-x-auto">
          {TABS.map((t, index) => {
            const selected = t.id === tab
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                data-tab={index}
                onClick={() => setTab(t.id)}
                onKeyDown={(e) => {
                  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
                  const targets: Partial<Record<string, number>> = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: TABS.length - 1 }
                  const target = targets[e.key]
                  if (target === undefined) return
                  e.preventDefault()
                  const next = (target + TABS.length) % TABS.length
                  setTab(TABS[next].id)
                  e.currentTarget.parentElement?.querySelector<HTMLElement>(`[data-tab="${next}"]`)?.focus()
                }}
                className={cn(
                  "relative shrink-0 px-3 pt-1.5 pb-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
                  selected && "text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-foreground",
                )}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Keyed by tab, so switching tabs fades the new one in. */}
        <div key={tab} role="tabpanel" className="min-h-0 min-w-0 flex-1 overflow-y-auto px-6 py-6">
          {tabPanel[tab]}
        </div>
        <InfoPanel operation={operation} onChange={onChange} />
      </div>

      <EditOperationDialog
        operation={editing ? operation : undefined}
        officers={officers}
        me={me}
        onSave={(details) => {
          onChange((o) => ({ ...o, ...details }))
          setEditing(false)
        }}
        onClose={() => setEditing(false)}
      />
    </div>
  )
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5">
      <dt className="shrink-0 text-muted-foreground">{label}:</dt>
      <dd className="min-w-0 font-medium break-words">{children}</dd>
    </div>
  )
}
