import { toast } from "sonner"

/** Not in TypeScript's DOM types yet; Chromium (and so the desktop shell) has it. */
type PickDirectory = (options: { id?: string; mode: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle>

export interface TextFile {
  name: string
  text: string
}

/** `name` without what Windows doesn't allow in a file or folder name. */
export function fileName(name: string) {
  const safe = name
    .replace(/[<>:"/\\|?*]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/, "")
    .trim()
  return safe || "Unbenannt"
}

/** A folder the user picks; undefined when they cancel. */
async function pickFolder(mode: "read" | "readwrite") {
  const pick = (window as Window & { showDirectoryPicker?: PickDirectory }).showDirectoryPicker
  if (!pick) {
    toast.error("Ordner auswählen geht hier nicht")
    return undefined
  }
  try {
    // One id for both ways, so the picker starts where the last export or import was.
    return await pick({ id: "case-files", mode })
  } catch {
    return undefined
  }
}

/**
 * Writes `files` into a folder `folder` inside one the user picks, replacing files of the same
 * name, and confirms with a toast. Does nothing when the picker is cancelled.
 */
export async function saveFolder(folder: string, files: TextFile[]) {
  const parent = await pickFolder("readwrite")
  if (!parent) return
  try {
    const dir = await parent.getDirectoryHandle(fileName(folder), { create: true })
    for (const file of files) {
      const writable = await (await dir.getFileHandle(fileName(file.name), { create: true })).createWritable()
      await writable.write(file.text)
      await writable.close()
    }
    toast.success(`${files.length === 1 ? "1 Datei" : `${files.length} Dateien`} in „${parent.name}/${dir.name}“ gespeichert`)
  } catch {
    toast.error("Speichern nicht möglich")
  }
}

/**
 * The Markdown files directly in a folder the user picks, sorted by name as Explorer does
 * ("2 …" before "10 …"); undefined when the picker is cancelled or the folder can't be read.
 */
export async function readFolder(): Promise<{ name: string; files: TextFile[] } | undefined> {
  const dir = await pickFolder("read")
  if (!dir) return undefined
  try {
    const files: TextFile[] = []
    for await (const entry of dir.values()) {
      if (entry.kind === "file" && /\.md$/i.test(entry.name))
        files.push({ name: entry.name, text: await (await (entry as FileSystemFileHandle).getFile()).text() })
    }
    files.sort((a, b) => a.name.localeCompare(b.name, "de", { numeric: true }))
    return { name: dir.name, files }
  } catch {
    toast.error("Ordner lesen nicht möglich")
    return undefined
  }
}
