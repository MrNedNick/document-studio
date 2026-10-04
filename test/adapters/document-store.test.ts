import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { damagedCount, loadLatest, putRaw, resetConnection, saveDocument } from "../../src/adapters/document-store";
import { newDocument } from "../../src/domain/01-blocks";

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
});
