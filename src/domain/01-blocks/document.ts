import { err, ok, type Result } from "../result";
import { blocksError, type BlocksError } from "./errors";
import { BLOCK_TYPES, MARK_TYPES, SCHEMA_VERSION, type Block, type Document, type DocumentBody } from "./types";

const blocks = new Set<string>(BLOCK_TYPES);
const marks = new Set<string>(MARK_TYPES);

export function emptyBody(): DocumentBody {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

/** A new document has no title yet; the page shows "Untitled document" as a hint, not as text to delete. */
export function newDocument(id: string, now: number, title = ""): Document {
  return { id, title, schemaVersion: SCHEMA_VERSION, body: emptyBody(), updatedAt: now };
}

/** Walks the tree; the first unknown block or mark is the error. */
function checkBlock(block: Block): BlocksError | null {
  if (!block || typeof block !== "object" || typeof block.type !== "string") return blocksError("not-a-document");
  if (!blocks.has(block.type)) return blocksError("unknown-block", block.type);
  if (block.type === "text" && typeof block.text !== "string") return blocksError("not-a-document");
  for (const mark of block.marks ?? []) if (!marks.has(mark?.type)) return blocksError("unknown-mark", mark?.type);
  if (block.content !== undefined && !Array.isArray(block.content)) return blocksError("not-a-document");
  for (const child of block.content ?? []) {
    const problem = checkBlock(child);
    if (problem) return problem;
  }
  return null;
}

/**
 * Reads a document from storage or a file and checks every block in it. A document from a newer version
 * of the editor is refused rather than half-read; one with blocks this version doesn't know is damaged
 * or foreign, and the error names the block.
 */
export function readDocument(raw: unknown): Result<Document, BlocksError> {
  const data = raw as Partial<Document> | null;
  if (!data || typeof data !== "object" || typeof data.id !== "string" || !data.body || typeof data.schemaVersion !== "number") return err(blocksError("not-a-document"));
  if (data.schemaVersion > SCHEMA_VERSION) return err(blocksError("newer-schema"));
  if (data.body.type !== "doc" || !Array.isArray(data.body.content)) return err(blocksError("not-a-document"));
  const problem = checkBlock(data.body);
  if (problem) return err(problem);
  return ok({
    id: data.id,
    title: typeof data.title === "string" ? data.title : "",
    schemaVersion: SCHEMA_VERSION,
    body: data.body as DocumentBody,
    updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : 0,
  });
}

/** The words in a document, for the status line and for measuring a large one. */
export function textOf(block: Block): string {
  if (block.type === "text") return block.text ?? "";
  const inner = (block.content ?? []).map(textOf).join(block.type === "doc" || block.type.endsWith("List") ? "\n" : "");
  return block.type === "hardBreak" ? "\n" : inner;
}

export function wordCount(document: Pick<Document, "body">): number {
  return textOf(document.body).split(/\s+/).filter(Boolean).length;
}
