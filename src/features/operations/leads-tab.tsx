import { Fragment, type ReactNode } from "react"
import { ChevronsUpDownIcon, UserRoundIcon, UserRoundXIcon } from "lucide-react"
import { cn } from "cn"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Identity } from "@/features/case-files/use-case-files"
import { LEAD_LABEL, LEAD_SHORT } from "./guide"
import { Section } from "./panel"
import { StatusSquare } from "./status-badge"
import { LEAD_ROLES, type LeadRole, type Member, type Operation } from "./types"
import { useLocked } from "./edit-state"
import { isLeader, isOwnName, leadMember, ownUnit, unitName, type useOperations } from "./use-operations"

type Api = ReturnType<typeof useOperations>

const AREAS = LEAD_ROLES.filter((r) => r !== "el" && r !== "coel")

/** Who leads the operation and its areas, picked from the units. The EL is the user unless someone else is picked. */
export function LeadsTab({ operation, api, me }: { operation: Operation; api: Api; me: Identity }) {
  const assigned = AREAS.filter((r) => leadMember(operation, r)).length
  const setLead = (role: LeadRole) => (memberId: string | undefined) => api.setLead(operation.id, role, memberId)

  return (
    <div className="grid gap-6">
      <Section title="Führung">
        <Row label={LEAD_LABEL.el}>
          <PersonPicker operation={operation} me={me} role="el" onChange={setLead("el")} />
        </Row>
        <Row label={LEAD_LABEL.coel}>
          <PersonPicker operation={operation} me={me} role="coel" onChange={setLead("coel")} />
        </Row>
        {!me.full && !leadMember(operation, "el") && (
          <p className="px-4 py-2.5 text-xs text-muted-foreground">
            Standardmäßig bist du die Einsatzleitung. Trag dazu deinen Namen in den Einstellungen unter „Eigene Person“
            ein.
          </p>
        )}
      </Section>

      <Section title="Bereichsleitungen" aside={`${assigned}/${AREAS.length} besetzt`}>
        {AREAS.map((r) => (
          <Row key={r} label={LEAD_LABEL[r]}>
            <PersonPicker operation={operation} me={me} role={r} onChange={setLead(r)} />
          </Row>
        ))}
      </Section>
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
      {children}
    </div>
  )
}

/**
 * Picks an officer from the units, grouped by unit. Shows which roles each officer already holds.
 * The EL falls back to the user while nobody is picked.
 */
function PersonPicker({
  operation,
  me,
  role,
  onChange,
}: {
  operation: Operation
  me: Identity
  role: LeadRole
  onChange: (memberId: string | undefined) => void
}) {
  const locked = useLocked()
  const picked = leadMember(operation, role)
  const isEl = role === "el"
  // The EL without a pick is the user, shown with "(du)".
  const self = isEl && !picked
  const shown = picked?.member.name ?? (isEl ? me.full : "")
  const unit = self ? ownUnit(operation, me) : picked?.unit
  const ownMember = unit?.members.find((m) => isOwnName(m.name, me))
  const checked = picked?.member.id ?? (self ? (ownMember?.id ?? "") : "")
  const staffed = operation.units.filter((u) => u.members.length > 0)
  const rolesOf = (member: Member) => [
    ...(!isEl && isLeader(operation, member, me) ? ["EL"] : []),
    ...LEAD_ROLES.filter((r) => r !== role && r !== "el" && operation.leads[r] === member.id).map((r) => LEAD_SHORT[r]),
  ]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={locked}>
        <button
          type="button"
          aria-label={`${LEAD_LABEL[role]} auswählen`}
          className={cn(
            "flex h-8 w-56 shrink-0 items-center gap-2 rounded-md border border-input px-2.5 text-left text-sm outline-none hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=open]:bg-muted/40",
            !shown && "border-dashed text-muted-foreground",
          )}
        >
          {unit && <StatusSquare status={unit.status} className="size-4 text-[0.6rem]" />}
          <span className="min-w-0 flex-1 truncate">
            {shown || "Nicht besetzt"}
            {self && shown && <span className="text-muted-foreground"> (du)</span>}
          </span>
          <ChevronsUpDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 w-64">
        <DropdownMenuRadioGroup value={checked} onValueChange={onChange}>
          {staffed.map((u, i) => (
            <Fragment key={u.id}>
              {i > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
                <StatusSquare status={u.status} className="size-4 text-[0.6rem]" />
                {unitName(u)}
              </DropdownMenuLabel>
              {u.members.map((m) => {
                const roles = rolesOf(m)
                return (
                  <DropdownMenuRadioItem key={m.id} value={m.id}>
                    <span className="min-w-0 flex-1 truncate">{m.name}</span>
                    {roles.length > 0 && (
                      <span className="shrink-0 text-xs text-muted-foreground">{roles.join(", ")}</span>
                    )}
                  </DropdownMenuRadioItem>
                )
              })}
            </Fragment>
          ))}
        </DropdownMenuRadioGroup>
        {staffed.length === 0 && (
          <p className="px-2 py-3 text-center text-sm text-muted-foreground">
            Noch keine Streifen mit Personal. Füge zuerst Personen zu einer Streife hinzu.
          </p>
        )}
        {picked && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onChange(undefined)}>
              {isEl ? (
                <>
                  <UserRoundIcon className="text-muted-foreground" /> Ich selbst
                </>
              ) : (
                <>
                  <UserRoundXIcon className="text-muted-foreground" /> Nicht besetzt
                </>
              )}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
