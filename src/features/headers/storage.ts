import * as Schema from "effect/Schema"
import { stored } from "@/lib/storage"
import { DEFAULT_DESIGN, type HeaderDesign } from "./render"

export const HEADER_KEY = "headers:design"
export const HEADER_SCALE_KEY = "headers:scale"
export const DEFAULT_SCALE = 1

/** Only what a header needs; anything else in an import is ignored. Fields missing keep their default. */
const StoredDesign = Schema.Struct({
  title: Schema.optionalKey(Schema.String),
  subtitle: Schema.optionalKey(Schema.String),
  note: Schema.optionalKey(Schema.String),
  logo: Schema.optionalKey(Schema.Literals(["vpd", "fast", "custom"])),
  customLogo: Schema.optionalKey(Schema.String),
  band: Schema.optionalKey(Schema.String),
  accent: Schema.optionalKey(Schema.String),
  watermark: Schema.optionalKey(Schema.Boolean),
})

export const headerDesignAtom = stored(HEADER_KEY, StoredDesign, DEFAULT_DESIGN as Partial<HeaderDesign>)
export const headerScaleAtom = stored(HEADER_SCALE_KEY, Schema.Number, DEFAULT_SCALE)
