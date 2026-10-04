import { readDocument, type Document } from "../domain/01-blocks";
import type { Asset } from "../domain/03-images";
import type { Revision } from "../domain/04-versions";
import { err, ok, type Result } from "../domain/result";

const DB_NAME = "document-studio";
const DB_VERSION = 3;
const DOCUMENTS = "documents";
/** Records that no longer read are moved here, never deleted: the text may still be recovered by hand. */
const DAMAGED = "damaged";
/** Pictures, by id, with their bytes: documents only name them, so a long illustrated document stays small. */
const ASSETS = "assets";
/** Earlier versions of documents, found by the document they belong to. */
const REVISIONS = "revisions";

export type StoreError = { kind: "store"; reason: "unavailable" };

const request = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

let opening: Promise<IDBDatabase> | null = null;

/** Opens the database once per page. Private windows in some browsers refuse: that is an error, not a crash. */
export function openDatabase(factory: IDBFactory | undefined = globalThis.indexedDB): Promise<IDBDatabase> {
  if (!factory) return Promise.reject(new Error("IndexedDB is not available"));
  opening ??= new Promise((resolve, reject) => {
    const req = factory.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DOCUMENTS)) db.createObjectStore(DOCUMENTS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(DAMAGED)) db.createObjectStore(DAMAGED, { autoIncrement: true });
      // Version 2: pictures. Opening a version 1 database adds the store and keeps every document.
      if (!db.objectStoreNames.contains(ASSETS)) db.createObjectStore(ASSETS, { keyPath: "id" });
      // Version 3: history.
      if (!db.objectStoreNames.contains(REVISIONS)) db.createObjectStore(REVISIONS, { keyPath: "id" }).createIndex("documentId", "documentId");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      opening = null;
      reject(req.error);
    };
  });
  return opening;
}

/** For tests: forget the open connection so the next call opens a fresh database. */
export function resetConnection() {
  opening = null;
}

export interface Loaded {
  /** The most recently saved document that reads, or null when there is none yet. */
  document: Document | null;
  /** How many saved records didn't read and were set aside. */
  setAside: number;
}

/**
 * The document to open: the latest one that reads. Records that don't (a newer editor, a damaged
 * entry) are moved to the "damaged" store with their raw contents and reported, so the page can say so.
 */
export async function loadLatest(): Promise<Result<Loaded, StoreError>> {
  let db: IDBDatabase;
  try {
    db = await openDatabase();
  } catch {
    return err({ kind: "store", reason: "unavailable" });
  }
  const all = await request(db.transaction(DOCUMENTS).objectStore(DOCUMENTS).getAll());
  const good: Document[] = [];
  const bad: unknown[] = [];
  for (const record of all) {
    const read = readDocument(record);
    if (read.ok) good.push(read.value);
    else bad.push(record);
  }
  if (bad.length) {
    const move = db.transaction([DOCUMENTS, DAMAGED], "readwrite");
    for (const record of bad) {
      move.objectStore(DAMAGED).add({ record, setAsideAt: Date.now() });
      const id = (record as { id?: unknown })?.id;
      if (typeof id === "string") move.objectStore(DOCUMENTS).delete(id);
    }
    await new Promise((resolve) => (move.oncomplete = resolve));
  }
  good.sort((a, b) => b.updatedAt - a.updatedAt);
  return ok({ document: good[0] ?? null, setAside: bad.length });
}

export async function saveDocument(document: Document): Promise<Result<Document, StoreError>> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(DOCUMENTS, "readwrite");
    tx.objectStore(DOCUMENTS).put(document);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    return ok(document);
  } catch {
    // Quota exceeded, storage blocked: the text stays on screen; the page says it isn't saved.
    return err({ kind: "store", reason: "unavailable" });
  }
}

/** Puts a raw record straight into the documents store — for tests and for reading files later. */
export async function putRaw(record: unknown): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(DOCUMENTS, "readwrite");
  tx.objectStore(DOCUMENTS).put(record);
  await new Promise((resolve) => (tx.oncomplete = resolve));
}

export async function damagedCount(): Promise<number> {
  const db = await openDatabase();
  return request(db.transaction(DAMAGED).objectStore(DAMAGED).count());
}

export interface StoredAsset {
  asset: Asset;
  blob: Blob;
}

/** Bytes are stored as an ArrayBuffer, not a Blob: every browser (and test runtime) clones those the same way. */
export async function saveAsset(asset: Asset, blob: Blob): Promise<Result<Asset, StoreError>> {
  try {
    const data = await blob.arrayBuffer();
    const db = await openDatabase();
    const tx = db.transaction(ASSETS, "readwrite");
    tx.objectStore(ASSETS).put({ ...asset, data });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    return ok(asset);
  } catch {
    return err({ kind: "store", reason: "unavailable" });
  }
}

/** A stored picture, or null when this device doesn't have it (a document from elsewhere, cleared storage). */
export async function loadAsset(id: string): Promise<StoredAsset | null> {
  try {
    const db = await openDatabase();
    const record = await request(db.transaction(ASSETS).objectStore(ASSETS).get(id));
    // Checked by tag, not instanceof: a buffer cloned out of IndexedDB may come from another realm.
    const isBytes = (value: unknown) => Object.prototype.toString.call(value) === "[object ArrayBuffer]" || ArrayBuffer.isView(value);
    if (!record || !isBytes(record.data)) return null;
    const { data, ...asset } = record as Asset & { data: ArrayBuffer };
    return { asset, blob: new Blob([data], { type: asset.type }) };
  } catch {
    return null;
  }
}

/** A document's versions, oldest first. */
export async function listRevisions(documentId: string): Promise<Revision[]> {
  try {
    const db = await openDatabase();
    const all = await request(db.transaction(REVISIONS).objectStore(REVISIONS).index("documentId").getAll(documentId));
    return (all as Revision[]).sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

/** Adds versions and removes others in one transaction, so history is never half-written. */
export async function writeRevisions(add: Revision[], remove: string[] = []): Promise<boolean> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(REVISIONS, "readwrite");
    const store = tx.objectStore(REVISIONS);
    add.forEach((revision) => store.put(revision));
    remove.forEach((id) => store.delete(id));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    return true;
  } catch {
    return false;
  }
}

/** Every document that reads, newest first — for the list of documents. */
export async function listDocuments(): Promise<Document[]> {
  try {
    const db = await openDatabase();
    const all = await request(db.transaction(DOCUMENTS).objectStore(DOCUMENTS).getAll());
    return all.flatMap((record) => {
      const read = readDocument(record);
      return read.ok ? [read.value] : [];
    }).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}
