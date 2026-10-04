import { generateHTML } from "@tiptap/core";
import { useMemo, useState, type FormEvent } from "react";
import { wordChange, type Revision, type VersionsError } from "../../domain/04-versions";
import { Button } from "../../components/button/button";
import { Modal } from "../../components/modal/modal";
import { useConfirm } from "../../components/confirm-dialog/confirm-dialog";
import { cn } from "../../lib/cn";
import { documentExtensions } from "../01-blocks/extensions";
import { describeVersionsError, reasonLabel } from "./messages";

interface Props {
  open: boolean;
  onClose: () => void;
  revisions: Revision[];
  onSave: (name?: string) => Promise<VersionsError | null>;
  onRestore: (id: string) => Promise<VersionsError | null>;
}

const day = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" });
const time = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

/**
 * The document's history: versions by day, newest first, a read-only preview of the one picked, and
 * "Restore". Restoring keeps the current text as a version first, so it can always be walked back.
 */
export function HistoryPanel({ open, onClose, revisions, onSave, onRestore }: Props) {
  const confirm = useConfirm();
  const [picked, setPicked] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const newestFirst = useMemo(() => [...revisions].reverse(), [revisions]);
  const current = newestFirst.find((revision) => revision.id === picked) ?? newestFirst[0] ?? null;
  const preview = useMemo(() => {
    if (!current) return "";
    try {
      return generateHTML(current.body, documentExtensions);
    } catch {
      return "<p><em>This version can't be shown.</em></p>";
    }
  }, [current]);

  const groups = useMemo(() => {
    const byDay = new Map<string, Revision[]>();
    for (const revision of newestFirst) {
      const key = day.format(revision.createdAt);
      byDay.set(key, [...(byDay.get(key) ?? []), revision]);
    }
    return [...byDay];
  }, [newestFirst]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const error = await onSave(name);
    setMessage(error ? describeVersionsError(error) : "Version saved.");
    if (!error) setName("");
  };

  const restoreCurrent = async () => {
    if (!current) return;
    const yes = await confirm({
      title: "Restore this version?",
      description: "The document goes back to this text. What you have now is kept in the history first, so you can come back to it.",
      confirmLabel: "Restore",
    });
    if (!yes) return;
    const error = await onRestore(current.id);
    setMessage(error ? describeVersionsError(error) : `Restored the version from ${time.format(current.createdAt)}.`);
    if (!error) setPicked(null);
  };

  const previous = (revision: Revision) => revisions[revisions.indexOf(revision) - 1];

  return (
    <Modal open={open} onClose={onClose} title="History" size="lg">
      <form onSubmit={(event) => void save(event)} className="mb-4 flex flex-wrap items-center gap-2">
        <label htmlFor="version-name" className="sr-only">
          Version name
        </label>
        <input
          id="version-name"
          value={name}
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
          placeholder="Name this version (optional)"
          className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm"
        />
        <Button size="sm" type="submit">
          Save a version
        </Button>
      </form>
      {message && (
        <p role="status" className="mb-3 text-sm text-text-muted">
          {message}
        </p>
      )}
      {!revisions.length ? (
        <p className="text-sm text-text-muted">No versions yet. One is kept automatically every few minutes while you write, or save one now.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
          <ol aria-label="Versions" className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
            {groups.map(([label, items]) => (
              <li key={label}>
                <p className="mb-1 text-xs font-semibold text-text-muted">{label}</p>
                <ul className="space-y-1">
                  {items.map((revision) => (
                    <li key={revision.id}>
                      <button
                        type="button"
                        aria-pressed={revision.id === current?.id}
                        onClick={() => {
                          setPicked(revision.id);
                          setMessage("");
                        }}
                        className={cn(
                          "w-full rounded-md border border-transparent px-2 py-1.5 text-left text-sm hover:bg-surface-raised",
                          revision.id === current?.id && "border-accent bg-accent/5",
                        )}
                      >
                        <span className="font-medium">{time.format(revision.createdAt)}</span>{" "}
                        <span className="text-text-muted">· {reasonLabel(revision)}</span>
                        <span className="block text-xs text-text-muted">{wordChange(revision, previous(revision))}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
          {current && (
            <section aria-label="Preview" className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <p className="mr-auto text-sm text-text-muted">
                  {current.title || "Untitled document"} · {day.format(current.createdAt)}, {time.format(current.createdAt)}
                </p>
                <Button size="sm" variant="outline" onClick={() => void restoreCurrent()}>
                  Restore this version
                </Button>
              </div>
              <div className="prose-doc prose-preview max-h-[50vh] overflow-y-auto rounded-md border border-border" dangerouslySetInnerHTML={{ __html: preview }} />
            </section>
          )}
        </div>
      )}
    </Modal>
  );
}
