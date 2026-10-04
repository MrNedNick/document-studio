import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { FigureView } from "./FigureView";

/**
 * A stored picture with a caption: `<figure data-asset-id><figcaption>…</figcaption></figure>`.
 * The picture is referenced by id, never inlined, so documents stay small however many pictures they hold.
 */
export const Figure = Node.create({
  name: "figure",
  group: "block",
  content: "inline*",
  draggable: true,
  isolating: true,
  addAttributes() {
    return {
      assetId: { default: null, parseHTML: (element) => element.getAttribute("data-asset-id"), renderHTML: (attrs) => ({ "data-asset-id": attrs.assetId }) },
      alt: { default: "", parseHTML: (element) => element.getAttribute("data-alt") ?? "", renderHTML: (attrs) => ({ "data-alt": attrs.alt }) },
    };
  },
  parseHTML() {
    return [{ tag: "figure[data-asset-id]", contentElement: "figcaption" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["figure", mergeAttributes(HTMLAttributes), ["figcaption", 0]];
  },
  addNodeView() {
    return ReactNodeViewRenderer(FigureView);
  },
});
