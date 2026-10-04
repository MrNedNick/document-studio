# Example: tables and lists

## Try it

```bash
npm run dev
```

1. **▦ Insert table** puts a 3 × 3 table with a header row at the cursor. Tab and Shift+Tab move between
   cells; Tab in the last cell adds a row. While the cursor is in a table, a bar above the document adds
   rows and columns on either side, deletes them, toggles the header row or deletes the table.
2. Undo right after inserting a table takes the whole table away in one step; redo brings it back.
   Undoing text typed in a cell leaves the table where it is.
3. Copy a range in Excel, Numbers or Google Sheets and paste it: you get a real table — merged cells
   stay merged, number formats, widths and styles don't come along. Pasted as plain text (or from a
   terminal), tab-separated cells become a table too, with the first row as its header; a cell holding
   a line break keeps it.
4. **•**, **1.** and **☑** make bulleted, numbered and checklist items. Ticked items are struck through,
   and the status line counts them: "Checklist: 2 of 5 done".
5. Reload: tables, lists and ticks are all back.

## Rules

- A table is at most 500 rows by 30 columns: a bigger range is a spreadsheet, and pasting it is refused
  with its size, so you can paste a smaller part.
- Text with tabs is a table only when every line has the same number of cells and there are at least
  two columns — otherwise it is pasted as ordinary text.
- Merged cells are counted when a table is checked: every row must cover as many columns as the first.

## Where it lives

- `src/domain/02-tables/` — `parseDelimited`, `matrixToTable`, `emptyTable`, `checkTable`, `checklistProgress`.
- `src/features/02-tables/` — the table bar and its messages; the editor wires in Tiptap's table and
  task list extensions.
- Tests: `test/domain/02-tables.test.ts`, `test/integration/02-tables.test.tsx`.
