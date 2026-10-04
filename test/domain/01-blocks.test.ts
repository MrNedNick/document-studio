import { describe, expect, it } from "vitest";
import { cleanPastedHtml, MAX_PASTE_BYTES, newDocument, plainTextToBlocks, readDocument, SCHEMA_VERSION, wordCount } from "../../src/domain/01-blocks";
import { empty, googleDocs, hostile, word } from "../fixtures/01-blocks/pastes";

const clean = (html: string) => {
  const result = cleanPastedHtml(html);
  if (!result.ok) throw new Error(result.error.reason);
  return result.value;
};

describe("pasting HTML", () => {
  it("keeps Word's words and emphasis, drops its markup", () => {
    const { html } = clean(word);
    expect(html).toBe("<p><strong>Quarterly report</strong></p><p>Revenue grew by <em>twelve</em> percent.</p>");
  });

  it("reads Google Docs' styled spans as real bold and italic, and its wrapper as nothing", () => {
    expect(clean(googleDocs).html).toBe("<p><strong>Agenda</strong></p><p><em>Draft</em> — please review</p>");
  });

  it("edge case, hostile HTML: scripts, handlers, javascript: links, iframes and styles are gone, the words stay", () => {
    const { html, removed } = clean(hostile);
    expect(html).toBe('<p>Hello <a>click</a> and <a href="https://example.org">this</a></p>');
    expect(html).not.toMatch(/script|onclick|javascript|iframe|onerror|style/i);
    expect(removed.sort()).toEqual(["embedded pages", "images", "scripts", "styles", "unsafe links"]);
  });

  it("refuses a paste with nothing readable, and one too big to be a quote", () => {
    expect(cleanPastedHtml(empty)).toEqual({ ok: false, error: { kind: "blocks", reason: "paste-empty" } });
    expect(cleanPastedHtml("<p>" + "x".repeat(MAX_PASTE_BYTES) + "</p>")).toEqual({ ok: false, error: { kind: "blocks", reason: "paste-too-large" } });
  });
});

describe("pasting plain text", () => {
  it("blank lines make paragraphs, single line breaks stay line breaks", () => {
    expect(plainTextToBlocks("First line\r\nsecond line\n\n\nNext paragraph  \n")).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "First line" }, { type: "hardBreak" }, { type: "text", text: "second line" }] },
      { type: "paragraph", content: [{ type: "text", text: "Next paragraph" }] },
    ]);
    expect(plainTextToBlocks(" \n\n ")).toEqual([]);
  });
});

describe("documents", () => {
  const good = {
    ...newDocument("d1", 1000, "Notes"),
    body: {
      type: "doc" as const,
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Hello world" }] },
        { type: "paragraph", content: [{ type: "text", text: "Bold", marks: [{ type: "bold" }] }] },
      ],
    },
  };

  it("reads a saved document back as it was", () => {
    expect(readDocument(JSON.parse(JSON.stringify(good)))).toEqual({ ok: true, value: good });
    expect(wordCount(good)).toBe(3);
  });

  it("names what is wrong with a damaged or foreign file", () => {
    expect(readDocument(null)).toMatchObject({ ok: false, error: { reason: "not-a-document" } });
    expect(readDocument({ ...good, schemaVersion: SCHEMA_VERSION + 1 })).toMatchObject({ ok: false, error: { reason: "newer-schema" } });
    expect(readDocument({ ...good, body: { type: "doc", content: [{ type: "marquee" }] } })).toEqual({ ok: false, error: { kind: "blocks", reason: "unknown-block", type: "marquee" } });
    expect(readDocument({ ...good, body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "blink" }] }] }] } })).toMatchObject({
      ok: false,
      error: { reason: "unknown-mark", type: "blink" },
    });
    expect(readDocument({ ...good, body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text" }] }] } })).toMatchObject({ ok: false, error: { reason: "not-a-document" } });
  });
});
