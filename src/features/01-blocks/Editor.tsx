import { EditorContent, useEditor, type Editor as TiptapEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { matrixToTable, parseDelimited } from "../../domain/02-tables";
import { describeTablesError } from "../02-tables/messages";
import { TableBar } from "../02-tables/TableBar";
import { useEffect, useRef } from "react";
import { cleanPastedHtml, plainTextToBlocks, type DocumentBody } from "../../domain/01-blocks";
import { describePasteError, describeRemoved } from "./messages";
import { Toolbar } from "./Toolbar";

interface Props {
  body: DocumentBody;
  /** The text changed; `read` gives the content when it is needed (on save), not on every key. */
  onChange: (read: () => DocumentBody) => void;
  /** Something to say about the last paste: what was removed, or why nothing was pasted. */
  onNotice: (message: string) => void;
}

/** Inserts plain text: one paragraph goes inline at the cursor, several become paragraphs. */
function insertText(editor: TiptapEditor, text: string) {
  const blocks = plainTextToBlocks(text);
  if (!blocks.length) return;
  editor.chain().focus().insertContent(blocks.length === 1 ? (blocks[0]!.content ?? []) : blocks).run();
}

/**
 * The document itself. Every paste goes through the same door: HTML is cleaned before the editor ever
 * parses it, plain text ("paste and match style", or text from a terminal) is split into paragraphs on
 * blank lines. Undo takes back a whole paste in one step.
 */
export function Editor({ body, onChange, onNotice }: Props) {
  const ref = useRef<TiptapEditor | null>(null);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, protocols: ["https", "http", "mailto"] },
      }),
      TableKit.configure({ table: { resizable: false } }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: body,
    editorProps: {
      attributes: { class: "prose-doc", "aria-label": "Document", "aria-multiline": "true", role: "textbox" },
      // Dropped HTML (dragged from another page) doesn't come through handlePaste; it is cleaned here.
      transformPastedHTML(html) {
        const cleaned = cleanPastedHtml(html);
        return cleaned.ok ? cleaned.value.html : "";
      },
      handlePaste(_view, event) {
        const current = ref.current;
        const data = event.clipboardData;
        if (!current || !data) return false;
        if (data.files.length && !data.getData("text/html")) return false; // pictures are not this stage
        const html = data.getData("text/html");
        const text = data.getData("text/plain");
        if (html) {
          const cleaned = cleanPastedHtml(html);
          if (!cleaned.ok) {
            // Formatting with no words in it, but the clipboard has plain text too: use that.
            if (cleaned.error.reason === "paste-empty" && text.trim()) insertText(current, text);
            else onNotice(describePasteError(cleaned.error));
            return true;
          }
          current.chain().focus().insertContent(cleaned.value.html).run();
          onNotice(describeRemoved(cleaned.value.removed));
          return true;
        }
        if (text) {
          // Cells copied as plain text (a terminal, "paste and match style" from a spreadsheet) become a table.
          const cells = parseDelimited(text);
          if (cells) {
            const table = matrixToTable(cells);
            if (table.ok) {
              current.chain().focus().insertContent(table.value).run();
              onNotice(`Pasted a table of ${cells.length} rows and ${cells[0]!.length} columns.`);
            } else onNotice(describeTablesError(table.error));
            return true;
          }
          insertText(current, text);
          onNotice("");
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: updated }) => onChange(() => updated.getJSON() as DocumentBody),
  });

  // The paste handler needs the live editor; in development React mounts twice, so it follows the current one.
  useEffect(() => {
    ref.current = editor;
  }, [editor]);

  if (!editor) return null;
  return (
    <div className="rounded-lg border border-border bg-surface shadow-card">
      <div className="sticky top-0 z-10 overflow-hidden rounded-t-lg">
        <Toolbar editor={editor} />
      </div>
      <TableBar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
