// The IPC channels between the desktop shell (electron/) and the page. Kept free of imports:
// the preload bundles this file alone.

export const IpcChannels = {
  /** invoke → the app version. */
  appVersion: "app:version",
  /** invoke → the current `UpdateState`. */
  updatesGet: "updates:get",
  updatesCheck: "updates:check",
  updatesDownload: "updates:download",
  updatesInstall: "updates:install",
  /** main → page: every change of the `UpdateState`. */
  updatesState: "updates:state",
  /** page → main: the `TitleBarColors` of the Windows buttons. */
  titleBar: "window:title-bar",
  /** main → page: an `ApiRequest` of the local API, answered on `apiResponse`. */
  apiRequest: "api:request",
  apiResponse: "api:response",
} as const
