import { useCallback, useEffect, useRef, useState } from "react";
import { loadLatest, saveDocument } from "../../adapters/document-store";
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
      setDocument(loaded.value.document ?? newDocument(newId(), Date.now()));
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
  }, []);

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

  return { document, save, setAside, rename, edited, flush };
}
