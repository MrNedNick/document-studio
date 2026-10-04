import { IDBFactory } from "fake-indexeddb";
import { beforeEach, expect, it } from "vitest";
import { loadAsset, resetConnection, saveAsset } from "../../src/adapters/document-store";

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetConnection();
});

it("stores a picture's bytes by id and gives them back; an unknown id is null", async () => {
  const asset = { id: "a1", type: "image/png" as const, width: 2, height: 1, bytes: 3, createdAt: 1 };
  expect(await saveAsset(asset, new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }))).toEqual({ ok: true, value: asset });
  const stored = await loadAsset("a1");
  expect(stored?.asset).toEqual(asset);
  expect(new Uint8Array(await stored!.blob.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  expect(await loadAsset("nope")).toBeNull();
});
