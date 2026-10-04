import type { DocumentBody } from "../01-blocks";

export type RevisionReason = "auto" | "manual" | "before-restore";

/** A saved state of one document: what it said, when, and why it was kept. */
export interface Revision {
  id: string;
  documentId: string;
  createdAt: number;
  reason: RevisionReason;
  /** Given by the user for a version they saved on purpose. */
  name?: string;
  title: string;
  body: DocumentBody;
  words: number;
}

const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** A new automatic version at most this often while someone is writing. */
export const AUTO_EVERY = 5 * MINUTE;
/** Automatic versions older than this are dropped entirely. */
export const KEEP_AUTO_FOR = 30 * DAY;
export const MAX_REVISIONS = 200;
