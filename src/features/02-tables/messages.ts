import { MAX_COLUMNS, MAX_ROWS, type TablesError } from "../../domain/02-tables";

export function describeTablesError(error: TablesError): string {
  switch (error.reason) {
    case "table-empty":
      return "That table has no cells.";
    case "table-too-large":
      return `That table is ${error.rows} × ${error.columns} — larger than a document table can be (${MAX_ROWS} rows, ${MAX_COLUMNS} columns). Paste a smaller range.`;
    case "table-ragged":
      return "Those cells don't line up into a table.";
  }
}
