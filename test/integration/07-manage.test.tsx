// @vitest-environment jsdom
/**
 * Managing documents from the list: rename any of them, delete with a confirmation, and deleting the
 * open one moves on to the next instead of bringing it back on the next save.
 */
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "../../src/App";
import { listDocuments, putRaw, resetConnection } from "../../src/adapters/document-store";
import { newDocument, type Block } from "../../src/domain/01-blocks";
import { editorHtml } from "./helpers";

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetConnection();
});
afterEach(cleanup);

const p = (text: string): Block => ({ type: "paragraph", content: [{ type: "text", text }] });
const doc = (id: string, updatedAt: number, title: string, text: string) => ({ ...newDocument(id, updatedAt, title), body: { type: "doc" as const, content: [p(text)] } });

async function openList() {
  await putRaw(doc("main", Date.now(), "Launch", "The launch plan."));
  await putRaw(doc("notes", Date.now() - 1000, "Meeting notes", "We agreed on the budget."));
  resetConnection();
  render(<App />);
  await screen.findByRole("textbox", { name: "Document" });
  fireEvent.click(screen.getByRole("button", { name: "Documents" }));
  const dialog = await screen.findByRole("dialog", { name: "Documents" });
  await within(dialog).findByRole("list", { name: "Documents" });
  return dialog;
}

const titles = async () => (await listDocuments()).map((document) => document.title).sort();

describe("managing documents — integration", () => {
  it("renames another document in place; Escape cancels without closing the list", async () => {
    const dialog = await openList();
    fireEvent.click(within(dialog).getByRole("button", { name: "Rename “Meeting notes”" }));
    const field = within(dialog).getByRole("textbox", { name: "New title for “Meeting notes”" });
    expect(document.activeElement).toBe(field);
    fireEvent.change(field, { target: { value: "Budget meeting" } });
    fireEvent.keyDown(field, { key: "Escape" });
    expect(within(dialog).queryByRole("textbox", { name: /New title/ })).toBeNull();
    expect(screen.getByRole("dialog", { name: "Documents" })).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("button", { name: "Rename “Meeting notes”" }));
    fireEvent.change(within(dialog).getByRole("textbox", { name: /New title/ }), { target: { value: "Budget meeting" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await within(dialog).findByRole("button", { name: "Rename “Budget meeting”" });
    expect(await titles()).toEqual(["Budget meeting", "Launch"]);
  });

  it("renaming the open document changes the title above it too", async () => {
    const dialog = await openList();
    fireEvent.click(within(dialog).getByRole("button", { name: "Rename “Launch”" }));
    fireEvent.change(within(dialog).getByRole("textbox", { name: /New title/ }), { target: { value: "Launch v2" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Launch v2"));
    expect(await titles()).toEqual(["Launch v2", "Meeting notes"]);
  });

  it("deleting asks first; Cancel keeps the document, Delete removes it", async () => {
    const dialog = await openList();
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete “Meeting notes”" }));
    const ask = await screen.findByRole("dialog", { name: "Delete “Meeting notes”?" });
    fireEvent.click(within(ask).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /^Delete/ })).toBeNull());
    expect(await titles()).toEqual(["Launch", "Meeting notes"]);

    fireEvent.click(within(dialog).getByRole("button", { name: "Delete “Meeting notes”" }));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Delete “Meeting notes”?" })).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(within(dialog).queryByRole("button", { name: "Delete “Meeting notes”" })).toBeNull());
    expect(await titles()).toEqual(["Launch"]);
    expect(editorHtml()).toContain("The launch plan.");
  });

  it("deleting the open document opens the next one, and a pending save doesn't bring it back", async () => {
    const dialog = await openList();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Launch (edited)" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /^Delete “Launch/ }));
    fireEvent.click(within(await screen.findByRole("dialog", { name: /^Delete “Launch/ })).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(editorHtml()).toContain("We agreed on the budget."));
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Meeting notes");
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(await titles()).toEqual(["Meeting notes"]);
  });
});
