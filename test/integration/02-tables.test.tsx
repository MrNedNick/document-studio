// @vitest-environment jsdom
/**
 * Tables and lists through the real editor: inserting, undoing, pasting from a spreadsheet, checklists
 * that survive a reload.
 */
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "../../src/App";
import { resetConnection } from "../../src/adapters/document-store";
import { MAX_ROWS } from "../../src/domain/02-tables";
import { excelHtml, excelText } from "../fixtures/02-tables/clipboard";
import { editorHtml, paste, press } from "./helpers";

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetConnection();
});
afterEach(cleanup);

async function open() {
  render(<App />);
  await screen.findByRole("textbox", { name: "Document" });
}

describe("tables and lists — integration", () => {
  it("edge case, undo after a table: one undo takes the inserted table away, redo brings it back", async () => {
    await open();
    const before = editorHtml();
    fireEvent.click(screen.getByRole("button", { name: "Insert table" }));
    expect(document.querySelectorAll(".ProseMirror table tr")).toHaveLength(3);
    expect(document.querySelectorAll(".ProseMirror th")).toHaveLength(3);
    expect(screen.getByRole("toolbar", { name: "Table" })).toBeTruthy();
    press("z", { ctrlKey: true });
    expect(editorHtml()).toBe(before);
    press("z", { ctrlKey: true, shiftKey: true });
    expect(document.querySelector(".ProseMirror table")).toBeTruthy();
  });

  it("rows and columns are added from the table bar", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Insert table" }));
    fireEvent.click(screen.getByRole("button", { name: "Row below" }));
    fireEvent.click(screen.getByRole("button", { name: "Column right" }));
    expect(document.querySelectorAll(".ProseMirror tr")).toHaveLength(4);
    expect(document.querySelectorAll(".ProseMirror tr:first-child > *")).toHaveLength(4);
  });

  it("Excel's HTML pastes as a clean table, merged cell included", async () => {
    await open();
    paste({ html: excelHtml, text: "Region\tRevenue" });
    const cells = [...document.querySelectorAll(".ProseMirror td, .ProseMirror th")].map((cell) => cell.textContent);
    expect(cells).toEqual(["Region", "Revenue", "North", "1200.50", "Total to follow"]);
    expect(document.querySelector('.ProseMirror td[colspan="2"]')).toBeTruthy();
    expect(editorHtml()).not.toMatch(/xl65|mso|width="128"/);
  });

  it("cells copied as plain text become a table with a header row; too big a range is refused with its size", async () => {
    await open();
    paste({ text: excelText });
    expect([...document.querySelectorAll(".ProseMirror th")].map((cell) => cell.textContent)).toEqual(["Item", "Note"]);
    expect(screen.getByText("Pasted a table of 3 rows and 2 columns.")).toBeTruthy();
    const huge = Array.from({ length: MAX_ROWS + 1 }, (_, i) => `${i}\tx`).join("\n");
    paste({ text: huge });
    expect(screen.getByText(/That table is 501 × 2 — larger than a document table can be/)).toBeTruthy();
  });

  it("a checklist counts what is done, and the ticks survive a reload", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Checklist" }));
    paste({ text: "Send the invoice" });
    const box = () => document.querySelector<HTMLInputElement>('.ProseMirror input[type="checkbox"]')!;
    act(() => {
      box().click();
    });
    await waitFor(() => expect(screen.getByText("Checklist: 1 of 1 done")).toBeTruthy(), { timeout: 2000 });
    await waitFor(() => expect(screen.getByText("Saved on this device")).toBeTruthy(), { timeout: 2000 });
    cleanup();
    resetConnection();
    await open();
    await waitFor(() => expect(box().checked).toBe(true));
    expect(screen.getByText("Checklist: 1 of 1 done")).toBeTruthy();
  });

  it("bulleted and numbered lists come from the toolbar", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Numbered list" }));
    paste({ text: "First" });
    expect(editorHtml()).toContain("<ol><li><p>First</p></li></ol>");
    fireEvent.click(screen.getByRole("button", { name: "Bulleted list" }));
    expect(editorHtml()).toContain("<ul><li><p>First</p></li></ul>");
  });
});
