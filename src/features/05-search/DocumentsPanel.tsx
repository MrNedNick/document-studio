import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { listDocuments } from "../../adapters/document-store";
import type { Document } from "../../domain/01-blocks";
import { searchDocuments } from "../../domain/05-search";
import { Button } from "../../components/button/button";
import { Modal } from "../../components/modal/modal";
import { useConfirm } from "../../components/confirm-dialog/confirm-dialog";
import { cn } from "../../lib/cn";
import { ImportButton } from "../06-export/ImportButton";

interface Props {
  open: boolean;
  onClose: () => void;
  currentId: string | null;
  onOpen: (id: string) => void;
  onCreate: () => void;
  onImport: (text: string) => Promise<void>;
  onRename: (id: string, title: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

const when = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** All documents on this device, searchable by title and text, with a new one a click away. */
export function DocumentsPanel({ open, onClose, currentId, onOpen, onCreate, onImport, onRename, onDelete }: Props) {
  const [documents, setDocuments] = useState<Document[] | null>(null);
  const [query, setQuery] = useState("");
  const searchId = useId();

  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const [problem, setProblem] = useState("");
  const confirm = useConfirm();

  const reload = useCallback(() => listDocuments().then(setDocuments), []);

  // Read fresh each time the list opens: other tabs may have written since.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    void listDocuments().then((found) => alive && setDocuments(found));
    return () => {
      alive = false;
    };
  }, [open]);

  /** Closing drops a half-typed rename and an old error, so the list opens clean next time. */
  function close() {
    setRenaming(null);
    setProblem("");
    onClose();
  }

  async function saveTitle() {
    if (!renaming) return;
    const done = await onRename(renaming.id, renaming.title.trim());
    setProblem(done ? "" : "Couldn't rename it — this browser isn't saving right now.");
    setRenaming(null);
    await reload();
  }

  async function remove(id: string, title: string) {
    const name = title || "Untitled document";
    const sure = await confirm({
      title: `Delete “${name}”?`,
      description: "Its history and the pictures only it uses go too. This can't be undone — export it first to keep a copy.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!sure) return;
    const done = await onDelete(id);
    setProblem(done ? "" : "Couldn't delete it — this browser isn't saving right now.");
    await reload();
  }

  const hits = useMemo(() => (documents ? searchDocuments(documents, query) : null), [documents, query]);

  return (
    <Modal
      open={open}
      onClose={close}
      title="Documents"
      size="md"
      actions={
        <Button
          onClick={() => {
            onCreate();
            close();
          }}
        >
          New document
        </Button>
      }
    >
      <ImportButton onImport={onImport} onClose={close} />
      <label htmlFor={searchId} className="sr-only">
        Search documents
      </label>
      <input
        id={searchId}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search titles and text"
        className="mb-3 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
      />
      {problem && (
        <p role="alert" className="mb-3 text-sm text-danger">
          {problem}
        </p>
      )}
      {!hits ? (
        <p className="text-sm text-text-muted" role="status">
          Reading documents…
        </p>
      ) : !hits.ok ? (
        <p role="alert" className="text-sm text-danger">
          That's too long to search for — up to 200 characters.
        </p>
      ) : !hits.value.length ? (
        <p className="text-sm text-text-muted" role="status">
          {query.trim() ? `No document mentions “${query.trim()}”.` : "No documents yet."}
        </p>
      ) : (
        <ul aria-label="Documents" className="max-h-[55vh] space-y-1 overflow-y-auto">
          {hits.value.map((hit) => {
            const name = hit.title || "Untitled document";
            if (renaming?.id === hit.id)
              return (
                <li key={hit.id}>
                  <form
                    className="flex items-center gap-2 px-1 py-1"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void saveTitle();
                    }}
                  >
                    <input
                      autoFocus
                      // Selected on open, so typing replaces the old title the way a file rename does.
                      onFocus={(event) => event.currentTarget.select()}
                      aria-label={`New title for “${name}”`}
                      value={renaming.title}
                      onChange={(event) => setRenaming({ id: hit.id, title: event.target.value })}
                      onKeyDown={(event) => {
                        // Escape cancels the rename, not the whole list.
                        if (event.key === "Escape") {
                          event.preventDefault();
                          event.stopPropagation();
                          setRenaming(null);
                        }
                      }}
                      placeholder="Untitled document"
                      className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm"
                    />
                    <Button size="sm" type="submit">
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setRenaming(null)}>
                      Cancel
                    </Button>
                  </form>
                </li>
              );
            return (
              <li key={hit.id} className={cn("group flex items-center rounded-md hover:bg-surface-raised", hit.id === currentId && "bg-accent/5")}>
                <button
                  type="button"
                  aria-current={hit.id === currentId ? "page" : undefined}
                  onClick={() => {
                    onOpen(hit.id);
                    close();
                  }}
                  className="min-w-0 flex-1 rounded-md px-3 py-2 text-left"
                >
                  <span className="flex items-baseline gap-2">
                    <span className="truncate font-medium">{name}</span>
                    <span className="ml-auto shrink-0 text-xs text-text-muted">{when.format(hit.updatedAt)}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-text-muted">
                    {query.trim() && hit.matches ? `${hit.matches} ${hit.matches === 1 ? "match" : "matches"} · ` : ""}
                    {hit.snippet || "Empty"}
                  </span>
                </button>
                <span className="flex shrink-0 gap-1 pr-1">
                  <Button size="sm" variant="ghost" className="px-2" aria-label={`Rename “${name}”`} title="Rename" onClick={() => setRenaming({ id: hit.id, title: hit.title })}>
                    <PencilIcon />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-2 text-text-muted hover:text-danger"
                    aria-label={`Delete “${name}”`}
                    title="Delete"
                    onClick={() => void remove(hit.id, hit.title)}
                  >
                    <TrashIcon />
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}

const ICON = { "aria-hidden": true, width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function PencilIcon() {
  return (
    <svg {...ICON}>
      <path d="M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg {...ICON}>
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
    </svg>
  );
}
