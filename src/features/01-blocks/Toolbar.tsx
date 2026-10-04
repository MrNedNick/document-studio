import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { cn } from "../../lib/cn";

interface Tool {
  label: string;
  /** What a screen reader and a tooltip say; the label is the short glyph. */
  name: string;
  shortcut?: string;
  active?: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
}

const TOOLS: Tool[][] = [
  [
    { label: "B", name: "Bold", shortcut: "Mod+B", active: (e) => e.isActive("bold"), run: (e) => e.chain().focus().toggleBold().run() },
    { label: "I", name: "Italic", shortcut: "Mod+I", active: (e) => e.isActive("italic"), run: (e) => e.chain().focus().toggleItalic().run() },
    { label: "S", name: "Strikethrough", active: (e) => e.isActive("strike"), run: (e) => e.chain().focus().toggleStrike().run() },
    { label: "</>", name: "Inline code", active: (e) => e.isActive("code"), run: (e) => e.chain().focus().toggleCode().run() },
  ],
  [
    { label: "H1", name: "Heading 1", active: (e) => e.isActive("heading", { level: 1 }), run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
    { label: "H2", name: "Heading 2", active: (e) => e.isActive("heading", { level: 2 }), run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: "H3", name: "Heading 3", active: (e) => e.isActive("heading", { level: 3 }), run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
    { label: "“ ”", name: "Quote", active: (e) => e.isActive("blockquote"), run: (e) => e.chain().focus().toggleBlockquote().run() },
    { label: "{ }", name: "Code block", active: (e) => e.isActive("codeBlock"), run: (e) => e.chain().focus().toggleCodeBlock().run() },
    { label: "—", name: "Divider", run: (e) => e.chain().focus().setHorizontalRule().run() },
  ],
  [
    { label: "•", name: "Bulleted list", active: (e) => e.isActive("bulletList"), run: (e) => e.chain().focus().toggleBulletList().run() },
    { label: "1.", name: "Numbered list", active: (e) => e.isActive("orderedList"), run: (e) => e.chain().focus().toggleOrderedList().run() },
    { label: "☑", name: "Checklist", active: (e) => e.isActive("taskList"), run: (e) => e.chain().focus().toggleTaskList().run() },
    { label: "▦", name: "Insert table", run: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  ],
  [
    { label: "↶", name: "Undo", shortcut: "Mod+Z", run: (e) => e.chain().focus().undo().run() },
    { label: "↷", name: "Redo", shortcut: "Mod+Shift+Z", run: (e) => e.chain().focus().redo().run() },
  ],
];

/** Formatting buttons that show what applies at the cursor, each reachable by Tab and named for screen readers. */
export function Toolbar({ editor }: { editor: Editor }) {
  // Re-render on selection changes only for the active flags we show.
  const active = useEditorState({
    editor,
    selector: ({ editor: current }) => TOOLS.flat().map((tool) => tool.active?.(current) ?? false),
  });
  let index = 0;
  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-1 border-b border-border bg-surface/95 px-2 py-1.5 backdrop-blur">
      {TOOLS.map((group, groupIndex) => (
        <div key={groupIndex} className="flex items-center gap-0.5 border-r border-border pr-1 last:border-r-0">
          {group.map((tool) => {
            const on = active[index++] ?? false;
            return (
              <button
                key={tool.name}
                type="button"
                aria-label={tool.name}
                aria-pressed={tool.active ? on : undefined}
                title={tool.shortcut ? `${tool.name} (${tool.shortcut.replace("Mod", navigator.platform.includes("Mac") ? "⌘" : "Ctrl")})` : tool.name}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => tool.run(editor)}
                className={cn(
                  "min-w-8 rounded-sm px-2 py-1 text-sm font-semibold text-text-muted transition-colors hover:bg-surface-raised hover:text-text",
                  on && "bg-accent/10 text-accent",
                )}
              >
                {tool.label}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
