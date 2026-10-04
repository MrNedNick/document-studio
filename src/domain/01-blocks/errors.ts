export type BlocksReason = "not-a-document" | "newer-schema" | "unknown-block" | "unknown-mark" | "paste-empty" | "paste-too-large";

export interface BlocksError {
  kind: "blocks";
  reason: BlocksReason;
  /** The block or mark type that isn't known, when that is the problem. */
  type?: string;
}

export function blocksError(reason: BlocksReason, type?: string): BlocksError {
  return { kind: "blocks", reason, ...(type !== undefined ? { type } : {}) };
}
