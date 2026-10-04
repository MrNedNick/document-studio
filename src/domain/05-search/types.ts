/** A match in a string: start and end offsets, end exclusive. */
export type Span = [number, number];

export interface Heading {
  level: 1 | 2 | 3;
  text: string;
  /** Which heading of the document this is, counting from 0 — how the editor finds it again. */
  index: number;
}

export interface DocumentHit {
  id: string;
  title: string;
  updatedAt: number;
  /** Matches in the title and the text together. */
  matches: number;
  /** A few words around the first match in the text, or the opening words when only the title matched. */
  snippet: string;
}

/** Longer queries are almost certainly a paste by mistake; they are refused rather than run. */
export const MAX_QUERY = 200;
