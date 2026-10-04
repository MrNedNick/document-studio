/**
 * A document is a tree of blocks in the editor's own JSON form (ProseMirror's): the same object is
 * edited, saved to IndexedDB, exported and imported, so nothing is lost in translation between them.
 */
export interface Mark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface Block {
  type: string;
  attrs?: Record<string, unknown>;
  content?: Block[];
  text?: string;
  marks?: Mark[];
}

export interface DocumentBody extends Block {
  type: "doc";
  content: Block[];
}

/** Bumped whenever the set of blocks or their meaning changes; older documents are read, newer ones refused. */
export const SCHEMA_VERSION = 1;

export interface Document {
  id: string;
  title: string;
  schemaVersion: number;
  body: DocumentBody;
  /** Milliseconds since 1970, set on every save. */
  updatedAt: number;
}

/** Blocks and marks this version of the editor knows. Anything else in a document is a damaged or foreign file. */
export const BLOCK_TYPES = ["doc", "paragraph", "heading", "text", "hardBreak", "blockquote", "codeBlock", "horizontalRule", "bulletList", "orderedList", "listItem"] as const;
export const MARK_TYPES = ["bold", "italic", "strike", "code", "link", "underline"] as const;

/** Pasted HTML bigger than this is refused rather than parsed: a page that size is a mistake, not a quote. */
export const MAX_PASTE_BYTES = 2_000_000;
