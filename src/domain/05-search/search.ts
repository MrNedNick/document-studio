import { textOf, type Block, type Document } from "../01-blocks";
import { err, ok, type Result } from "../result";
import { searchError, type SearchError } from "./errors";
import { MAX_QUERY, type DocumentHit, type Heading, type Span } from "./types";

/**
 * Text folded for matching — lower case, accents removed — with a map from every folded character back
 * to its place in the original, so a match can be highlighted where it really is ("Café" found by "cafe").
 */
export function fold(text: string): { folded: string; origin: number[] } {
  let folded = "";
  const origin: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const plain = text[i]!.normalize("NFD").replace(/\p{Mark}/gu, "").toLowerCase();
    for (const char of plain) {
      folded += char;
      origin.push(i);
    }
  }
  return { folded, origin };
}

/** Checks a query: empty finds nothing (not an error), too long is refused. */
export function checkQuery(query: string): Result<string, SearchError> {
  if (query.length > MAX_QUERY) return err(searchError("query-too-long"));
  return ok(query);
}

/**
 * Every place a query occurs in a text, ignoring case and accents unless asked, as spans in the
 * original text. Matches don't overlap; an empty query has none.
 */
export function findAll(text: string, query: string, options: { matchCase?: boolean } = {}): Span[] {
  if (!query) return [];
  const spans: Span[] = [];
  if (options.matchCase) {
    for (let at = text.indexOf(query); at !== -1; at = text.indexOf(query, at + query.length)) spans.push([at, at + query.length]);
    return spans;
  }
  const { folded, origin } = fold(text);
  const needle = fold(query).folded;
  if (!needle) return [];
  for (let at = folded.indexOf(needle); at !== -1; at = folded.indexOf(needle, at + needle.length)) {
    const end = at + needle.length - 1;
    spans.push([origin[at]!, origin[end]! + 1]);
  }
  return spans;
}

/** The document's headings in order — the outline. Empty headings are left out. */
export function outline(body: Block): Heading[] {
  const found: Heading[] = [];
  let index = 0;
  const walk = (block: Block) => {
    if (block.type === "heading") {
      const level = Number(block.attrs?.level ?? 1);
      const text = textOf(block).trim();
      if (text && (level === 1 || level === 2 || level === 3)) found.push({ level, text, index });
      index++;
      return;
    }
    (block.content ?? []).forEach(walk);
  };
  walk(body);
  return found;
}

/** A few words either side of a span, with an ellipsis where the text goes on. */
export function snippetAround(text: string, span: Span | undefined, radius = 60): string {
  const clean = text.replace(/\s+/g, " ");
  if (!span) return clean.slice(0, radius * 2).trim() + (clean.length > radius * 2 ? "…" : "");
  // Offsets were found in the original text; collapsing whitespace before them only moves them left.
  const before = text.slice(0, span[0]).replace(/\s+/g, " ").length;
  const start = Math.max(0, before - radius);
  const end = Math.min(clean.length, before + (span[1] - span[0]) + radius);
  return `${start > 0 ? "…" : ""}${clean.slice(start, end).trim()}${end < clean.length ? "…" : ""}`;
}

/** Documents that mention the query in their title or text, most matches first, then most recent. */
export function searchDocuments(documents: readonly Document[], query: string): Result<DocumentHit[], SearchError> {
  const checked = checkQuery(query.trim());
  if (!checked.ok) return checked;
  const q = checked.value;
  const hits = documents.flatMap((document) => {
    const text = textOf(document.body);
    const inTitle = findAll(document.title, q);
    const inText = findAll(text, q);
    if (q && !inTitle.length && !inText.length) return [];
    return [{ id: document.id, title: document.title, updatedAt: document.updatedAt, matches: inTitle.length + inText.length, snippet: snippetAround(text, inText[0]) }];
  });
  return ok(hits.sort((a, b) => b.matches - a.matches || b.updatedAt - a.updatedAt));
}
