import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Figure } from "../03-images/figure";

/**
 * Everything the document can contain, in one list: the editor, version previews and exports all use
 * it, so a document reads the same everywhere.
 */
export const documentExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: { openOnClick: false, autolink: true, protocols: ["https", "http", "mailto"] },
  }),
  TableKit.configure({ table: { resizable: false } }),
  TaskList,
  TaskItem.configure({ nested: true }),
  Figure,
];
