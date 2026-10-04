# Example: search and navigation

## Try it

```bash
npm run dev
```

1. Write a few headings. On wide screens the **Outline** sits beside the text and marks the section the
   cursor is in; on narrow ones it folds above the text. Click a heading to jump there.
2. **⌘F / Ctrl+F** anywhere on the page (or **⌕** on the toolbar) opens find: the count shows "3 of 12",
   Enter and Shift+Enter move between matches, Escape closes. Case and accents are ignored unless
   **Match case** is on — "cafe" finds "café".
3. **Replace** changes the current match; **Replace all** changes every one in a single step, so one
   undo puts them all back.
4. **Documents** lists everything on this device, newest first; type to search titles and text — each
   result shows how many matches and the words around the first one. **New document** starts an empty one;
   the current one is saved before switching.

## Rules

- Matches are found within a paragraph, heading, cell or caption — a word that is half bold is still
  found; a match never runs across a picture or a line break.
- Queries over 200 characters are refused with a message rather than run.

## Where it lives

- `src/domain/05-search/` — `fold`, `findAll`, `outline`, `snippetAround`, `searchDocuments`.
- `src/features/05-search/` — the search extension (highlights, replace), the find bar, the outline and
  the documents list.
- Tests: `test/domain/05-search.test.ts`. Integration tests for this stage are still to be written —
  see the status in the README.
