import { useCallback, useEffect, useRef, useState } from "react";
import { listRevisions, loadLatest, saveDocument, writeRevisions } from "../../adapters/document-store";
import { makeRevision, pruneRevisions, restore, shouldSnapshot, type Revision, type VersionsError } from "../../domain/04-versions";
import { newDocument, type Document } from "../../domain/01-blocks";

export type SaveState = "saved" | "saving" | "unsaved" | "unavailable";

const newId = () => (globalThis.crypto && "randomUUID" in globalThis.crypto ? globalThis.crypto.randomUUID() : `doc-${Date.now()}`);

/**
 * The open document: loaded from IndexedDB on start, saved shortly after every change. When storage is
 * unavailable the editor still works and says the text won't be kept.
 */
export function useDocument(delay = 400) {
  const [document, setDocument] = useState<Document | null>(null);
  const [save, setSave] = useState<SaveState>("saved");
  const [setAside, setSetAside] = useState(0);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const history = useRef<Revision[]>([]);
  /** Bumped when the text is replaced from outside the editor (a restore), so the editor reloads it. */
  const [generation, setGeneration] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<Document | null>(null);
  /** Reads the editor's content; called once per save, not once per keystroke. */
  const readBody = useRef<(() => Document["body"]) | null>(null);

  useEffect(() => {
    let alive = true;
    void loadLatest().then((loaded) => {
      if (!alive) return;
      if (!loaded.ok) {
        setSave("unavailable");
        setDocument(newDocument(newId(), Date.now()));
        return;
      }
      setSetAside(loaded.value.setAside);
      const opened = loaded.value.document ?? newDocument(newId(), Date.now());
      setDocument(opened);
      latest.current = opened;
      void listRevisions(opened.id).then((found) => {
        if (!alive) return;
        history.current = found;
        setRevisions(found);
      });
    });
    return () => {
      alive = false;
    };
  }, []);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!latest.current) return;
    if (readBody.current) {
      latest.current = { ...latest.current, body: readBody.current(), updatedAt: Date.now() };
      readBody.current = null;
      setDocument(latest.current);
    }
    const saved = await saveDocument(latest.current);
    setSave(saved.ok ? "saved" : "unavailable");
    if (!saved.ok) return;
    // An automatic version now and then while writing, thinned out as it ages.
    const now = Date.now();
    if (shouldSnapshot(history.current, latest.current, now)) {
      const made = makeRevision(latest.current, "auto", newId(), now);
      if (made.ok) await keepHistory([made.value], now);
    }
  }, []);

  /** Writes new versions and drops the ones that have aged out, in one go. */
  async function keepHistory(add: Revision[], now: number) {
    const { keep, drop } = pruneRevisions([...history.current, ...add], now);
    if (await writeRevisions(add, drop.map((revision) => revision.id))) {
      history.current = keep.sort((a, b) => a.createdAt - b.createdAt);
      setRevisions(history.current);
    }
  }

  /** A version saved on purpose, with an optional name; kept however old it gets. */
  const saveVersion = useCallback(
    async (name?: string): Promise<VersionsError | null> => {
      await flush();
      if (!latest.current) return null;
      const now = Date.now();
      const made = makeRevision(latest.current, "manual", newId(), now, name);
      if (!made.ok) return made.error;
      await keepHistory([made.value], now);
      return null;
    },
    [flush],
  );

  /** Puts a version's text back; the current text becomes a version first, so this can be undone too. */
  const restoreVersion = useCallback(
    async (revisionId: string): Promise<VersionsError | null> => {
      await flush();
      if (!latest.current) return null;
      const now = Date.now();
      const restored = restore(latest.current, history.current, revisionId, newId(), now);
      if (!restored.ok) return restored.error;
      await keepHistory([restored.value.safety], now);
      latest.current = restored.value.document;
      setDocument(restored.value.document);
      setGeneration((n) => n + 1);
      const saved = await saveDocument(restored.value.document);
      setSave(saved.ok ? "saved" : "unavailable");
      return null;
    },
    [flush],
  );

  const schedule = useCallback(() => {
    setSave((state) => (state === "unavailable" ? state : "saving"));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), delay);
  }, [delay, flush]);

  /** A new title: cheap, applied at once; written after a short pause like everything else. */
  const rename = useCallback(
    (title: string) => {
      setDocument((current) => {
        if (!current) return current;
        const next = { ...current, title, updatedAt: Date.now() };
        latest.current = next;
        return next;
      });
      schedule();
    },
    [schedule],
  );

  /**
   * The text changed. Turning a long document into JSON costs more than a keystroke may, so it happens
   * once, when typing pauses and the document is saved — not on every key.
   */
  const edited = useCallback(
    (read: () => Document["body"]) => {
      readBody.current = read;
      if (!latest.current) setDocument((current) => (latest.current = current));
      schedule();
    },
    [schedule],
  );

  // A pending save is written before the tab goes away, and before the editor itself does — not by a
  // timer that fires after it is gone.
  useEffect(() => {
    const onHide = () => {
      if (timer.current) void flush();
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      if (timer.current) void flush();
    };
  }, [flush]);

  return { document, save, setAside, rename, edited, flush, revisions, generation, saveVersion, restoreVersion };
}
