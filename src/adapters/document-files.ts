import { generateHTML } from "@tiptap/core";
import { documentExtensions } from "../features/01-blocks/extensions";
import type { Block, Document as StudioDocument } from "../domain/01-blocks";
import { assetsIn } from "../domain/03-images";
import { htmlPage, inlinePictures, makeBundle, readBundle, type Bundle, type BundledAsset } from "../domain/06-export";
import { loadAsset, openDatabase } from "./document-store";

async function base64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(binary);
}

/** Includes the bytes of every picture used by the document, never unrelated pictures. */
async function pictures(document: StudioDocument): Promise<BundledAsset[]> {
  return Promise.all([...assetsIn(document.body)].map(async (id) => {
    const stored = await loadAsset(id);
    if (!stored) throw new Error("A picture is missing on this device. Restore it before exporting a document file.");
    return { ...stored.asset, data: await base64(stored.blob) };
  }));
}

export async function documentBundle(document: StudioDocument): Promise<Bundle> {
  return makeBundle(document, await pictures(document), Date.now());
}

/** A standalone page: pictures are inlined, and missing ones are named instead of silently lost. */
export async function documentHtml(document: StudioDocument): Promise<{ html: string; missing: string[] }> {
  const sources = new Map<string, { src: string; alt: string }>();
  for (const id of assetsIn(document.body)) {
    const stored = await loadAsset(id);
    if (!stored) continue;
    sources.set(id, { src: `data:${stored.asset.type};base64,${await base64(stored.blob)}`, alt: "" });
  }
  const inlined = inlinePictures(generateHTML(document.body, documentExtensions), sources);
  return { html: htmlPage(document.title, inlined.html), missing: inlined.missing };
}

/** New ids prevent an imported copy from changing an existing document or its pictures. */
export async function importDocumentFile(text: string): Promise<StudioDocument> {
  const parsed = readBundle(text);
  if (!parsed.ok) {
    const messages = {
      "not-json": "This file is not valid JSON.",
      "not-a-bundle": "Choose a Document Studio document file (.json).",
      "newer-format": "This file needs a newer version of Document Studio.",
      "document-damaged": "The document in this file is damaged or contains an unsupported block.",
      "asset-damaged": "A picture in this file is damaged or has an unsupported format.",
    };
    throw new Error(messages[parsed.error.reason]);
  }
  const { document, assets } = parsed.value;
  const ids = new Map<string, string>();
  const records = assets.map(({ data, ...asset }) => {
    const id = crypto.randomUUID();
    ids.set(asset.id, id);
    let binary: string;
    try { binary = atob(data); } catch { throw new Error("A picture in this file has damaged bytes."); }
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return { ...asset, id, bytes: bytes.length, data: bytes.buffer };
  });
  for (const id of assetsIn(document.body)) {
    if (!ids.has(id)) throw new Error("This document file is missing a picture. Nothing was imported.");
  }
  const remap = (block: Block): Block => ({
    ...block,
    ...(block.type === "figure" ? { attrs: { ...block.attrs, assetId: ids.get(String(block.attrs?.assetId)) } } : {}),
    ...(block.content ? { content: block.content.map(remap) } : {}),
  });
  const imported = { ...document, id: crypto.randomUUID(), updatedAt: Date.now(), body: remap(document.body) as StudioDocument["body"] };
  const db = await openDatabase();
  const tx = db.transaction(["documents", "assets"], "readwrite");
  const complete = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error("This browser couldn't save the imported document. Nothing was imported."));
    tx.onabort = tx.onerror;
  });
  records.forEach((record) => tx.objectStore("assets").add(record));
  tx.objectStore("documents").add(imported);
  await complete;
  return imported;
}

export function downloadDocumentFile(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Prints the exported page, including decoded pictures, through the browser's PDF/print dialog. */
export function printDocumentPage(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.title = "Print document";
    frame.setAttribute("sandbox", "allow-same-origin allow-modals");
    frame.style.cssText = "position:fixed;width:1px;height:1px;left:-9999px;border:0";
    const timeout = setTimeout(() => { frame.remove(); reject(new Error("The print preview couldn't load. Export the web page and print it instead.")); }, 30_000);
    frame.onload = async () => {
      try {
        const win = frame.contentWindow;
        if (!win) throw new Error("The print preview couldn't open.");
        await Promise.all([...win.document.images].map((img) => img.decode().catch(() => {})));
        clearTimeout(timeout);
        win.addEventListener("afterprint", () => frame.remove(), { once: true });
        win.focus();
        win.print();
        resolve();
      } catch (error) { clearTimeout(timeout); frame.remove(); reject(error); }
    };
    frame.srcdoc = html;
    document.body.append(frame);
  });
}
