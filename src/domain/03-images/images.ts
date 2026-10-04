import type { Block } from "../01-blocks";
import { err, ok, type Result } from "../result";
import { imagesError, type ImagesError } from "./errors";
import { IMAGE_TYPES, MAX_IMAGE_FILE, MAX_IMAGE_SIDE, type ImageType } from "./types";

/**
 * Whether a file can become a picture in the document, decided from its type and size before a byte is
 * read. SVG is refused (it can run scripts), as are files over 20 MB.
 */
export function checkImageFile(file: { name: string; type: string; size: number }): Result<ImageType, ImagesError> {
  if (!file.type.startsWith("image/")) return err(imagesError("not-an-image", file.name));
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return err(imagesError("unsupported-type", file.name));
  if (file.size > MAX_IMAGE_FILE) return err(imagesError("image-too-large", file.name));
  return ok(file.type as ImageType);
}

/** The size a picture is stored at: never larger than it was, longest side at most `max`. */
export function fitWithin(width: number, height: number, max = MAX_IMAGE_SIDE) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), scaled: scale < 1 };
}

/**
 * A picture block: the asset it shows, its description for people who can't see it, and a caption
 * that is ordinary text in the document (searchable, exported, undone like any other text).
 */
export function figureBlock(assetId: string, alt = "", caption = ""): Block {
  return { type: "figure", attrs: { assetId, alt }, ...(caption ? { content: [{ type: "text", text: caption }] } : {}) };
}

/** Every asset a document shows — for export, and for knowing which stored pictures are still used. */
export function assetsIn(block: Block, found = new Set<string>()): Set<string> {
  if (block.type === "figure" && typeof block.attrs?.assetId === "string") found.add(block.attrs.assetId);
  for (const child of block.content ?? []) assetsIn(child, found);
  return found;
}

/** "photo-2026.jpg" → "photo 2026": a first description when the user hasn't written one. */
export function altFromFileName(name: string): string {
  const base = name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim();
  return /^(image|img|screenshot|screen shot|photo|pasted)[\s\d.:at-]*$/i.test(base) || /^[\d\s.:-]+$/.test(base) ? "" : base;
}
