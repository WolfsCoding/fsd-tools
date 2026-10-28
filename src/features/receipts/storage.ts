import * as Schema from "effect/Schema"
import { stored } from "@/lib/storage"
import { DEFAULT_RECEIPT, type Receipt } from "./render"

export const RECEIPT_KEY = "receipts:receipt"
export const RECEIPT_SCALE_KEY = "receipts:scale"
export const DEFAULT_SCALE = 2

const ReceiptItem = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  qty: Schema.Number,
  price: Schema.Number,
})

/** Only what a receipt needs; anything else in an import is ignored. Fields missing keep their default. */
const StoredReceipt = Schema.Struct({
  shop: Schema.optionalKey(Schema.String),
  address: Schema.optionalKey(Schema.String),
  items: Schema.optionalKey(Schema.Array(ReceiptItem)),
  currency: Schema.optionalKey(Schema.String),
  taxRate: Schema.optionalKey(Schema.Number),
  payment: Schema.optionalKey(Schema.Literals(["cash", "card"])),
  given: Schema.optionalKey(Schema.Number),
  cashier: Schema.optionalKey(Schema.String),
  number: Schema.optionalKey(Schema.String),
  date: Schema.optionalKey(Schema.String),
  footer: Schema.optionalKey(Schema.String),
})

export const receiptAtom = stored(RECEIPT_KEY, StoredReceipt, DEFAULT_RECEIPT as Partial<Receipt>)
export const receiptScaleAtom = stored(RECEIPT_SCALE_KEY, Schema.Number, DEFAULT_SCALE)
