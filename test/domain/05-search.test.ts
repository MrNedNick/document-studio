import { describe, expect, it } from "vitest";
import { newDocument, type Block } from "../../src/domain/01-blocks";
import { findAll, fold, MAX_QUERY, outline, searchDocuments, snippetAround } from "../../src/domain/05-search";

const p = (text: string): Block => ({ type: "paragraph", content: [{ type: "text", text }] });
const h = (level: number, text: string): Block => ({ type: "heading", attrs: { level }, content: text ? [{ type: "text", text }] : [] });

describe("matching", () => {
  it("ignores case and accents, and points at the original letters", () => {
    expect(findAll("Le Café de Flore, café crème", "cafe")).toEqual([[3, 7], [18, 22]]);
    expect(findAll("Ärger und ärgern", "ARGER")).toEqual([[0, 5], [10, 15]]);
    expect(fold("Straße").folded).toBe("straße");
  });

  it("can match case exactly, never overlaps, and finds nothing for an empty query", () => {
    expect(findAll("Plan plan PLAN", "plan", { matchCase: true })).toEqual([[5, 9]]);
    expect(findAll("aaaa", "aa")).toEqual([[0, 2], [2, 4]]);
    expect(findAll("anything", "")).toEqual([]);
  });
});

it("the outline lists headings in order with their index, skipping empty ones", () => {
  const body: Block = { type: "doc", content: [h(1, "Plan"), p("intro"), h(2, ""), h(2, "Budget"), { type: "blockquote", content: [h(3, "Quoted")] }] };
  expect(outline(body)).toEqual([
    { level: 1, text: "Plan", index: 0 },
    { level: 2, text: "Budget", index: 2 },
    { level: 3, text: "Quoted", index: 3 },
  ]);
});

describe("searching all documents", () => {
  const doc = (id: string, title: string, text: string, updatedAt: number) => ({ ...newDocument(id, updatedAt, title), body: { type: "doc" as const, content: [p(text)] } });
  const docs = [doc("a", "Trip", "We drove to the lake and swam in the lake.", 1), doc("b", "Lake house", "Booking details.", 2), doc("c", "Taxes", "Nothing here.", 3)];

  it("finds the query in titles and text, most matches first, with a snippet around the first match", () => {
    const result = searchDocuments(docs, "lake");
    expect(result.ok && result.value.map((hit) => [hit.id, hit.matches])).toEqual([["a", 2], ["b", 1]]);
    expect(result.ok && result.value[0]!.snippet).toBe("We drove to the lake and swam in the lake.");
  });

  it("an empty query lists every document, newest first; a pasted essay as a query is refused", () => {
    const all = searchDocuments(docs, "  ");
    expect(all.ok && all.value.map((hit) => hit.id)).toEqual(["c", "b", "a"]);
    expect(searchDocuments(docs, "x".repeat(MAX_QUERY + 1))).toEqual({ ok: false, error: { kind: "search", reason: "query-too-long" } });
  });

  it("cuts a long text to the words around the match", () => {
    const text = `${"word ".repeat(40)}needle${" word".repeat(40)}`;
    expect(snippetAround(text, [200, 206], 20)).toBe("…word word word word needle word word word word…");
  });
});
