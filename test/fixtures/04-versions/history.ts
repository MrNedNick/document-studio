import { newDocument, type Document } from "../../../src/domain/01-blocks";
import { DAY, HOUR, type Revision } from "../../../src/domain/04-versions";

export const NOW = Date.UTC(2026, 9, 4, 12, 0, 0);

export const doc = (text: string, title = "Plan"): Document => ({
  ...newDocument("doc", NOW, title),
  body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] },
});

let n = 0;
export const rev = (ageMs: number, reason: Revision["reason"] = "auto", text = `v${n}`): Revision => ({
  id: `r${n++}`,
  documentId: "doc",
  createdAt: NOW - ageMs,
  reason,
  title: "Plan",
  body: doc(text).body,
  words: text.split(" ").length,
});

/** A month of writing: an automatic version every 10 minutes for 40 days, and two saved by hand long ago. */
export function monthOfWriting(): Revision[] {
  const all: Revision[] = [];
  for (let age = 0; age < 40 * DAY; age += 10 * 60_000) all.push(rev(age));
  all.push(rev(35 * DAY, "manual"), rev(2 * HOUR, "before-restore"));
  return all;
}
