import type { Block } from "../01-blocks";
import { err, ok, type Result } from "../result";
import { tablesError, type TablesError } from "./errors";
import { MAX_COLUMNS, MAX_ROWS, type ChecklistProgress, type Matrix } from "./types";

/**
 * Reads tab-separated text — what Excel, Numbers and Google Sheets copy as plain text. Cells holding a
 * tab, a line break or a quote come quoted, with quotes doubled. Returns null when the text isn't a
 * table: fewer than two columns, or rows of different widths (then it is ordinary text with tabs).
 */
export function parseDelimited(text: string): Matrix | null {
  if (!text.includes("\t")) return null;
  const rows: Matrix = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/\r\n?/g, "\n").replace(/\n+$/, "");
  for (let i = 0; i < source.length; i++) {
    const char = source[i]!;
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell === "") quoted = true;
    else if (char === "\t") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  row.push(cell);
  rows.push(row);
  const width = rows[0]!.length;
  if (width < 2 || rows.some((r) => r.length !== width)) return null;
  return rows;
}

const cell = (type: "tableHeader" | "tableCell", text: string): Block => {
  const content: Block[] = text.split("\n").flatMap((line, index) => [...(index > 0 ? [{ type: "hardBreak" }] : []), ...(line ? [{ type: "text", text: line }] : [])]);
  return { type, content: [{ type: "paragraph", ...(content.length ? { content } : {}) }] };
};

/** A table block from cells; the first row becomes the header row when asked. */
export function matrixToTable(matrix: Matrix, options: { header: boolean } = { header: true }): Result<Block, TablesError> {
  const rows = matrix.length;
  const columns = Math.max(0, ...matrix.map((row) => row.length));
  if (!rows || !columns) return err(tablesError("table-empty"));
  if (rows > MAX_ROWS || columns > MAX_COLUMNS) return err(tablesError("table-too-large", { rows, columns }));
  if (matrix.some((row) => row.length !== columns)) return err(tablesError("table-ragged", { rows, columns }));
  return ok({
    type: "table",
    content: matrix.map((row, index) => ({
      type: "tableRow",
      content: row.map((text) => cell(options.header && index === 0 ? "tableHeader" : "tableCell", text)),
    })),
  });
}

/** An empty table of a given size, header row on top — what "Insert table" makes. */
export function emptyTable(rows: number, columns: number): Result<Block, TablesError> {
  return matrixToTable(Array.from({ length: rows }, () => Array.from({ length: columns }, () => "")));
}

/**
 * Whether every row of a table spans the same number of columns, counting merged cells. A table that
 * isn't is reported with its size — the editor would otherwise pad it silently.
 */
export function checkTable(table: Block): Result<{ rows: number; columns: number }, TablesError> {
  const rows = table.content ?? [];
  if (!rows.length) return err(tablesError("table-empty"));
  // Columns occupied in each row, including those taken by row spans from above.
  const occupied: number[] = rows.map(() => 0);
  rows.forEach((row, r) => {
    for (const cellBlock of row.content ?? []) {
      const colspan = Number(cellBlock.attrs?.colspan ?? 1) || 1;
      const rowspan = Number(cellBlock.attrs?.rowspan ?? 1) || 1;
      for (let k = 0; k < rowspan && r + k < rows.length; k++) occupied[r + k]! += colspan;
    }
  });
  const columns = occupied[0]!;
  if (!columns) return err(tablesError("table-empty"));
  if (rows.length > MAX_ROWS || columns > MAX_COLUMNS) return err(tablesError("table-too-large", { rows: rows.length, columns }));
  if (occupied.some((width) => width !== columns)) return err(tablesError("table-ragged", { rows: rows.length, columns }));
  return ok({ rows: rows.length, columns });
}

/** How many checklist items are ticked, across the whole document, for the status line. */
export function checklistProgress(block: Block): ChecklistProgress {
  if (block.type === "taskItem") {
    const inner = (block.content ?? []).map(checklistProgress).reduce((a, b) => ({ done: a.done + b.done, total: a.total + b.total }), { done: 0, total: 0 });
    return { done: inner.done + (block.attrs?.checked ? 1 : 0), total: inner.total + 1 };
  }
  return (block.content ?? []).map(checklistProgress).reduce((a, b) => ({ done: a.done + b.done, total: a.total + b.total }), { done: 0, total: 0 });
}
