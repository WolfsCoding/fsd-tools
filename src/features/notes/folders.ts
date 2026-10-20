import { useLocalStorage } from "@/lib/local-storage"
import type { NoteFolder } from "./types"

export const FOLDERS_KEY = "notes:folders"
const NO_FOLDERS: NoteFolder[] = []

export function isValidFoldersData(folders: unknown) {
  return folders === undefined || (Array.isArray(folders) && folders.every(isFolder))
}

function isFolder(value: unknown): value is NoteFolder {
  if (typeof value !== "object" || value === null) return false
  const v = value as Record<string, unknown>
  return (
    ["id", "name", "createdAt", "updatedAt"].every((k) => typeof v[k] === "string") &&
    (v.parentId === undefined || typeof v.parentId === "string") &&
    (v.order === undefined || typeof v.order === "number")
  )
}

export function useNoteFolders() {
  return useLocalStorage<NoteFolder[]>(FOLDERS_KEY, NO_FOLDERS)
}

export function folderName(folder: NoteFolder | undefined) {
  return folder?.name.trim() || "Ohne Namen"
}

/** Ids of `id` and every folder inside it, however deep. */
export function folderSubtree(folders: NoteFolder[], id: string) {
  const ids = new Set([id])
  // Parents may come after their children in the list, so repeat until nothing is added.
  for (let added = true; added; ) {
    added = false
    for (const f of folders) {
      if (f.parentId && ids.has(f.parentId) && !ids.has(f.id)) {
        ids.add(f.id)
        added = true
      }
    }
  }
  return ids
}

/** The folders from the top level down to `id`, ending with it; empty for the top level. */
export function folderTrail(folders: NoteFolder[], id: string | undefined) {
  const byId = new Map(folders.map((f) => [f.id, f]))
  const trail: NoteFolder[] = []
  for (let f = id ? byId.get(id) : undefined; f && !trail.includes(f); f = f.parentId ? byId.get(f.parentId) : undefined) {
    trail.unshift(f)
  }
  return trail
}
