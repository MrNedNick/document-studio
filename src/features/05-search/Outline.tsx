import { useEditorState, type Editor } from "@tiptap/react";
import { cn } from "../../lib/cn";

interface Entry {
  level: number;
  text: string;
  pos: number;
}

/** The headings of the document as it is being typed, and which section the cursor is in. */
function useHeadings(editor: Editor) {
  return useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const headings: Entry[] = [];
      e.state.doc.descendants((node, pos) => {
        if (node.type.name === "heading") {
          const text = node.textContent.trim();
          if (text) headings.push({ level: Number(node.attrs.level), text, pos });
          return false;
        }
        return node.type.name === "doc" || node.type.name === "blockquote";
      });
      const cursor = e.state.selection.from;
      const active = headings.reduce((found, heading, index) => (heading.pos <= cursor ? index : found), -1);
      return { headings, active };
    },
    equalityFn: (a, b) => !!b && a.active === b.active && JSON.stringify(a.headings) === JSON.stringify(b.headings),
  });
}

/**
 * Jump to a heading. Wide screens show it beside the text; narrow ones fold it above the text, closed,
 * so it never pushes the document down unasked.
 */
export function Outline({ editor, variant }: { editor: Editor; variant: "side" | "fold" }) {
  const { headings, active } = useHeadings(editor);
  if (!headings.length) return variant === "side" ? <p className="text-xs text-text-muted">Headings you add appear here.</p> : null;
  const list = (
    <ol className="space-y-0.5 text-sm">
      {headings.map((heading, index) => (
        <li key={`${heading.pos}`} style={{ paddingLeft: `${(heading.level - 1) * 0.75}rem` }}>
          <button
            type="button"
            aria-current={index === active ? "location" : undefined}
            onClick={() => {
              editor.chain().setTextSelection(heading.pos + 1).scrollIntoView().run();
              // Focused now, not a frame later: a delayed focus would take the cursor from whatever the
              // user does next (⌘F, a click in the find bar).
              editor.view.focus();
            }}
            className={cn(
              "w-full truncate rounded-sm px-2 py-1 text-left text-text-muted hover:bg-surface-raised hover:text-text",
              index === active && "bg-accent/10 font-medium text-accent",
            )}
          >
            {heading.text}
          </button>
        </li>
      ))}
    </ol>
  );
  if (variant === "side")
    return (
      <nav aria-label="Outline">
        <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Outline</p>
        {list}
      </nav>
    );
  return (
    <details className="mb-3 rounded-md border border-border bg-surface px-2 py-1.5">
      <summary className="cursor-pointer text-sm font-medium">Outline · {headings.length}</summary>
      <nav aria-label="Outline" className="mt-2">
        {list}
      </nav>
    </details>
  );
}
