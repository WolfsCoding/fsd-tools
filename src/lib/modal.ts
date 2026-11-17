/**
 * Whether a dialog or sheet covers the page. App-wide shortcuts (back, forward, switching
 * and closing tabs) leave the page behind it alone, so they can't drop what is being
 * entered in it.
 */
/** For a dialog's `onInteractOutside`: a press on a toast (its "Rückgängig") isn't a press next to the dialog. */
export function isOnToast(target: EventTarget | null) {
  return target instanceof Element && target.closest("[data-sonner-toaster]") !== null
}

export function modalOpen() {
  return document.querySelector("[data-slot=dialog-content], [data-slot=alert-dialog-content], [data-slot=sheet-content]") !== null
}
