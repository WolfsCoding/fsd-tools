import { MergeIcon } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogPanel,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { IdTag } from "@/features/case-files/with-ids"
import type { DnaEntry } from "./types"
import { entryName } from "./use-dna-entries"

/** Two entries that may be one person: they have the same name, or a trace of a case file has the IDs of both. */
export interface MergePair {
  a: DnaEntry
  b: DnaEntry
  reason: "name" | "trace"
}

/** Asks whether the `pair` is one person; open while set. Closing it keeps both entries. */
export function MergeDialog({ pair, onMerge, onKeepApart }: { pair?: MergePair; onMerge: () => void; onKeepApart: () => void }) {
  return (
    <AlertDialog open={!!pair} onOpenChange={(open) => !open && onKeepApart()}>
      <AlertDialogContent>
        {pair && (
          <>
            <AlertDialogPanel>
              <AlertDialogHeader>
                <AlertDialogMedia>
                  <MergeIcon />
                </AlertDialogMedia>
                <AlertDialogTitle>Einträge zusammenführen?</AlertDialogTitle>
                <AlertDialogDescription>
                  {pair.reason === "name"
                    ? `Zwei Einträge heißen „${pair.a.name.trim()}“.`
                    : "Eine Akte führt die DNA-ID des einen und die Fingerabdruck-ID des anderen als dieselbe Spur."}{" "}
                  Zusammengeführt bleibt ein Eintrag mit den Daten beider.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <ul className="grid gap-2 text-sm">
                {[pair.a, pair.b].map((e) => (
                  <li key={e.id} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                    <span className="min-w-0 flex-1 truncate font-medium">{entryName(e)}</span>
                    {e.dnaId && <IdTag id={e.dnaId} />}
                    {e.fingerprintId && <IdTag id={e.fingerprintId} />}
                  </li>
                ))}
              </ul>
            </AlertDialogPanel>
            <AlertDialogFooter>
              <AlertDialogCancel>Getrennt lassen</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  // Merged, the pair is gone and the dialog closes by itself; closing it here would keep them apart.
                  e.preventDefault()
                  onMerge()
                }}
              >
                Zusammenführen
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}
