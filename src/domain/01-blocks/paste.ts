import { err, ok, type Result } from "../result";
import { blocksError, type BlocksError } from "./errors";
import { MAX_PASTE_BYTES, type Block } from "./types";

/** Elements whose content is dropped with them: code, styling, embedded things and form controls. */
const DROP = new Set(["script", "style", "iframe", "object", "embed", "noscript", "template", "meta", "link", "title", "head", "svg", "math", "form", "input", "button", "select", "textarea", "img", "video", "audio", "canvas", "xml"]);

/** Elements kept as they are (attributes aside). Headings below h3 become h3. */
const KEEP: Record<string, string> = {
  p: "p", h1: "h1", h2: "h2", h3: "h3", h4: "h3", h5: "h3", h6: "h3",
  strong: "strong", b: "strong", em: "em", i: "em", u: "u", s: "s", strike: "s", del: "s",
  code: "code", pre: "pre", blockquote: "blockquote", ul: "ul", ol: "ol", li: "li", br: "br", hr: "hr", a: "a",
};

const SAFE_LINK = /^(https?:|mailto:)/i;

export interface CleanPaste {
  html: string;
  /** Kinds of things that were taken out, for the message after pasting ("scripts", "styles"…). */
  removed: string[];
}

const REMOVED_LABELS: Record<string, string> = {
  script: "scripts", style: "styles", iframe: "embedded pages", object: "embedded objects", embed: "embedded objects",
  img: "images", video: "video", audio: "audio", form: "form fields", input: "form fields", button: "form fields",
  select: "form fields", textarea: "form fields", svg: "drawings", link: "unsafe links",
};

/**
 * Pasted HTML reduced to what the editor can hold safely: text with headings, emphasis, links, lists,
 * quotes and code. Scripts, styles, event handlers, `javascript:` links and the wrappers Word and Google
 * Docs add are removed; the words are never lost. Bold and italic set by inline style (as Google Docs
 * does) are kept as real bold and italic.
 */
export function cleanPastedHtml(html: string): Result<CleanPaste, BlocksError> {
  if (html.length > MAX_PASTE_BYTES) return err(blocksError("paste-too-large"));
  const source = new DOMParser().parseFromString(html, "text/html");
  const out = document.implementation.createHTMLDocument("");
  const removed = new Set<string>();

  const copy = (node: Node, into: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      // Line breaks between blocks are layout of the source, not text; inside a paragraph spaces matter.
      if (!text.trim() && (into === out.body || ["UL", "OL", "BLOCKQUOTE"].includes((into as Element).tagName))) return;
      into.appendChild(out.createTextNode(text));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return; // comments, Word's conditional blocks
    const element = node as Element;
    const tag = element.localName.toLowerCase();
    if (DROP.has(tag) || tag.includes(":") && tag !== "o:p") {
      if (REMOVED_LABELS[tag]) removed.add(REMOVED_LABELS[tag]);
      return;
    }
    const style = element.getAttribute("style") ?? "";
    let target = into;
    const mapped = KEEP[tag];
    // Google Docs wraps everything in <b style="font-weight:normal">: that is not bold.
    const fakeBold = tag === "b" && /font-weight\s*:\s*(normal|400)/i.test(style);
    if (mapped && !fakeBold) {
      const clean = out.createElement(mapped);
      if (mapped === "a") {
        const href = element.getAttribute("href")?.trim() ?? "";
        if (SAFE_LINK.test(href)) clean.setAttribute("href", href);
        else if (href) removed.add("unsafe links");
      }
      if (mapped === "ol") {
        const start = Number(element.getAttribute("start"));
        if (Number.isInteger(start) && start > 1) clean.setAttribute("start", String(start));
      }
      into.appendChild(clean);
      target = clean;
    }
    // Inline styles for emphasis (Google Docs, Notion) become real marks.
    if (!mapped || fakeBold) {
      if (/font-weight\s*:\s*(bold|[6-9]00)/i.test(style)) target = target.appendChild(out.createElement("strong"));
      if (/font-style\s*:\s*italic/i.test(style)) target = target.appendChild(out.createElement("em"));
    }
    if ([...element.attributes].some((attribute) => attribute.name.toLowerCase().startsWith("on"))) removed.add("scripts");
    element.childNodes.forEach((child) => copy(child, target));
  };

  source.body.childNodes.forEach((child) => copy(child, out.body));
  if (!out.body.textContent?.trim() && !out.body.querySelector("hr")) return err(blocksError("paste-empty"));
  return ok({ html: out.body.innerHTML, removed: [...removed] });
}

/**
 * Pasting as plain text: a blank line starts a new paragraph, a single line break stays a line break
 * inside it. No formatting comes along, whatever the source had.
 */
export function plainTextToBlocks(text: string): Block[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n[ \t]*\n+/)
    .map((paragraph) => paragraph.replace(/^\n+|\s+$/g, ""))
    .filter((paragraph) => paragraph.length > 0)
    .map((paragraph) => {
      const lines = paragraph.split("\n");
      const content: Block[] = lines.flatMap((line, index) => {
        const parts: Block[] = index > 0 ? [{ type: "hardBreak" }] : [];
        return line ? [...parts, { type: "text", text: line }] : parts;
      });
      return { type: "paragraph", content };
    });
}
