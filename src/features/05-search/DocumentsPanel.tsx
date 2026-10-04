import { useEffect, useId, useMemo, useState } from "react";
import { listDocuments } from "../../adapters/document-store";
import type { Document } from "../../domain/01-blocks";
import { searchDocuments } from "../../domain/05-search";
import { Button } from "../../components/button/button";
import { Modal } from "../../components/modal/modal";
import { cn } from "../../lib/cn";

interface Props {
  open: boolean;
  onClose: () => void;
  currentId: string | null;
  onOpen: (id: string) => void;
  onCreate: () => void;
}

const when = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** All documents on this device, searchable by title and text, with a new one a click away. */
export function DocumentsPanel({ open, onClose, currentId, onOpen, onCreate }: Props) {
  const [documents, setDocuments] = useState<Document[] | null>(null);
  const [query, setQuery] = useState("");
  const searchId = useId();

  // Read fresh each time the list opens: other tabs may have written since.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    void listDocuments().then((found) => alive && setDocuments(found));
    return () => {
      alive = false;
    };
  }, [open]);

  const hits = useMemo(() => (documents ? searchDocuments(documents, query) : null), [documents, query]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Documents"
      size="md"
      actions={
        <Button
          onClick={() => {
            onCreate();
            onClose();
          }}
        >
          New document
        </Button>
      }
    >
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
          {hits.value.map((hit) => (
            <li key={hit.id}>
              <button
                type="button"
                aria-current={hit.id === currentId ? "page" : undefined}
                onClick={() => {
                  onOpen(hit.id);
                  onClose();
                }}
                className={cn("w-full rounded-md px-3 py-2 text-left hover:bg-surface-raised", hit.id === currentId && "bg-accent/5")}
              >
                <span className="flex items-baseline gap-2">
                  <span className="truncate font-medium">{hit.title || "Untitled document"}</span>
                  <span className="ml-auto shrink-0 text-xs text-text-muted">{when.format(hit.updatedAt)}</span>
                </span>
                <span className="mt-0.5 block truncate text-xs text-text-muted">
                  {query.trim() && hit.matches ? `${hit.matches} ${hit.matches === 1 ? "match" : "matches"} · ` : ""}
                  {hit.snippet || "Empty"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
