import type { Editor } from "@tiptap/react";
import { saveAsset } from "../../adapters/document-store";
import { prepareImage } from "../../adapters/image-files";
import type { Block } from "../../domain/01-blocks";
import { altFromFileName, figureBlock, type ImagesError } from "../../domain/03-images";

/**
 * Stores picture files and puts them into the document at `position` (the cursor by default). All the
 * pictures of one paste or drop go in together — one undo takes them back — followed by an empty line
 * for the cursor, so typing goes after the pictures instead of replacing the last one.
 */
export async function insertImages(editor: Editor, files: File[], position?: number): Promise<{ inserted: number; problems: ImagesError[]; unsaved: boolean }> {
  const problems: ImagesError[] = [];
  const figures: Block[] = [];
  let unsaved = false;
  for (const file of files) {
    const prepared = await prepareImage(file);
    if (!prepared.ok) {
      problems.push(prepared.error);
      continue;
    }
    const saved = await saveAsset(prepared.value.asset, prepared.value.blob);
    if (!saved.ok) unsaved = true;
    figures.push(figureBlock(prepared.value.asset.id, altFromFileName(file.name)));
  }
  if (figures.length) {
    const content = [...figures, { type: "paragraph" }];
    const chain = editor.chain().focus();
    (position !== undefined ? chain.insertContentAt(position, content) : chain.insertContent(content)).run();
  }
  return { inserted: figures.length, problems, unsaved };
}
