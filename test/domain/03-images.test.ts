import { describe, expect, it } from "vitest";
import { readDocument, newDocument } from "../../src/domain/01-blocks";
import { altFromFileName, assetsIn, checkImageFile, figureBlock, fitWithin, MAX_IMAGE_FILE } from "../../src/domain/03-images";

describe("image files", () => {
  it("takes the formats every browser shows, and names what it refuses", () => {
    expect(checkImageFile({ name: "a.jpg", type: "image/jpeg", size: 1000 })).toEqual({ ok: true, value: "image/jpeg" });
    expect(checkImageFile({ name: "logo.svg", type: "image/svg+xml", size: 1000 })).toEqual({ ok: false, error: { kind: "images", reason: "unsupported-type", name: "logo.svg" } });
    expect(checkImageFile({ name: "notes.pdf", type: "application/pdf", size: 1000 })).toMatchObject({ ok: false, error: { reason: "not-an-image" } });
    expect(checkImageFile({ name: "huge.png", type: "image/png", size: MAX_IMAGE_FILE + 1 })).toMatchObject({ ok: false, error: { reason: "image-too-large" } });
  });

  it("stores big pictures at 2000 px on the long side, never enlarges small ones", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 2000, height: 1500, scaled: true });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600, scaled: false });
  });

  it("starts a description from a meaningful file name, not from a camera's or a screenshot's", () => {
    expect(altFromFileName("team-offsite_2026.jpg")).toBe("team offsite 2026");
    expect(altFromFileName("IMG_4031.HEIC")).toBe("");
    expect(altFromFileName("Screenshot 2026-10-04 at 12.30.11.png")).toBe("");
    expect(altFromFileName("image.png")).toBe("");
  });
});

describe("figures", () => {
  it("a figure is part of a document that reads back, and the assets it uses are listed", () => {
    const doc = { ...newDocument("d", 1), body: { type: "doc" as const, content: [figureBlock("a1", "Chart", "Revenue by month"), { type: "paragraph" }, figureBlock("a2")] } };
    expect(readDocument(JSON.parse(JSON.stringify(doc))).ok).toBe(true);
    expect([...assetsIn(doc.body)]).toEqual(["a1", "a2"]);
    expect(doc.body.content[0]).toEqual({ type: "figure", attrs: { assetId: "a1", alt: "Chart" }, content: [{ type: "text", text: "Revenue by month" }] });
  });
});
