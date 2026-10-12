export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) {
    return `${kb.toLocaleString("de-DE", { maximumFractionDigits: 1 })} KB`
  }
  return `${(kb / 1024).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB`
}
