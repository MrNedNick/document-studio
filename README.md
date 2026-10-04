# Document Studio

A writing app that keeps documents on your device. Paste from Word, Google Docs or any web page and
get the words without the junk; the document is saved in the browser as you type and opens again
exactly as it was.

**React 19 · Tiptap 3 (ProseMirror) · IndexedDB · TypeScript · Vite · Vitest**

## What works today

- **A real editor** — headings, bold, italic, strikethrough, code, quotes, code blocks, dividers, links,
  undo and redo; every button is reachable by keyboard and named for screen readers.
- **Safe paste** — HTML is cleaned before the editor parses it: scripts, styles, event handlers,
  `javascript:` links and the markup Word and Google Docs add are removed, the words and their emphasis
  stay, and the page says what was taken out. Plain text is split into paragraphs on blank lines.
- **Tables and lists** — tables with a header row, rows and columns added or removed from a bar that
  appears in a table, Tab between cells; ranges copied from Excel or Google Sheets paste as real tables
  (merged cells kept); bulleted, numbered and checklist items, with "2 of 5 done" in the status line.
  Undo after inserting a table takes it away in one step.
- **Saved on the device** — IndexedDB, written a moment after you stop typing. A record that no longer
  reads is set aside, never deleted; a browser that blocks storage gets an honest notice.
- **Big documents stay fast** — a 153,000-word document opens in 145 ms and a key press takes one
  frame (details in the [walkthrough](docs/examples/01-blocks.md)).

Walkthroughs with the rules and edge cases: [writing and pasting](docs/examples/01-blocks.md),
[tables and lists](docs/examples/02-tables.md).

Next: images with captions, versions, search, and export to HTML and PDF.

## Run it

Requires Node 22 (`.nvmrc`).

```bash
npm install
npm run dev
npm test          # domain, storage and editor tests (Vitest, jsdom, fake IndexedDB)
npm run typecheck
npm run lint      # oxlint
npm run build
```

## Layout

```
src/domain/    the document model, paste cleaning, reading saved documents — no React, no editor
src/adapters/  IndexedDB
src/features/  the editor and the save cycle
test/          domain, storage and editor tests + fixtures (real Word and Google Docs clipboard HTML)
```
