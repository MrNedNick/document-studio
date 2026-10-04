export type VersionsReason = "unknown-revision" | "revision-damaged" | "name-too-long";

export interface VersionsError {
  kind: "versions";
  reason: VersionsReason;
  id?: string;
}

export function versionsError(reason: VersionsReason, id?: string): VersionsError {
  return { kind: "versions", reason, ...(id !== undefined ? { id } : {}) };
}
