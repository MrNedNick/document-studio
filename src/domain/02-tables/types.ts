/** Cells as text, row by row — what a spreadsheet puts on the clipboard. */
export type Matrix = string[][];

/** A table bigger than this is a spreadsheet, not part of a document; it is refused with a reason. */
export const MAX_COLUMNS = 30;
export const MAX_ROWS = 500;

export interface ChecklistProgress {
  done: number;
  total: number;
}
