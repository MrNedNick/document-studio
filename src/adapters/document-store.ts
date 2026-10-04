import { readDocument, type Document } from "../domain/01-blocks";
import { err, ok, type Result } from "../domain/result";

const DB_NAME = "document-studio";
const DB_VERSION = 1;
const DOCUMENTS = "documents";
/** Records that no longer read are moved here, never deleted: the text may still be recovered by hand. */
const DAMAGED = "damaged";

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
