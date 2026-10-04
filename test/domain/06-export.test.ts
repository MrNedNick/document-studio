import { describe, expect, it } from "vitest";
import { exportFileName, htmlPage, inlinePictures, readBundle, BUNDLE_VERSION } from "../../src/domain/06-export";
import { bundle, picture } from "../fixtures/06-export/bundles";

describe("HTML export", () => {
  it("names the file after the title", () => {
    expect(exportFileName("Q3 plan / draft", "html")).toBe("q3-plan-draft.html");
    expect(exportFileName("Café notes", "json")).toBe("cafe-notes.json");
    expect(exportFileName("Звіт", "html")).toBe("звіт.html");
    expect(exportFileName("  ", "html")).toBe("untitled-document.html");
  });

  it("puts pictures in as data URLs, and marks a missing one with its description", () => {
    const html = '<p>x</p><figure data-asset-id="pic" data-alt="Chart"><figcaption>Revenue</figcaption></figure><figure data-asset-id="gone" data-alt="Map"><figcaption></figcaption></figure>';
    const result = inlinePictures(html, new Map([["pic", { src: "data:image/png;base64,AQID", alt: "Chart" }]]));
    expect(result.html).toContain('<img src="data:image/png;base64,AQID" alt="Chart"><figcaption>Revenue</figcaption>');
    expect(result.html).toContain("[Picture not available: Map]");
    expect(result.missing).toEqual(["gone"]);
  });

  it("makes a complete page with the title escaped and print styles", () => {
    const page = htmlPage("Plans <& ideas>", "<p>Body</p>");
    expect(page.startsWith("<!doctype html>")).toBe(true);
    expect(page).toContain("<title>Plans &lt;&amp; ideas&gt;</title>");
    expect(page).toContain("@media print");
    expect(page).toContain("<p>Body</p>");
  });
});

describe("bundles", () => {
  it("carry only the pictures the document shows, and read back exactly", () => {
    expect(bundle.assets.map((asset) => asset.id)).toEqual(["pic"]);
    expect(readBundle(JSON.stringify(bundle))).toEqual({ ok: true, value: bundle });
  });

  it("edge case, a damaged import: every way a file can be wrong is named, nothing is half-read", () => {
    expect(readBundle("{oops")).toEqual({ ok: false, error: { kind: "export", reason: "not-json" } });
    expect(readBundle(JSON.stringify({ hello: 1 }))).toMatchObject({ ok: false, error: { reason: "not-a-bundle" } });
    expect(readBundle(JSON.stringify({ ...bundle, version: BUNDLE_VERSION + 1 }))).toMatchObject({ ok: false, error: { reason: "newer-format" } });
    const marquee = { ...bundle, document: { ...bundle.document, body: { type: "doc", content: [{ type: "marquee" }] } } };
    expect(readBundle(JSON.stringify(marquee))).toEqual({ ok: false, error: { kind: "export", reason: "document-damaged", detail: "marquee" } });
    expect(readBundle(JSON.stringify({ ...bundle, assets: [{ ...picture, type: "image/svg+xml" }] }))).toEqual({ ok: false, error: { kind: "export", reason: "asset-damaged", detail: "pic" } });
    expect(readBundle(JSON.stringify({ ...bundle, assets: [{ ...picture, data: "not base64!" }] }))).toMatchObject({ ok: false, error: { reason: "asset-damaged" } });
  });
});
