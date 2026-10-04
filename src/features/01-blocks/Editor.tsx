import { EditorContent, useEditor, type Editor as TiptapEditor } from "@tiptap/react";
import { matrixToTable, parseDelimited } from "../../domain/02-tables";
import { describeTablesError } from "../02-tables/messages";
import { TableBar } from "../02-tables/TableBar";
import { describeImagesError, insertImages } from "../03-images";
import { documentExtensions } from "./extensions";
import { useEffect, useRef, useState } from "react";
import { DocumentSearch } from "../05-search/search-extension";
import { FindBar } from "../05-search/FindBar";
import { cleanPastedHtml, plainTextToBlocks, type DocumentBody } from "../../domain/01-blocks";
import { describePasteError, describeRemoved } from "./messages";
import { Toolbar } from "./Toolbar";

interface Props {
  body: DocumentBody;
  /** The text changed; `read` gives the content when it is needed (on save), not on every key. */
  onChange: (read: () => DocumentBody) => void;
  /** Something to say about the last paste: what was removed, or why nothing was pasted. */
  onNotice: (message: string) => void;
  /** Hands the live editor to the page, for the outline beside it. */
  onReady?: (editor: TiptapEditor | null) => void;
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
export function Editor({ body, onChange, onNotice, onReady }: Props) {
  const ref = useRef<TiptapEditor | null>(null);
  const [finding, setFinding] = useState(false);
  /** Bumped by every ⌘/Ctrl+F, so pressing it again with the bar open puts the cursor back in it. */
  const [findSignal, setFindSignal] = useState(0);
  const openFind = () => {
    setFinding(true);
    setFindSignal((n) => n + 1);
  };
  const editor = useEditor({
    extensions: [...documentExtensions, DocumentSearch],
    content: body,
    editorProps: {
      attributes: { class: "prose-doc", "aria-label": "Document", "aria-multiline": "true", role: "textbox" },
      // Dropped HTML (dragged from another page) doesn't come through handlePaste; it is cleaned here.
      transformPastedHTML(html) {
        const cleaned = cleanPastedHtml(html);
        return cleaned.ok ? cleaned.value.html : "";
      },
      handleDrop(view, event, _slice, moved) {
        const current = ref.current;
        const files = [...(event.dataTransfer?.files ?? [])];
        if (moved || !current || !files.length) return false;
        const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        event.preventDefault();
        void addPictures(current, files, at);
        return true;
      },
      handlePaste(_view, event) {
        const current = ref.current;
        const data = event.clipboardData;
        if (!current || !data) return false;
        // A screenshot or a copied picture file: stored and inserted as a figure.
        const pictures = [...data.files].filter((file) => file.type.startsWith("image/"));
        if (pictures.length && !data.getData("text/html")) {
          void addPictures(current, pictures);
          return true;
        }
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

  async function addPictures(target: TiptapEditor, files: File[], at?: number) {
    onNotice(files.length === 1 ? "Adding the picture…" : `Adding ${files.length} pictures…`);
    const result = await insertImages(target, files, at);
    const added = result.inserted === 0 ? "" : result.inserted === 1 ? "Picture added — click it to write a description." : `${result.inserted} pictures added.`;
    onNotice(
      [
        added,
        ...result.problems.map(describeImagesError),
        ...(result.unsaved ? ["This browser couldn't store the pictures — they won't be there after a reload."] : []),
      ]
        .filter(Boolean)
        .join(" "),
    );
  }

  // ⌘/Ctrl+F searches the document from anywhere on the page, not only while the text has focus —
  // otherwise a click in the outline would hand it to the browser's own find.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        openFind();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // The paste handler needs the live editor; in development React mounts twice, so it follows the current one.
  useEffect(() => {
    ref.current = editor;
    onReady?.(editor);
    return () => onReady?.(null);
  }, [editor, onReady]);

  if (!editor) return null;
  return (
    <div className="rounded-lg border border-border bg-surface shadow-card">
      <div className="sticky top-0 z-10 overflow-hidden rounded-t-lg">
        <Toolbar editor={editor} onPictures={(files) => void addPictures(editor, files)} onFind={openFind} />
        {finding && <FindBar editor={editor} focusSignal={findSignal} onClose={() => setFinding(false)} />}
      </div>
      <TableBar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
