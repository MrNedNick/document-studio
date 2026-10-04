import { newDocument } from "../../../src/domain/01-blocks";
import { figureBlock } from "../../../src/domain/03-images";
import { makeBundle, type BundledAsset } from "../../../src/domain/06-export";

export const picture: BundledAsset = { id: "pic", type: "image/png", width: 1, height: 1, bytes: 3, createdAt: 1, data: "AQID" };
export const unused: BundledAsset = { ...picture, id: "old" };

/** A document with a table and a picture, bundled with its picture (and one it no longer shows). */
export const bundle = makeBundle(
  {
    ...newDocument("d", 10, "Q3 plan / draft"),
    body: {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
        { type: "table", content: [{ type: "tableRow", content: [{ type: "tableHeader", content: [{ type: "paragraph" }] }] }] },
        figureBlock("pic", "Chart", "Revenue"),
      ],
    },
  },
  [picture, unused],
  20,
);
