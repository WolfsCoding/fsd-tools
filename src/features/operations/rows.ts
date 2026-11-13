/** `rows` with row `i` changed by `fn`. */
export const updateAt = <R>(rows: R[], i: number, fn: (row: R) => R) => rows.map((r, j) => (j === i ? fn(r) : r))

/** `rows` with `row` put back at `i`, unless it is there already. */
export const insertAt = <R extends { id: string }>(rows: R[], i: number, row: R) =>
  rows.some((r) => r.id === row.id) ? rows : [...rows.slice(0, i), row, ...rows.slice(i)]
