import { useEditorState, type Editor } from "@tiptap/react";

const ACTIONS: { label: string; run: (editor: Editor) => boolean }[] = [
  { label: "Row above", run: (e) => e.chain().focus().addRowBefore().run() },
  { label: "Row below", run: (e) => e.chain().focus().addRowAfter().run() },
  { label: "Column left", run: (e) => e.chain().focus().addColumnBefore().run() },
  { label: "Column right", run: (e) => e.chain().focus().addColumnAfter().run() },
  { label: "Delete row", run: (e) => e.chain().focus().deleteRow().run() },
  { label: "Delete column", run: (e) => e.chain().focus().deleteColumn().run() },
  { label: "Header row", run: (e) => e.chain().focus().toggleHeaderRow().run() },
  { label: "Delete table", run: (e) => e.chain().focus().deleteTable().run() },
];

/**
 * Table controls, shown only while the cursor is in a table. Tab and Shift+Tab move between cells;
 * Tab in the last cell adds a row.
 */
export function TableBar({ editor }: { editor: Editor }) {
  const inTable = useEditorState({ editor, selector: ({ editor: current }) => current.isActive("table") });
  if (!inTable) return null;
  return (
    <div role="toolbar" aria-label="Table" className="flex flex-wrap gap-1 border-b border-border bg-surface-raised px-2 py-1.5 text-xs">
      {ACTIONS.map((action) => (
        <button
          key={action.label}
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => action.run(editor)}
          className="rounded-sm border border-border bg-surface px-2 py-1 font-medium text-text-muted hover:text-text"
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
