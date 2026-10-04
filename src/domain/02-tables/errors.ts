export type TablesReason = "table-empty" | "table-too-large" | "table-ragged";

export interface TablesError {
  kind: "tables";
  reason: TablesReason;
  /** For a table that is too large or ragged: its size, so the message can say it. */
  rows?: number;
  columns?: number;
}

export function tablesError(reason: TablesReason, size: { rows?: number; columns?: number } = {}): TablesError {
  return { kind: "tables", reason, ...size };
}
