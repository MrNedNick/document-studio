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
- **Pictures with captions** — add from the toolbar, paste a screenshot or drop files; big photos are
  stored at 2000 px, SVG is refused (it can run code); captions are document text, and every picture
  gets a description for screen readers. Documents only name their pictures, so they stay small.
- **Versions** — kept automatically every five minutes of writing and thinned out as they age, or saved
  by hand with a name; read any version and restore it — the current text is kept as a version first,
  so a restore can always be taken back.
- **Search and navigation** — find and replace with a match count (case and accents ignored unless
  asked; "Replace all" undoes in one step), an outline of headings to jump between sections, and a
  list of all documents on the device with search across titles and text.
- **Saved on the device** — IndexedDB, written a moment after you stop typing. A record that no longer
  reads is set aside, never deleted; a browser that blocks storage gets an honest notice.
- **Big documents stay fast** — a 153,000-word document opens in 145 ms and a key press takes one
  frame (details in the [walkthrough](docs/examples/01-blocks.md)).

Walkthroughs with the rules and edge cases: [writing and pasting](docs/examples/01-blocks.md),
[tables and lists](docs/examples/02-tables.md),
[pictures and captions](docs/examples/03-images.md),
[versions and restoring](docs/examples/04-versions.md),
[search and navigation](docs/examples/05-search.md).

Next: export to HTML and PDF (and a few loose ends — see [Status](#status)).

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

## Status

Done: writing and safe paste, tables and lists, pictures with captions, versions, search and navigation.

Still to do:

- Integration tests for search and navigation (find/replace counts and one-step undo, outline jump,
  documents search and switching) — the scenario was checked by hand in the browser at 1440 and 360 px.
- Export to HTML and PDF, and import of an exported file with damaged-file checks.
- Deleting and renaming documents from the documents list.
- Publishing: the project has no remote repository yet, so no CI or live demo.
