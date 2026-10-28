import * as Schema from "effect/Schema"
import { Row } from "@/features/case-files/types"
import { stored } from "@/lib/storage"

/** The calculator's charges, as rows like the ones of a case file. */
export const CALCULATOR_KEY = "gesetzbuch:rechner"

const NO_ROWS: Row[] = []

export const calculatorAtom = stored(CALCULATOR_KEY, Schema.Array(Row), NO_ROWS)
