import { useState } from "react";
import type { Document } from "../../domain/01-blocks";
import { exportFileName } from "../../domain/06-export";
import { documentBundle, documentHtml, downloadDocumentFile, printDocumentPage } from "../../adapters/document-files";
import { Button } from "../../components/button/button";
import { Modal } from "../../components/modal/modal";

export function ExportButton({ readDocument, disabled }: { readDocument: () => Document | null; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const run = async (format: "html" | "json" | "print") => {
    const document = readDocument();
    if (!document) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (format === "json") {
        downloadDocumentFile(JSON.stringify(await documentBundle(document), null, 2), exportFileName(document.title, "json"), "application/json");
        setNotice("Document file saved with its pictures. Import it on another device to keep writing.");
      } else {
        const page = await documentHtml(document);
        if (format === "print") await printDocumentPage(page.html);
        else downloadDocumentFile(page.html, exportFileName(document.title, "html"), "text/html");
        setNotice(page.missing.length ? `${page.missing.length} missing pictures are shown as notes. Their bytes aren't on this device.` : format === "print" ? "Choose Save as PDF or a printer in your browser's print dialog." : "Web page saved with its pictures. It opens without a network connection.");
      }
    } catch (error) { setError(error instanceof Error ? error.message : "Export failed. Your document is still here; try again."); }
    finally { setBusy(false); }
  };
  return <>
    <Button size="sm" variant="outline" disabled={disabled} onClick={() => { setOpen(true); setError(""); setNotice(""); }}>Export</Button>
    <Modal open={open} onClose={() => setOpen(false)} title="Export document" size="sm" actions={<Button variant="outline" onClick={() => setOpen(false)}>Close</Button>}>
      <p className="mb-4 text-text-muted">Keep a copy to read, print or continue writing on another device.</p>
      <div className="flex flex-col gap-2" aria-busy={busy}>
        <Button variant="outline" disabled={busy} onClick={() => void run("html")}>Web page (HTML)</Button>
        <Button variant="outline" disabled={busy} onClick={() => void run("print")}>Print or save as PDF</Button>
        <Button variant="outline" disabled={busy} onClick={() => void run("json")}>Document file (.json)</Button>
      </div>
      {busy && <p role="status" className="mt-3 text-text-muted">Preparing your document…</p>}
      {notice && <p role="status" className="mt-3 text-text-muted">{notice}</p>}
      {error && <p role="alert" className="mt-3 text-danger">{error}</p>}
    </Modal>
  </>;
}
