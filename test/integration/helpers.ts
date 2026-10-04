import { act } from "@testing-library/react";

/** A paste the way the browser delivers it: a ClipboardEvent with HTML and/or plain text. */
export function paste(data: { html?: string; text?: string }) {
  const editor = document.querySelector(".ProseMirror")!;
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", {
    value: { getData: (type: string) => (type === "text/html" ? (data.html ?? "") : type === "text/plain" ? (data.text ?? "") : ""), files: [], types: [] },
  });
  act(() => {
    editor.dispatchEvent(event);
  });
}

export const editorHtml = () => document.querySelector(".ProseMirror")!.innerHTML;

/** A shortcut the way ProseMirror's keymap sees it (Ctrl on this platform). */
export function press(key: string, extra: KeyboardEventInit = {}) {
  act(() => {
    document.querySelector(".ProseMirror")!.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...extra }));
  });
}
