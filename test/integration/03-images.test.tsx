// @vitest-environment jsdom
/**
 * Pictures through the real editor and the real (fake) IndexedDB. jsdom can't decode images, so the one
 * browser-only step — decoding and shrinking a file — is replaced by a stand-in that checks the file the
 * same way and returns its bytes; storing, inserting, captions, undo and reload are the real thing.
 */
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "../../src/App";
import { putRaw, resetConnection } from "../../src/adapters/document-store";
import { checkImageFile, figureBlock } from "../../src/domain/03-images";
import { newDocument } from "../../src/domain/01-blocks";
import { editorHtml, press } from "./helpers";

vi.mock("../../src/adapters/image-files", () => ({
  prepareImage: async (file: File) => {
    const checked = checkImageFile(file);
    if (!checked.ok) return checked;
    return { ok: true, value: { asset: { id: `asset-${file.name}`, type: checked.value, width: 640, height: 480, bytes: file.size, createdAt: 1 }, blob: file } };
  },
}));

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetConnection();
  URL.createObjectURL ??= () => "blob:test";
  URL.revokeObjectURL ??= () => {};
});
afterEach(cleanup);

const picture = (name: string, type = "image/jpeg") => new File([new Uint8Array([255, 216, 255, 1, 2, 3])], name, { type });

async function open() {
  render(<App />);
  await screen.findByRole("textbox", { name: "Document" });
}

async function choose(files: File[]) {
  await act(async () => {
    fireEvent.change(screen.getByLabelText("Choose pictures"), { target: { files } });
  });
}

describe("pictures and captions — integration", () => {
  it("pictures from the toolbar go in together with a description from the file name; SVG is refused and named", async () => {
    await open();
    await choose([picture("team-offsite.jpg"), picture("chart.png", "image/png"), picture("logo.svg", "image/svg+xml")]);
    await waitFor(() => expect(document.querySelectorAll(".ProseMirror figure")).toHaveLength(2));
    await waitFor(() => expect(document.querySelectorAll(".ProseMirror figure img")).toHaveLength(2));
    expect([...document.querySelectorAll(".ProseMirror figure img")].map((img) => img.getAttribute("alt"))).toEqual(["team offsite", "chart"]);
    const notice = screen.getByText(/2 pictures added/).textContent!;
    expect(notice).toMatch(/“logo\.svg” is in a format pictures can't use here/);
  });

  it("one undo takes back the whole batch", async () => {
    await open();
    const before = editorHtml();
    await choose([picture("a.jpg"), picture("b.jpg")]);
    await waitFor(() => expect(document.querySelectorAll(".ProseMirror figure")).toHaveLength(2));
    press("z", { ctrlKey: true });
    expect(editorHtml()).toBe(before);
  });

  it("edge case, a large document stays small: the saved JSON names pictures, it doesn't carry them", async () => {
    await open();
    const big = new File([new Uint8Array(300_000)], "photo.jpg", { type: "image/jpeg" });
    await choose([big]);
    const read = () =>
      new Promise<string>((resolve) => {
        const request = indexedDB.open("document-studio");
        request.onsuccess = () => {
          const all = request.result.transaction("documents").objectStore("documents").getAll();
          all.onsuccess = () => resolve(JSON.stringify(all.result[0] ?? null));
        };
      });
    let saved = "";
    await waitFor(
      async () => {
        saved = await read();
        expect(saved).toContain("figure");
      },
      { timeout: 3000 },
    );
    expect(saved).toContain('"assetId":"asset-photo.jpg"');
    expect(saved.length).toBeLessThan(2000);
  });

  it("a picture this device doesn't have says so instead of breaking the document", async () => {
    await putRaw({ ...newDocument("d", 5, "Shared"), body: { type: "doc", content: [figureBlock("gone", "Floor plan", "Ground floor")] } });
    resetConnection();
    await open();
    expect(await screen.findByText(/This picture isn't stored on this device — “Floor plan”/)).toBeTruthy();
    expect(screen.getByText("Ground floor")).toBeTruthy();
  });

  it("a pasted web page loses its remote images and says so", async () => {
    await open();
    const { paste } = await import("./helpers");
    paste({ html: '<p>Report</p><img src="https://tracker.example/pixel.gif">' });
    expect(editorHtml()).not.toContain("tracker.example");
    expect(screen.getByText(/removed images/)).toBeTruthy();
  });
});
