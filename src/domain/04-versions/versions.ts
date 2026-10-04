import { readDocument, wordCount, type Document } from "../01-blocks";
import { err, ok, type Result } from "../result";
import { versionsError, type VersionsError } from "./errors";
import { AUTO_EVERY, DAY, HOUR, KEEP_AUTO_FOR, MAX_REVISIONS, type Revision, type RevisionReason } from "./types";

const sameContent = (a: Pick<Revision, "title" | "body">, b: Pick<Document, "title" | "body">) =>
  a.title === b.title && JSON.stringify(a.body) === JSON.stringify(b.body);

export function makeRevision(document: Document, reason: RevisionReason, id: string, now: number, name?: string): Result<Revision, VersionsError> {
  const trimmed = name?.trim();
  if (trimmed && trimmed.length > 80) return err(versionsError("name-too-long"));
  return ok({
    id,
    documentId: document.id,
    createdAt: now,
    reason,
    ...(trimmed ? { name: trimmed } : {}),
    title: document.title,
    body: structuredClone(document.body),
    words: wordCount(document),
  });
}

/**
 * Whether the document should get an automatic version now: something changed since the last version,
 * and the last automatic one is at least five minutes old. Typing all afternoon makes a version every
 * five minutes, not one per key; an unchanged document makes none.
 */
export function shouldSnapshot(revisions: readonly Revision[], document: Document, now: number): boolean {
  const latest = revisions.reduce<Revision | undefined>((found, revision) => (!found || revision.createdAt > found.createdAt ? revision : found), undefined);
  if (latest && sameContent(latest, document)) return false;
  const lastAuto = revisions.filter((revision) => revision.reason === "auto").reduce((time, revision) => Math.max(time, revision.createdAt), -Infinity);
  return now - lastAuto >= AUTO_EVERY;
}

/**
 * Which versions to keep. Versions saved by hand, and the safety copy made before a restore, are never
 * dropped by age. Automatic ones thin out: all of the last hour, one per hour for the last day, one per
 * day for the last month, none older. Past `MAX_REVISIONS` the oldest automatic ones go first.
 */
export function pruneRevisions(revisions: readonly Revision[], now: number): { keep: Revision[]; drop: Revision[] } {
  const newestFirst = [...revisions].sort((a, b) => b.createdAt - a.createdAt);
  const buckets = new Set<string>();
  const keep: Revision[] = [];
  const drop: Revision[] = [];
  for (const revision of newestFirst) {
    const age = now - revision.createdAt;
    if (revision.reason !== "auto") {
      keep.push(revision);
      continue;
    }
    if (age > KEEP_AUTO_FOR) {
      drop.push(revision);
      continue;
    }
    if (age <= HOUR) {
      keep.push(revision);
      continue;
    }
    const bucket = age <= DAY ? `h${Math.floor(revision.createdAt / HOUR)}` : `d${Math.floor(revision.createdAt / DAY)}`;
    if (buckets.has(bucket)) drop.push(revision);
    else {
      buckets.add(bucket);
      keep.push(revision);
    }
  }
  while (keep.length > MAX_REVISIONS) {
    const oldestAuto = keep.map((revision, index) => [revision, index] as const).reverse().find(([revision]) => revision.reason === "auto");
    if (!oldestAuto) break;
    keep.splice(oldestAuto[1], 1);
    drop.push(oldestAuto[0]);
  }
  return { keep, drop };
}

/**
 * Restoring a version: the document gets the version's title and text back; the current state is
 * returned as a revision to keep first, so a restore can itself be undone from the history.
 */
export function restore(
  document: Document,
  revisions: readonly Revision[],
  revisionId: string,
  safetyId: string,
  now: number,
): Result<{ document: Document; safety: Revision }, VersionsError> {
  const revision = revisions.find((candidate) => candidate.id === revisionId);
  if (!revision) return err(versionsError("unknown-revision", revisionId));
  const readable = readDocument({ ...document, title: revision.title, body: revision.body });
  if (!readable.ok) return err(versionsError("revision-damaged", revisionId));
  const safety = makeRevision(document, "before-restore", safetyId, now);
  if (!safety.ok) return safety;
  return ok({ document: { ...readable.value, updatedAt: now }, safety: safety.value });
}

/** "+120 words", "−8 words", "no change in length" — between a version and the one before it. */
export function wordChange(revision: Pick<Revision, "words">, previous?: Pick<Revision, "words">): string {
  if (!previous) return `${revision.words} ${revision.words === 1 ? "word" : "words"}`;
  const delta = revision.words - previous.words;
  if (delta === 0) return "same length";
  return `${delta > 0 ? "+" : "−"}${Math.abs(delta)} ${Math.abs(delta) === 1 ? "word" : "words"}`;
}
