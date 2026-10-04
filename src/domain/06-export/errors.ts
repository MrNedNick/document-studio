export type ExportReason = "not-json" | "not-a-bundle" | "newer-format" | "document-damaged" | "asset-damaged";

export interface ExportError {
  kind: "export";
  reason: ExportReason;
  /** For a damaged document: the block or mark that isn't known; for a damaged asset: its id. */
  detail?: string;
}

export function exportError(reason: ExportReason, detail?: string): ExportError {
  return { kind: "export", reason, ...(detail !== undefined ? { detail } : {}) };
}
