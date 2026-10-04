// @vitest-environment jsdom
/**
 * Search and navigation through the real UI: find with a count, replace all as one undo step, ⌘/Ctrl+F
 * from anywhere, the outline, and the list of documents with its search.
 */
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "../../src/App";
import { putRaw, resetConnection } from "../../src/adapters/document-store";
import { newDocument, type Block } from "../../src/domain/01-blocks";
import { editorHtml, press } from "./helpers";

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetConnection();
});
afterEach(cleanup);

const p = (text: string): Block => ({ type: "paragraph", content: [{ type: "text", text }] });
const h = (level: number, text: string): Block => ({ type: "heading", attrs: { level }, content: [{ type: "text", text }] });

async function openWith(content: Block[], extra: Parameters<typeof putRaw>[0][] = []) {
  await putRaw({ ...newDocument("main", Date.now(), "Launch"), body: { type: "doc", content } });
  for (const record of extra) await putRaw(record);
  resetConnection();
  render(<App />);
  await screen.findByRole("textbox", { name: "Document" });
}

const plan = [h(1, "Launch plan"), p("The plan covers the café launch. Plan early, plan often."), h(2, "Budget"), p("Costs for the plan."), h(2, "Timeline"), p("Weeks one to four.")];

function openFind() {
  act(() => {
    fireEvent.keyDown(window, { key: "f", ctrlKey: true });
  });
  return screen.getByRole("search", { name: "Find in document" });
}

describe("search and navigation — integration", () => {
  it("⌘/Ctrl+F from anywhere opens find; matches are counted, ignoring case and accents, and Enter steps through them", async () => {
    await openWith(plan);
    const bar = openFind();
    const field = within(bar).getByPlaceholderText("Find");
    expect(document.activeElement).toBe(field);
    fireEvent.change(field, { target: { value: "PLAN" } });
    const count = () => bar.querySelector("[aria-live]")!.textContent;
    expect(count()).toMatch(/^\d of 5$/);
    expect(document.querySelectorAll(".ProseMirror .search-match")).toHaveLength(5);
    const first = count();
    fireEvent.keyDown(field, { key: "Enter" });
    expect(count()).not.toBe(first);
    fireEvent.change(field, { target: { value: "cafe" } });
    expect(count()).toBe("1 of 1");
    fireEvent.change(field, { target: { value: "nothing like this" } });
    expect(count()).toBe("No matches");
  });

  it("Replace all changes every match in one step — one undo puts them all back; closing clears the highlights", async () => {
    await openWith(plan);
    const before = editorHtml();
    const bar = openFind();
    fireEvent.change(within(bar).getByPlaceholderText("Find"), { target: { value: "plan" } });
    fireEvent.change(within(bar).getByPlaceholderText("Replace with"), { target: { value: "roadmap" } });
    fireEvent.click(within(bar).getByRole("button", { name: "Replace all" }));
    expect(within(bar).getByRole("status").textContent).toBe("Replaced 5 matches.");
    expect(editorHtml()).not.toMatch(/plan/i);
    fireEvent.click(within(bar).getByRole("button", { name: "Close find" }));
    expect(document.querySelectorAll(".search-match")).toHaveLength(0);
    press("z", { ctrlKey: true });
    expect(editorHtml()).toBe(before);
  });

  it("typing with the bar open moves the highlights at once and recounts after a pause", async () => {
    await openWith(plan);
    const bar = openFind();
    fireEvent.change(within(bar).getByPlaceholderText("Find"), { target: { value: "plan" } });
    const editor = (document.querySelector(".ProseMirror") as HTMLElement & { editor: { commands: { insertContentAt: (at: number, text: string) => void }; state: { doc: { content: { size: number } } } } }).editor;
    act(() => {
      editor.commands.insertContentAt(editor.state.doc.content.size - 1, " One more plan.");
    });
    await waitFor(() => expect(bar.querySelector("[aria-live]")!.textContent).toMatch(/of 6$/), { timeout: 2000 });
  });

  it("Match case narrows the matches", async () => {
    await openWith(plan);
    const bar = openFind();
    fireEvent.click(within(bar).getByLabelText("Match case"));
    fireEvent.change(within(bar).getByPlaceholderText("Find"), { target: { value: "Plan" } });
    expect(bar.querySelector("[aria-live]")!.textContent).toMatch(/of 1$/);
  });

  it("the outline lists the headings and jumps to one", async () => {
    await openWith(plan);
    const outline = screen.getAllByRole("navigation", { name: "Outline" })[0]!;
    expect(within(outline).getAllByRole("button").map((button) => button.textContent)).toEqual(["Launch plan", "Budget", "Timeline"]);
    fireEvent.click(within(outline).getByRole("button", { name: "Timeline" }));
    await waitFor(() => expect(within(outline).getByRole("button", { name: "Timeline" }).getAttribute("aria-current")).toBe("location"));
  });

  it("the documents list searches every document, opens one and starts a new one", async () => {
    const other = { ...newDocument("notes", Date.now() - 1000, "Meeting notes"), body: { type: "doc" as const, content: [p("We agreed on the budget for the roadmap.")] } };
    await openWith(plan, [other]);
    fireEvent.click(screen.getByRole("button", { name: "Documents" }));
    const dialog = await screen.findByRole("dialog", { name: "Documents" });
    await within(dialog).findByRole("list", { name: "Documents" });
    fireEvent.change(within(dialog).getByPlaceholderText("Search titles and text"), { target: { value: "roadmap" } });
    const results = within(dialog).getAllByRole("button").filter((button) => button.closest("ul"));
    expect(results).toHaveLength(1);
    expect(results[0]!.textContent).toMatch(/Meeting notes.*1 match · We agreed on the budget for the roadmap\./);
    fireEvent.click(results[0]!);
    await waitFor(() => expect(editorHtml()).toContain("We agreed on the budget"));

    fireEvent.click(screen.getByRole("button", { name: "Documents" }));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Documents" })).getByRole("button", { name: "New document" }));
    await waitFor(() => expect(editorHtml()).not.toContain("We agreed"));
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("");
  });

  it("a search nothing mentions says so", async () => {
    await openWith(plan);
    fireEvent.click(screen.getByRole("button", { name: "Documents" }));
    const dialog = await screen.findByRole("dialog", { name: "Documents" });
    await within(dialog).findByRole("list", { name: "Documents" });
    fireEvent.change(within(dialog).getByPlaceholderText("Search titles and text"), { target: { value: "zebra" } });
    expect(within(dialog).getByText("No document mentions “zebra”.")).toBeTruthy();
  });
});
