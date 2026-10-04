import "fake-indexeddb/auto";

// jsdom does no layout. ProseMirror asks for rectangles when it scrolls the cursor into view; an
// empty answer is what a hidden element would give, and is enough for tests that don't measure.
const noRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
const noRect = () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON: () => ({}) }) as DOMRect;
if (typeof Element !== "undefined" && !Element.prototype.getClientRects) Element.prototype.getClientRects = noRects;
if (typeof Range !== "undefined") {
  Range.prototype.getClientRects ??= noRects;
  Range.prototype.getBoundingClientRect ??= noRect;
}
if (typeof document !== "undefined" && !document.elementFromPoint) document.elementFromPoint = () => null;
