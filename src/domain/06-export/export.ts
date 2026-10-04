import { readDocument, type Document } from "../01-blocks";
import { assetsIn, IMAGE_TYPES } from "../03-images";
import { err, ok, type Result } from "../result";
import { exportError, type ExportError } from "./errors";
import { BUNDLE_FORMAT, BUNDLE_VERSION, type Bundle, type BundledAsset } from "./types";

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** "Q3 plan / draft" → "q3-plan-draft.html": a file name that travels well; letters of any language kept. */
export function exportFileName(title: string, extension: "html" | "json"): string {
  const slug = title.toLowerCase().normalize("NFKD").replace(/\p{Mark}/gu, "").replace(/[^\p{Letter}\p{Number}]+/gu, "-").replace(/^-+|-+$/g, "");
  return `${slug || "untitled-document"}.${extension}`;
}

/**
 * Puts the pictures into exported HTML. The editor writes a figure as `<figure data-asset-id="…">` with
 * its caption; here each gets its picture as a data URL, so the file stands alone. A picture this
 * device doesn't have becomes a visible note with its description, and is listed in `missing`.
 */
export function inlinePictures(html: string, pictures: ReadonlyMap<string, { src: string; alt: string }>): { html: string; missing: string[] } {
  const missing: string[] = [];
  const out = html.replace(/<figure([^>]*?)data-asset-id="([^"]*)"([^>]*)>/g, (_whole, before: string, id: string, after: string) => {
    const picture = pictures.get(id);
    const alt = /data-alt="([^"]*)"/.exec(before + after)?.[1] ?? "";
    if (!picture) {
      missing.push(id);
      return `<figure${before}data-asset-id="${id}"${after}><p class="missing-picture">[Picture not available${alt ? `: ${alt}` : ""}]</p>`;
    }
    return `<figure${before}data-asset-id="${id}"${after}><img src="${picture.src}" alt="${alt}">`;
  });
  return { html: out, missing };
}

/** A complete page: the title, the document's HTML, and styles that read well on screen and on paper. */
export function htmlPage(title: string, bodyHtml: string): string {
  const name = escape(title.trim() || "Untitled document");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name}</title>
<style>
  body { max-width: 46rem; margin: 2.5rem auto; padding: 0 1.25rem; font: 17px/1.65 system-ui, -apple-system, "Segoe UI", sans-serif; color: #14171c; }
  h1, h2, h3 { line-height: 1.25; margin: 1.4em 0 0.4em; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  td, th { border: 1px solid #d5d9df; padding: 0.35rem 0.6rem; vertical-align: top; text-align: left; }
  th { background: #f4f5f7; }
  td p, th p, li p { margin: 0; }
  blockquote { margin: 1em 0; padding-left: 1rem; border-left: 3px solid #d5d9df; color: #5b6472; }
  pre { background: #f4f5f7; padding: 0.75rem 1rem; border-radius: 6px; overflow-x: auto; }
  code { font-family: ui-monospace, Menlo, monospace; font-size: 0.9em; }
  figure { margin: 1.25em 0; text-align: center; }
  figure img { max-width: 100%; height: auto; }
  figcaption { font-size: 0.9rem; color: #5b6472; }
  ul[data-type="taskList"] { list-style: none; padding-left: 0.25rem; }
  ul[data-type="taskList"] li { display: flex; gap: 0.5rem; }
  .missing-picture { padding: 1rem; border: 1px dashed #d5d9df; color: #5b6472; }
  @media print { body { margin: 0; max-width: none; } figure, table, pre { break-inside: avoid; } a { color: inherit; } }
</style>
</head>
<body>
<h1 class="document-title">${name}</h1>
${bodyHtml}
</body>
</html>
`;
}

/** The document and the pictures it shows, ready to save as one file. Pictures it no longer shows are left out. */
export function makeBundle(document: Document, assets: readonly BundledAsset[], now: number): Bundle {
  const used = assetsIn(document.body);
  return { format: BUNDLE_FORMAT, version: BUNDLE_VERSION, exportedAt: now, document, assets: assets.filter((asset) => used.has(asset.id)) };
}

/**
 * Reads a bundle back, checking everything before anything is replaced: that it is JSON, that it is
 * this app's format and not a newer one, that the document reads (the unknown block is named), and that
 * every picture has a known type and its bytes.
 */
export function readBundle(text: string): Result<Bundle, ExportError> {
  let data: Partial<Bundle>;
  try {
    data = JSON.parse(text);
  } catch {
    return err(exportError("not-json"));
  }
  if (!data || typeof data !== "object" || data.format !== BUNDLE_FORMAT || typeof data.version !== "number") return err(exportError("not-a-bundle"));
  if (data.version > BUNDLE_VERSION) return err(exportError("newer-format"));
  if (data.version !== BUNDLE_VERSION) return err(exportError("not-a-bundle"));
  let document: ReturnType<typeof readDocument>;
  try { document = readDocument(data.document); }
  catch { return err(exportError("document-damaged")); }
  if (!document.ok) return err(exportError("document-damaged", document.error.type ?? document.error.reason));
  const assets = Array.isArray(data.assets) ? data.assets : [];
  const ids = new Set<string>();
  for (const asset of assets) {
    const fine =
      asset && typeof asset.id === "string" && asset.id.length > 0 && !ids.has(asset.id) &&
      (IMAGE_TYPES as readonly string[]).includes(asset.type) &&
      [asset.width, asset.height, asset.bytes].every((value) => Number.isInteger(value) && value > 0) &&
      Number.isFinite(asset.createdAt) && typeof asset.data === "string" && asset.data.length > 0 &&
      /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(asset.data);
    if (!fine) return err(exportError("asset-damaged", typeof asset?.id === "string" ? asset.id : undefined));
    ids.add(asset.id);
  }
  for (const id of assetsIn(document.value.body)) if (!ids.has(id)) return err(exportError("asset-damaged", id));
  return ok({ format: BUNDLE_FORMAT, version: data.version, exportedAt: Number(data.exportedAt) || 0, document: document.value, assets: assets as BundledAsset[] });
}
