import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { findAll } from "../../domain/05-search";

export interface Match {
  from: number;
  to: number;
}

interface SearchState {
  query: string;
  matchCase: boolean;
  matches: Match[];
  current: number;
  decorations: DecorationSet;
}

export const searchKey = new PluginKey<SearchState>("documentSearch");

/** A placeholder for pictures and line breaks inside a paragraph, so no match runs across them. */
const GAP = "\u0000";

/**
 * Matches of the query in every paragraph, heading, cell and caption. Each text block is searched as a
 * whole, so a word that is half bold is still found; matches are mapped back to document positions.
 */
export function findMatches(doc: ProseMirrorNode, query: string, matchCase: boolean): Match[] {
  if (!query) return [];
  const matches: Match[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    let text = "";
    const positions: number[] = [];
    node.forEach((child, offset) => {
      if (child.isText) {
        for (let i = 0; i < child.text!.length; i++) {
          text += child.text![i];
          positions.push(pos + 1 + offset + i);
        }
      } else {
        text += GAP;
        positions.push(pos + 1 + offset);
      }
    });
    for (const [start, end] of findAll(text, query, { matchCase })) matches.push({ from: positions[start]!, to: positions[end - 1]! + 1 });
    return false;
  });
  return matches;
}

function decorate(doc: ProseMirrorNode, matches: Match[], current: number) {
  return DecorationSet.create(
    doc,
    matches.map((match, index) => Decoration.inline(match.from, match.to, { class: index === current ? "search-match search-match-current" : "search-match" })),
  );
}

function build(doc: ProseMirrorNode, query: string, matchCase: boolean, near: number): SearchState {
  const matches = findMatches(doc, query, matchCase);
  // Start from the first match at or after the cursor, like a browser's find.
  const after = matches.findIndex((match) => match.from >= near);
  const current = matches.length ? (after === -1 ? 0 : after) : -1;
  return { query, matchCase, matches, current, decorations: decorate(doc, matches, current) };
}

type Meta = { query: string; matchCase: boolean } | { move: 1 | -1 } | { clear: true };

export const DocumentSearch = Extension.create({
  name: "documentSearch",
  addProseMirrorPlugins() {
    return [
      new Plugin<SearchState>({
        key: searchKey,
        state: {
          init: (_, state) => ({ query: "", matchCase: false, matches: [], current: -1, decorations: DecorationSet.create(state.doc, []) }),
          apply(tr, value, _old, state) {
            const meta = tr.getMeta(searchKey) as Meta | undefined;
            if (meta && "clear" in meta) return { query: "", matchCase: false, matches: [], current: -1, decorations: DecorationSet.empty };
            if (meta && "query" in meta) return build(state.doc, meta.query, meta.matchCase, state.selection.from);
            if (meta && "move" in meta && value.matches.length) {
              const current = (value.current + meta.move + value.matches.length) % value.matches.length;
              return { ...value, current, decorations: decorate(state.doc, value.matches, current) };
            }
            // Typing while the bar is open keeps the matches up to date.
            if (tr.docChanged && value.query) return build(state.doc, value.query, value.matchCase, value.matches[value.current]?.from ?? state.selection.from);
            return value;
          },
        },
        props: {
          decorations: (state) => searchKey.getState(state)?.decorations,
        },
      }),
    ];
  },
});

export const searchState = (state: EditorState) => searchKey.getState(state);

/** Selects the current match and scrolls it into view. */
export function reveal(state: EditorState, dispatch: (tr: Transaction) => void) {
  const search = searchKey.getState(state);
  const match = search?.matches[search.current];
  if (!match) return;
  dispatch(state.tr.setSelection(TextSelection.create(state.doc, match.from, match.to)).scrollIntoView());
}

/**
 * Replaces the current match, or every match, in one transaction — so one undo takes it all back.
 * Matches are replaced from the end, so earlier positions stay valid.
 */
export function replaceMatches(state: EditorState, dispatch: (tr: Transaction) => void, replacement: string, all: boolean): number {
  const search = searchKey.getState(state);
  if (!search?.matches.length) return 0;
  const targets = all ? [...search.matches].reverse() : [search.matches[search.current]!];
  const tr = state.tr;
  for (const match of targets) {
    const marks = state.doc.resolve(match.from).marksAcross(state.doc.resolve(match.to)) ?? undefined;
    if (replacement) tr.replaceWith(match.from, match.to, state.schema.text(replacement, marks));
    else tr.delete(match.from, match.to);
  }
  dispatch(tr);
  return targets.length;
}
