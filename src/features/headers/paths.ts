/** Route prefix of the header images; must match its `path` in the registry. */
export const HEADERS_BASE = "/header"
/** The hosted header API (vp-header), drawing the same header from URL options. */
export const HEADER_API = "https://hs-headers.poyixq.app/"

/** A VPD header from the hosted header API. */
export function headerImage(title: string) {
  const params = new URLSearchParams({ title, subtitle: "Vinewood Police Department", logo: "vpd", scale: "2" })
  return `${HEADER_API}?${params.toString().replaceAll("+", "%20")}`
}
