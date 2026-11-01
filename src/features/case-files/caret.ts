/** Where the cursor is in `el`, an input or a rich text, counted in characters of its text. */
export function caretOf(el: HTMLElement) {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return { start: el.selectionStart ?? 0, end: el.selectionEnd ?? 0 }
  const sel = getSelection()
  if (!sel?.rangeCount || !el.contains(sel.anchorNode)) return { start: 0, end: 0 }
  const r = sel.getRangeAt(0)
  return { start: offsetIn(el, r.startContainer, r.startOffset), end: offsetIn(el, r.endContainer, r.endOffset) }
}

export const textLength = (el: HTMLElement) =>
  el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.value.length : (el.textContent ?? "").length

export function setCaret(el: HTMLElement, start: number, end = start) {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el.setSelectionRange(start, end)
  const sel = getSelection()
  if (!sel) return
  const a = pointAt(el, start)
  const b = pointAt(el, end)
  const range = document.createRange()
  range.setStart(a.node, a.offset)
  range.setEnd(b.node, b.offset)
  sel.removeAllRanges()
  sel.addRange(range)
}

function offsetIn(el: HTMLElement, node: Node, offset: number) {
  const r = document.createRange()
  r.selectNodeContents(el)
  r.setEnd(node, offset)
  return r.toString().length
}

function pointAt(el: HTMLElement, pos: number) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  let left = pos
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const length = n.textContent?.length ?? 0
    if (left <= length) return { node: n, offset: left }
    left -= length
  }
  return { node: el as Node, offset: el.childNodes.length }
}

