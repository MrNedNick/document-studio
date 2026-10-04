import { useMemo, useState } from "react";
import { wordCount } from "./domain/01-blocks";
import { checklistProgress } from "./domain/02-tables";
import { Skeleton } from "./components/skeleton/skeleton";
import { Editor, useDocument, type SaveState } from "./features/01-blocks";
import { HistoryPanel } from "./features/04-versions";
import { Outline } from "./features/05-search/Outline";
import { DocumentsPanel } from "./features/05-search/DocumentsPanel";
import type { Editor as TiptapEditor } from "@tiptap/react";
import { Button } from "./components/button/button";
import { ConfirmDialogProvider } from "./components/confirm-dialog/confirm-dialog";
import { ExportButton } from "./features/06-export/ExportButton";

const SAVE_TEXT: Record<SaveState, string> = {
  saved: "Saved on this device",
  saving: "Saving…",
  unsaved: "Not saved yet",
  unavailable: "Not saved — this browser blocks storage. Keep the tab open, or export the document.",
};

/** The page, with the confirm dialogs it may ask. */
export default function App() {
  return (
    <ConfirmDialogProvider>
      <Studio />
    </ConfirmDialogProvider>
  );
}

function Studio() {
  const { document, save, setAside, rename, edited, revisions, generation, saveVersion, restoreVersion, openDocument, createDocument, importDocument } = useDocument();
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editor, setEditor] = useState<TiptapEditor | null>(null);
  const words = useMemo(() => (document ? wordCount(document) : 0), [document]);
  const tasks = useMemo(() => (document ? checklistProgress(document.body) : { done: 0, total: 0 }), [document]);
  const [notice, setNotice] = useState("");

  return (
    <div className="min-h-screen bg-surface-raised text-text">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-4 py-3 xl:max-w-6xl">
          <span className="font-semibold tracking-tight">Document Studio</span>
          <span className="ml-auto text-xs text-text-muted" role="status" aria-live="polite">
            {document ? SAVE_TEXT[save] : ""}
          </span>
          <Button size="sm" variant="outline" disabled={!document} onClick={() => setDocumentsOpen(true)}>
            Documents
          </Button>
          <Button size="sm" variant="outline" disabled={!document} onClick={() => setHistoryOpen(true)}>
            History{revisions.length ? ` (${revisions.length})` : ""}
          </Button>
          <ExportButton disabled={!document || !editor} readDocument={() => document && editor ? { ...document, body: editor.getJSON() as typeof document.body } : null} />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 xl:grid xl:max-w-6xl xl:grid-cols-[14rem_minmax(0,48rem)] xl:justify-center xl:gap-8">
        <aside className="hidden xl:block">
          <div className="sticky top-6">{editor && <Outline editor={editor} variant="side" />}</div>
        </aside>
        <div className="min-w-0">
        {setAside > 0 && (
          <p role="alert" className="mb-4 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
            {setAside === 1 ? "A saved document" : `${setAside} saved documents`} couldn't be read and {setAside === 1 ? "was" : "were"} set aside
            instead of opened — nothing was deleted.
          </p>
        )}
        {!document ? (
          <div aria-busy="true" aria-label="Opening your document" className="space-y-3">
            <Skeleton className="h-9 w-2/3" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <>
            <label className="sr-only" htmlFor="title">
              Title
            </label>
            <input
              id="title"
              value={document.title}
              onChange={(event) => rename(event.target.value)}
              placeholder="Untitled document"
              className="mb-4 w-full bg-transparent text-3xl font-semibold tracking-tight outline-none placeholder:text-text-muted"
            />
            {editor && (
              <div className="xl:hidden">
                <Outline editor={editor} variant="fold" />
              </div>
            )}
            <Editor key={`${document.id}:${generation}`} body={document.body} onChange={edited} onNotice={setNotice} onReady={setEditor} />
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-text-muted">
              <span>
                {words} {words === 1 ? "word" : "words"}
              </span>
              {tasks.total > 0 && (
                <span>
                  Checklist: {tasks.done} of {tasks.total} done
                </span>
              )}
              <span>Paste and match style (⇧ with paste) brings plain text only.</span>
            </div>
            {notice && (
              <p role="status" className="mt-3 text-sm text-text-muted">
                {notice}
              </p>
            )}
          </>
        )}
        </div>
      </main>
      <DocumentsPanel
        open={documentsOpen}
        onClose={() => setDocumentsOpen(false)}
        currentId={document?.id ?? null}
        onOpen={(id) => void openDocument(id)}
        onCreate={() => void createDocument()}
        onImport={importDocument}
      />
      <HistoryPanel open={historyOpen} onClose={() => setHistoryOpen(false)} revisions={revisions} onSave={saveVersion} onRestore={restoreVersion} />
    </div>
  );
}
