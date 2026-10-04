# Example: pictures and captions

## Try it

```bash
npm run dev
```

1. **🖼** on the toolbar adds pictures (several at once), a screenshot pastes straight in, and picture
   files can be dropped anywhere in the text.
2. Click under a picture to write its caption — ordinary text, found by search and kept in exports.
   While the cursor is in the figure, a field asks for a **description for screen readers**; it starts
   from the file name when that says something ("team-offsite.jpg" → "team offsite"), and stays empty
   for camera and screenshot names.
3. Reload: pictures, captions and descriptions are all back.

## Rules

- JPEG, PNG, WebP and GIF. SVG is refused on purpose — it can run code — and named in the message, as
  are files over 20 MB and files that don't decode. When some files of a batch are refused, the
  message says both how many went in and which didn't.
- Pictures are stored no larger than 2000 px on the long side (photos as JPEG, transparent ones as
  PNG), with the camera's rotation applied; an animated GIF small enough is kept byte for byte.
- A document only names its pictures; their bytes live in a separate IndexedDB store. A document with
  three pictures saves as about 600 bytes of JSON, so long illustrated documents stay quick to save.
- All pictures of one paste or drop go in together and one undo takes them back; the cursor lands on a
  new line after them, so typing never replaces a picture.
- Pictures in pasted web pages are not downloaded (they would reach out to other sites); the page says
  they were removed. A document whose picture isn't on this device shows a placeholder with the
  description, and the caption stays.

## Where it lives

- `src/domain/03-images/` — `checkImageFile`, `fitWithin`, `figureBlock`, `assetsIn`, `altFromFileName`.
- `src/adapters/image-files.ts` (decoding and shrinking) and the `assets` store in
  `src/adapters/document-store.ts` (database version 2; version 1 databases are upgraded in place).
- `src/features/03-images/` — the figure node, its view, inserting and messages.
- Tests: `test/domain/03-images.test.ts`, `test/adapters/assets.test.ts`, `test/integration/03-images.test.tsx`.
