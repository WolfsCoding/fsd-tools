export const HEADER_KEY = "headers:design"
export const HEADER_SCALE_KEY = "headers:scale"

/** Only what a header needs; anything else in an import is ignored. */
export function isValidHeaderData(data: Record<string, unknown>) {
  const design = data[HEADER_KEY]
  return design === undefined || (typeof design === "object" && design !== null && !Array.isArray(design))
}
