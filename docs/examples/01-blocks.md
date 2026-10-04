# Example: writing and pasting safely

## Try it

```bash
npm run dev
```

1. Type a title and some text; use the toolbar or the usual shortcuts (⌘/Ctrl+B, I, Z, ⇧Z) for bold,
   italic, headings, quotes, code and a divider. The header says **Saved on this device** a moment
   after you stop typing.
2. Copy a paragraph from Word or Google Docs and paste it: the words, headings, bold, italic and links
   come along; fonts, colours, Word's hidden markup and Google's wrapper don't.
3. Paste from a web page with scripts or tracking links: the page says what was removed
   ("Pasted the text — removed scripts and unsafe links").
4. **Paste and match style** (⇧ with paste) brings plain text only: a blank line starts a paragraph, a
   single line break stays a line break.
5. Reload: the document is back exactly as it was.

## Rules

- Every paste goes through one cleaner before the editor sees it. Kept: paragraphs, headings (h4–h6
  become h3), bold, italic, underline, strikethrough, code, quotes, lists, links (http, https and mailto
  only), dividers. Removed with their content: scripts, styles, iframes, embedded objects, form fields,
  images (they arrive in a later stage). Everything else is unwrapped — its words stay.
- Bold and italic set by inline style (Google Docs, Notion) become real bold and italic; Google's
  `<b style="font-weight:normal">` wrapper is not bold.
- A paste with nothing readable changes nothing and says so; over 2 MB of HTML is refused with a hint
  to paste a smaller part. One undo takes back a whole paste.
- Documents are saved in IndexedDB on this device. One that doesn't read any more (made by a newer
  version, or damaged) is set aside in a separate store — never deleted — and the page says so.
- If the browser blocks storage, the editor still works and the header says the text isn't being kept.

## Measured

On a 3000-paragraph document (153,000 words), Chromium, M-series Mac:

| | |
|---|---|
| Opening the document | 145 ms |
| A key press, to the next frame | 14.7 ms median, 25 ms worst of 10 |
| Cleaning a 1.1 MB paste from Word | 59 ms |

The document is turned into JSON once per save, after a pause in typing, not on every key — that
halved the time per key press on this document (32 → 15 ms).

## Where it lives

- `src/domain/01-blocks/` — `cleanPastedHtml`, `plainTextToBlocks`, `readDocument`, `newDocument`.
- `src/adapters/document-store.ts` — IndexedDB, with damaged records set aside.
- `src/features/01-blocks/` — the editor, toolbar and the save cycle.
- Tests: `test/domain/01-blocks.test.ts`, `test/adapters/document-store.test.ts`,
  `test/integration/01-blocks.test.tsx`.
