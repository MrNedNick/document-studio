import type { BlocksError } from "../../domain/01-blocks";

export function describePasteError(error: BlocksError): string {
  switch (error.reason) {
    case "paste-empty":
      return "Nothing readable in what was pasted — it was all formatting or code.";
    case "paste-too-large":
      return "That paste is too large (over 2 MB of HTML). Paste a smaller part, or paste it as plain text.";
    default:
      return "That couldn't be pasted.";
  }
}

/** "Removed scripts and styles from the paste." */
export function describeRemoved(removed: string[]): string {
  if (!removed.length) return "";
  const list = removed.length === 1 ? removed[0] : `${removed.slice(0, -1).join(", ")} and ${removed.at(-1)}`;
  return `Pasted the text — removed ${list}.`;
}
