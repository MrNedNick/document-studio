import { useEditorState, type Editor } from "@tiptap/react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { checkQuery } from "../../domain/05-search";
import { replaceMatches, reveal, searchKey } from "./search-extension";

/**
 * Find and replace inside the document. Enter goes to the next match, Shift+Enter to the previous one,
 * Escape closes. "Replace all" is one step: one undo puts every match back.
 */
export function FindBar({ editor, focusSignal, onClose }: { editor: Editor; focusSignal: number; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [message, setMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const ids = { find: useId(), replace: useId() };
  const { count, current } = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const state = searchKey.getState(e.state);
      return { count: state?.matches.length ?? 0, current: state?.current ?? -1 };
    },
  });

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, [focusSignal]);

  useEffect(() => {
    return () => {
      // Closing removes the highlights.
      editor.view.dispatch(editor.state.tr.setMeta(searchKey, { clear: true }));
    };
  }, [editor]);

  const search = (next: string, nextCase = matchCase) => {
    setQuery(next);
    setMessage("");
    const checked = checkQuery(next);
    if (!checked.ok) return setMessage("That's too long to search for — up to 200 characters.");
    editor.view.dispatch(editor.state.tr.setMeta(searchKey, { query: next, matchCase: nextCase }));
    reveal(editor.state, editor.view.dispatch);
  };

  const step = (move: 1 | -1) => {
    editor.view.dispatch(editor.state.tr.setMeta(searchKey, { move }));
    reveal(editor.state, editor.view.dispatch);
  };

  const replace = (all: boolean) => {
    const done = replaceMatches(editor.state, editor.view.dispatch, replacement, all);
    if (done) setMessage(all ? `Replaced ${done} ${done === 1 ? "match" : "matches"}.` : "Replaced.");
    if (!all) reveal(editor.state, editor.view.dispatch);
  };

  const keys = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      editor.commands.focus();
    } else if (event.key === "Enter") {
      event.preventDefault();
      step(event.shiftKey ? -1 : 1);
    }
  };

  const status = !query ? "" : count ? `${current + 1} of ${count}` : "No matches";
  return (
    <div role="search" aria-label="Find in document" className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-raised px-2 py-1.5 text-sm" onKeyDown={keys}>
      <label htmlFor={ids.find} className="sr-only">
        Find
      </label>
      <input
        ref={input}
        id={ids.find}
        value={query}
        onChange={(event) => search(event.target.value)}
        placeholder="Find"
        className="min-w-0 flex-1 basis-full rounded-sm border border-border bg-surface px-2 py-1 sm:basis-40"
      />
      <span aria-live="polite" className="min-w-16 text-xs text-text-muted tabular-nums">
        {status}
      </span>
      <button type="button" aria-label="Previous match" disabled={!count} onClick={() => step(-1)} className="rounded-sm px-2 py-1 disabled:opacity-40">
        ↑
      </button>
      <button type="button" aria-label="Next match" disabled={!count} onClick={() => step(1)} className="rounded-sm px-2 py-1 disabled:opacity-40">
        ↓
      </button>
      <label className="flex items-center gap-1 text-xs text-text-muted">
        <input
          type="checkbox"
          checked={matchCase}
          onChange={(event) => {
            setMatchCase(event.target.checked);
            search(query, event.target.checked);
          }}
        />
        Match case
      </label>
      <label htmlFor={ids.replace} className="sr-only">
        Replace with
      </label>
      <input
        id={ids.replace}
        value={replacement}
        onChange={(event) => setReplacement(event.target.value)}
        placeholder="Replace with"
        className="min-w-0 flex-1 basis-full rounded-sm border border-border bg-surface px-2 py-1 sm:basis-40"
      />
      <button type="button" disabled={!count} onClick={() => replace(false)} className="rounded-sm border border-border bg-surface px-2 py-1 text-xs disabled:opacity-40">
        Replace
      </button>
      <button type="button" disabled={!count} onClick={() => replace(true)} className="rounded-sm border border-border bg-surface px-2 py-1 text-xs disabled:opacity-40">
        Replace all
      </button>
      <button type="button" aria-label="Close find" onClick={onClose} className="ml-auto rounded-sm px-2 py-1 text-text-muted">
        ✕
      </button>
      {message && (
        <p role="status" className="basis-full text-xs text-text-muted">
          {message}
        </p>
      )}
    </div>
  );
}
