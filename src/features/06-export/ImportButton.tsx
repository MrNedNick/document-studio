import { useRef, useState } from "react";
import { Button } from "../../components/button/button";

export function ImportButton({ onImport, onClose }: { onImport: (text: string) => Promise<void>; onClose: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const open = async (file: File) => {
    setBusy(true);
    setError("");
    try { await onImport(await file.text()); onClose(); }
    catch (error) { setError(error instanceof Error ? error.message : "Import failed. Your existing documents are unchanged."); }
    finally { setBusy(false); }
  };
  return <div className="mb-4">
    <Button size="sm" variant="outline" loading={busy} onClick={() => input.current?.click()}>Import…</Button>
    <input ref={input} type="file" accept=".json,application/json" aria-label="Import document file" className="sr-only" tabIndex={-1} disabled={busy} onChange={(event) => {
      const file = event.target.files?.[0]; event.target.value = ""; if (file) void open(file);
    }} />
    <p className="mt-2 text-xs text-text-muted">Opens an exported document file as a new copy. Existing documents stay intact.</p>
    {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
  </div>;
}
