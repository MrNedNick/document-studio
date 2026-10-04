import type { Revision, VersionsError } from "../../domain/04-versions";

export function describeVersionsError(error: VersionsError): string {
  switch (error.reason) {
    case "unknown-revision":
      return "That version is no longer in the history.";
    case "revision-damaged":
      return "That version can't be read any more, so it can't be restored. The current text is unchanged.";
    case "name-too-long":
      return "A version name can be up to 80 characters.";
  }
}

export function reasonLabel(revision: Revision): string {
  if (revision.reason === "manual") return revision.name ? `Saved: ${revision.name}` : "Saved by you";
  if (revision.reason === "before-restore") return "Before a restore";
  return "Automatic";
}
