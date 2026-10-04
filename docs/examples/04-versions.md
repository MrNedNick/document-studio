# Example: versions and restoring

## Try it

```bash
npm run dev
```

1. Write for a while. **History** in the header counts the versions kept automatically — one every five
   minutes while the text changes, none while it doesn't.
2. Open **History**, give a version a name ("Sent to Anna") and **Save a version**.
3. Keep editing. In **History**, pick any version to read it, then **Restore this version** and confirm.
   The text goes back, and what you had a moment ago appears as **Before a restore** — restore that one
   to change your mind.
4. Reload: the restored text and the whole history are still there.

## Rules

- Versions you save by hand, and the copy made before every restore, are never thrown away by age.
- Automatic versions thin out as they age: all of the last hour, one per hour for the last day, one per
  day for the last month, none older — at most 200 in all. A month of writing keeps about 60.
- A version keeps its own copy of the text; editing afterwards never changes it.
- A version that can't be read any more (damaged storage) is shown as such, can't be restored, and the
  current text stays untouched.

## Measured

On a 153,000-word document (about 1 MB of JSON), Chromium: making a version 9.7 ms, deciding whether
one is due 0.8 ms, thinning 4,000 versions 0.7 ms. Versions are made after a save, never on a key press.

## Where it lives

- `src/domain/04-versions/` — `makeRevision`, `shouldSnapshot`, `pruneRevisions`, `restore`, `wordChange`.
- The `revisions` store in `src/adapters/document-store.ts` (database version 3, indexed by document).
- `src/features/04-versions/HistoryPanel.tsx`; the save cycle in `src/features/01-blocks/useDocument.ts`.
- Tests: `test/domain/04-versions.test.ts`, `test/integration/04-versions.test.tsx`.
