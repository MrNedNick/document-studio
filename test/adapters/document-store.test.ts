import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { damagedCount, deleteDocument, listDocuments, listRevisions, loadAsset, loadLatest, putRaw, renameDocument, resetConnection, saveAsset, saveDocument, writeRevisions } from "../../src/adapters/document-store";
import { figureBlock } from "../../src/domain/03-images";
import { newDocument, type Document } from "../../src/domain/01-blocks";

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetConnection();
});

describe("document store", () => {
  it("starts empty, then gives back the latest saved document", async () => {
    expect(await loadLatest()).toEqual({ ok: true, value: { document: null, setAside: 0 } });
    await saveDocument(newDocument("old", 1, "Old"));
    await saveDocument(newDocument("new", 2, "New"));
    expect(await loadLatest()).toMatchObject({ ok: true, value: { document: { id: "new", title: "New" }, setAside: 0 } });
  });

  it("edge case, a damaged record is set aside, not lost, and the next good one opens", async () => {
    await saveDocument(newDocument("good", 1, "Good"));
    await putRaw({ id: "bad", schemaVersion: 1, updatedAt: 5, body: { type: "doc", content: [{ type: "marquee" }] } });
    expect(await loadLatest()).toMatchObject({ ok: true, value: { document: { id: "good" }, setAside: 1 } });
    expect(await damagedCount()).toBe(1);
    expect(await loadLatest()).toMatchObject({ ok: true, value: { setAside: 0 } });
  });

  it("a browser without storage is an error the page can explain, not a crash", async () => {
    // @ts-expect-error — simulating a browser that has no IndexedDB at all
    globalThis.indexedDB = undefined;
    resetConnection();
    expect(await loadLatest()).toEqual({ ok: false, error: { kind: "store", reason: "unavailable" } });
    expect(await saveDocument(newDocument("x", 1))).toEqual({ ok: false, error: { kind: "store", reason: "unavailable" } });
  });

  it("deleting a document takes its history and the pictures only it shows, and keeps pictures others still use", async () => {
    const withPictures = (id: string, ...assets: string[]): Document => ({ ...newDocument(id, 1, id), body: { type: "doc", content: assets.map((asset) => figureBlock(asset)) } });
    const asset = (id: string) => saveAsset({ id, type: "image/png", width: 1, height: 1, bytes: 1, createdAt: 1 }, new Blob(["x"], { type: "image/png" }));
    await asset("only-mine");
    await asset("shared");
    await asset("in-my-history");
    await saveDocument(withPictures("mine", "only-mine", "shared"));
    await saveDocument(withPictures("other", "shared"));
    await writeRevisions([
      { id: "r1", documentId: "mine", createdAt: 1, reason: "auto", title: "", words: 0, body: withPictures("x", "in-my-history").body },
      { id: "r2", documentId: "other", createdAt: 1, reason: "auto", title: "", words: 0, body: withPictures("x").body },
    ]);

    expect(await deleteDocument("mine")).toBe(true);
    expect((await listDocuments()).map((document) => document.id)).toEqual(["other"]);
    expect(await listRevisions("mine")).toEqual([]);
    expect(await listRevisions("other")).toHaveLength(1);
    expect(await loadAsset("only-mine")).toBeNull();
    expect(await loadAsset("in-my-history")).toBeNull();
    expect(await loadAsset("shared")).not.toBeNull();
  });

  it("renames a stored document and says when there is nothing to rename", async () => {
    await saveDocument(newDocument("a", 1, "Draft"));
    expect(await renameDocument("a", "Final")).toBe(true);
    expect((await listDocuments())[0]).toMatchObject({ id: "a", title: "Final" });
    expect(await renameDocument("missing", "x")).toBe(false);
  });
});
