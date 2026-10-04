import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "../../src/App";
import * as files from "../../src/adapters/document-files";
import { listDocuments, loadAsset, putRaw, resetConnection, saveAsset } from "../../src/adapters/document-store";
import { assetsIn } from "../../src/domain/03-images";
import { bundle } from "../fixtures/06-export/bundles";
import { paste, press, editorHtml } from "./helpers";

beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory();
  resetConnection();
  URL.createObjectURL ??= () => "blob:test";
  URL.revokeObjectURL ??= () => {};
  await putRaw(bundle.document);
  const { data: _, ...asset } = bundle.assets[0]!;
  await saveAsset(asset, new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function open() {
  render(<App />);
  await screen.findByRole("textbox", { name: "Document" });
}

async function choose(text: string) {
  await act(async () => { fireEvent.change(screen.getByLabelText("Import document file"), { target: { files: [new File([text], "copy.json", { type: "application/json" })] } }); });
}

describe("export and import — real editor and storage", () => {
  it("HTML contains text, a table, its caption and embedded picture; latest typing is exported before autosave", async () => {
    const downloaded = vi.spyOn(files, "downloadDocumentFile").mockImplementation(() => {});
    await open();
    paste({ text: "Freshly typed words" });
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    fireEvent.click(screen.getByRole("button", { name: "Web page (HTML)" }));
    await waitFor(() => expect(downloaded).toHaveBeenCalledOnce());
    const [html, name, type] = downloaded.mock.calls[0]!;
    expect(name).toBe("q3-plan-draft.html");
    expect(type).toBe("text/html");
    expect(html).toContain("Freshly typed words");
    expect(html).toContain("<table");
    expect(html).toContain("Revenue");
    expect(html).toContain("data:image/png;base64,AQID");
  });

  it("a JSON copy gets new document and asset ids, keeps the original intact, and returns after reload", async () => {
    const downloaded = vi.spyOn(files, "downloadDocumentFile").mockImplementation(() => {});
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    fireEvent.click(screen.getByRole("button", { name: "Document file (.json)" }));
    await waitFor(() => expect(downloaded).toHaveBeenCalledOnce());
    const [text] = downloaded.mock.calls[0]!;
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Documents" }));
    await choose(text);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Documents" })).toBeNull());
    const documents = await listDocuments();
    expect(documents).toHaveLength(2);
    const copy = documents.find((document) => document.id !== bundle.document.id)!;
    expect(copy.title).toBe(bundle.document.title);
    const [pictureId] = [...assetsIn(copy.body)];
    expect(pictureId).not.toBe("pic");
    expect([...new Uint8Array(await (await loadAsset(pictureId!))!.blob.arrayBuffer())]).toEqual([1, 2, 3]);
    expect(documents.find((document) => document.id === "d")!.body).toEqual(bundle.document.body);
    cleanup(); resetConnection(); await open();
    await waitFor(() => expect(editorHtml()).toContain(pictureId));
    expect(document.querySelector(".ProseMirror")?.textContent).toContain("Revenue");
    expect(document.querySelectorAll(".ProseMirror table")).toHaveLength(1);
    await waitFor(() => expect(document.querySelector(".ProseMirror figure img")?.getAttribute("alt")).toBe("Chart"));
  });

  it("damaged, newer, incomplete and duplicate-picture files explain the error and leave documents and pictures intact", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Documents" }));
    await waitFor(() => expect(screen.queryByText("Reading documents…")).toBeNull());
    const documents = await listDocuments();
    for (const text of ["{oops", JSON.stringify({ ...bundle, version: 2 }), JSON.stringify({ ...bundle, assets: [] }), JSON.stringify({ ...bundle, assets: [bundle.assets[0], bundle.assets[0]] }), JSON.stringify({ ...bundle, document: { ...bundle.document, body: { type: "doc", content: [{ type: "text", text: "Bad", marks: {} }] } } })]) {
      await choose(text);
      await screen.findByRole("alert");
      expect(await listDocuments()).toEqual(documents);
      expect((await loadAsset("pic"))?.asset.id).toBe("pic");
    }
  });

  it("a failed picture write rolls the whole import back", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-0000-0000-000000000000");
    const twoPictures = {
      ...bundle,
      document: { ...bundle.document, body: { type: "doc", content: [{ type: "figure", attrs: { assetId: "pic" } }, { type: "figure", attrs: { assetId: "second" } }] } },
      assets: [bundle.assets[0], { ...bundle.assets[0], id: "second" }],
    };
    await expect(files.importDocumentFile(JSON.stringify(twoPictures))).rejects.toThrow("Nothing was imported");
    expect(await listDocuments()).toEqual([bundle.document]);
    expect(await loadAsset("00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  it("missing picture bytes are named in HTML and prevent an incomplete JSON export", async () => {
    await putRaw({ ...bundle.document, body: { type: "doc", content: [{ type: "figure", attrs: { assetId: "gone", alt: "Map" } }] } });
    const page = await files.documentHtml((await listDocuments())[0]!);
    expect(page.missing).toEqual(["gone"]);
    expect(page.html).toContain("Picture not available: Map");
    await expect(files.documentBundle((await listDocuments())[0]!)).rejects.toThrow("picture is missing");
  });

  it("exporting after undo of a table contains the current document, with no stale table", async () => {
    const downloaded = vi.spyOn(files, "downloadDocumentFile").mockImplementation(() => {});
    await putRaw({ ...bundle.document, body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Keep this" }] }] } });
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Insert table" }));
    expect(editorHtml()).toContain("<table");
    press("z", { ctrlKey: true });
    expect(editorHtml()).not.toContain("<table");
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    fireEvent.click(screen.getByRole("button", { name: "Web page (HTML)" }));
    await waitFor(() => expect(downloaded).toHaveBeenCalledOnce());
    expect(downloaded.mock.calls[0]![0]).toContain("Keep this");
    expect(downloaded.mock.calls[0]![0]).not.toContain("<table");
  });
});
