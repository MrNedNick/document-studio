// @vitest-environment jsdom
/**
 * History through the real UI: automatic and named versions, restoring with the confirm dialog, the
 * safety copy that makes a restore reversible, and a version that no longer reads.
 */
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "../../src/App";
import { putRaw, resetConnection, writeRevisions } from "../../src/adapters/document-store";
import { newDocument } from "../../src/domain/01-blocks";
import type { Revision } from "../../src/domain/04-versions";
import { editorHtml, paste } from "./helpers";

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetConnection();
});
afterEach(cleanup);

const body = (text: string) => ({ type: "doc" as const, content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

async function open() {
  render(<App />);
  await screen.findByRole("textbox", { name: "Document" });
}

async function openHistory() {
  fireEvent.click(screen.getByRole("button", { name: /^History/ }));
  return screen.findByRole("dialog", { name: "History" });
}

describe("versions and restore — integration", () => {
  it("writing makes an automatic version; a named one can be saved too", async () => {
    await open();
    paste({ text: "First draft" });
    await waitFor(() => expect(screen.getByRole("button", { name: "History (1)" })).toBeTruthy(), { timeout: 3000 });
    const dialog = await openHistory();
    fireEvent.change(within(dialog).getByLabelText("Version name"), { target: { value: "Sent to Anna" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save a version" }));
    expect(await within(dialog).findByText("Version saved.")).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: /Saved: Sent to Anna/ })).toBeTruthy();
  });

  it("restoring asks first, brings the text back, keeps the current one as a version — and survives a reload", async () => {
    const doc = { ...newDocument("d", Date.now(), "Plan"), body: body("Current text") };
    await putRaw(doc);
    const old: Revision = { id: "old", documentId: "d", createdAt: Date.now() - 3_600_000, reason: "manual", name: "Approved", title: "Plan", body: body("Approved text"), words: 2 };
    await writeRevisions([old]);
    resetConnection();
    await open();
    const dialog = await openHistory();
    fireEvent.click(within(dialog).getByRole("button", { name: /Saved: Approved/ }));
    expect(within(dialog).getByRole("region", { name: "Preview" }).textContent).toContain("Approved text");
    fireEvent.click(within(dialog).getByRole("button", { name: "Restore this version" }));
    fireEvent.click(await screen.findByRole("button", { name: "Restore" }));
    await waitFor(() => expect(editorHtml()).toContain("Approved text"));
    expect(await within(dialog).findByRole("button", { name: /Before a restore/ })).toBeTruthy();
    cleanup();
    resetConnection();
    await open();
    await waitFor(() => expect(editorHtml()).toContain("Approved text"));
  });

  it("cancelling the confirm changes nothing", async () => {
    await putRaw({ ...newDocument("d", Date.now()), body: body("Keep me") });
    await writeRevisions([{ id: "o", documentId: "d", createdAt: 1, reason: "auto", title: "", body: body("Old"), words: 1 }]);
    resetConnection();
    await open();
    const dialog = await openHistory();
    fireEvent.click(within(dialog).getByRole("button", { name: "Restore this version" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(editorHtml()).toContain("Keep me");
  });

  it("edge case, a damaged version can't be restored, says why, and the text is untouched", async () => {
    await putRaw({ ...newDocument("d", Date.now()), body: body("Safe text") });
    await writeRevisions([{ id: "bad", documentId: "d", createdAt: Date.now() - 1000, reason: "manual", title: "", body: { type: "doc", content: [{ type: "marquee" }] }, words: 0 } as Revision]);
    resetConnection();
    await open();
    const dialog = await openHistory();
    expect(within(dialog).getByRole("region", { name: "Preview" }).textContent).toContain("can't be shown");
    fireEvent.click(within(dialog).getByRole("button", { name: "Restore this version" }));
    fireEvent.click(await screen.findByRole("button", { name: "Restore" }));
    expect(await within(dialog).findByText(/can't be read any more, so it can't be restored/)).toBeTruthy();
    expect(editorHtml()).toContain("Safe text");
  });
});
