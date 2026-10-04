// @vitest-environment jsdom
/**
 * Writing and pasting through the real editor, saved to (fake) IndexedDB and opened again.
 */
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import App from "../../src/App";
import { putRaw, resetConnection } from "../../src/adapters/document-store";
import { googleDocs, hostile } from "../fixtures/01-blocks/pastes";

/** A paste the way the browser delivers it: a ClipboardEvent with HTML and/or plain text. */
function paste(data: { html?: string; text?: string }) {
  const editor = document.querySelector(".ProseMirror")!;
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", {
    value: { getData: (type: string) => (type === "text/html" ? (data.html ?? "") : type === "text/plain" ? (data.text ?? "") : ""), files: [], types: [] },
  });
  act(() => {
    editor.dispatchEvent(event);
  });
}

const editorHtml = () => document.querySelector(".ProseMirror")!.innerHTML;

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetConnection();
});
afterEach(cleanup);

async function open() {
  render(<App />);
  await screen.findByRole("textbox", { name: "Document" });
}

describe("blocks and safe paste — integration", () => {
  it("edge case, hostile HTML is pasted as its words only, and the page says what was removed", async () => {
    await open();
    paste({ html: hostile, text: "Hello click and this" });
    expect(editorHtml()).toContain('Hello click and <a target="_blank" rel="noopener noreferrer nofollow" href="https://example.org">this</a>');
    expect(editorHtml()).not.toMatch(/script|onclick|javascript|iframe|onerror|<style/i);
    const notice = screen.getByText(/^Pasted the text — removed /).textContent!;
    for (const thing of ["scripts", "unsafe links", "styles", "embedded pages", "images"]) expect(notice).toContain(thing);
  });

  it("Google Docs keeps its bold and italic", async () => {
    await open();
    paste({ html: googleDocs });
    expect(editorHtml()).toContain("<strong>Agenda</strong>");
    expect(editorHtml()).toContain("<em>Draft</em>");
  });

  it("plain text becomes paragraphs and line breaks, with no formatting", async () => {
    await open();
    paste({ text: "Line one\nline two\n\nSecond paragraph" });
    expect(editorHtml()).toContain("<p>Line one<br>line two</p><p>Second paragraph</p>");
  });

  it("one undo takes back a whole paste", async () => {
    await open();
    const before = editorHtml();
    paste({ html: "<h2>Pasted heading</h2><p>and a paragraph</p>" });
    expect(editorHtml()).toContain("<h2>Pasted heading</h2>");
    act(() => {
      document.querySelector(".ProseMirror")!.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true }));
    });
    expect(editorHtml()).toBe(before);
  });

  it("a paste with nothing readable says so and changes nothing", async () => {
    await open();
    const before = editorHtml();
    paste({ html: "<style>p{}</style><script>x()</script>" });
    expect(editorHtml()).toBe(before);
    expect(screen.getByText(/Nothing readable in what was pasted/)).toBeTruthy();
  });

  it("the title and text are saved and come back after a reload", async () => {
    await open();
    paste({ text: "Kept between visits" });
    await waitFor(() => expect(screen.getByText("Saved on this device")).toBeTruthy(), { timeout: 2000 });
    cleanup();
    resetConnection();
    await open();
    await waitFor(() => expect(editorHtml()).toContain("Kept between visits"));
  });

  it("edge case, a damaged saved document is set aside with a notice, and a fresh one opens", async () => {
    await putRaw({ id: "bad", schemaVersion: 1, updatedAt: 9, body: { type: "doc", content: [{ type: "marquee" }] } });
    resetConnection();
    await open();
    expect(screen.getByRole("alert").textContent).toMatch(/couldn't be read and was set aside/);
  });
});
