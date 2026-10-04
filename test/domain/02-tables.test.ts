import { describe, expect, it } from "vitest";
import { cleanPastedHtml } from "../../src/domain/01-blocks";
import type { Block } from "../../src/domain/01-blocks";
import { checklistProgress, checkTable, emptyTable, matrixToTable, MAX_ROWS, parseDelimited } from "../../src/domain/02-tables";
import { excelHtml, excelText, raggedText } from "../fixtures/02-tables/clipboard";

describe("spreadsheet text", () => {
  it("reads Excel's tab-separated cells, quoted line breaks and doubled quotes included", () => {
    expect(parseDelimited(excelText)).toEqual([
      ["Item", "Note"],
      ["Desk", 'Two lines\nwith "quotes"'],
      ["Chair", "plain"],
    ]);
  });

  it("text with tabs but uneven rows, or one column, is not a table", () => {
    expect(parseDelimited(raggedText)).toBeNull();
    expect(parseDelimited("just words")).toBeNull();
  });
});

describe("tables", () => {
  it("builds a table with a header row, line breaks kept inside cells", () => {
    const table = matrixToTable(parseDelimited(excelText)!);
    expect(table.ok).toBe(true);
    const rows = table.ok ? table.value.content! : [];
    expect(rows[0]!.content!.map((c) => c.type)).toEqual(["tableHeader", "tableHeader"]);
    expect(rows[1]!.content![1]!.content![0]!.content).toEqual([{ type: "text", text: "Two lines" }, { type: "hardBreak" }, { type: "text", text: 'with "quotes"' }]);
  });

  it("an empty table of a given size, and the limits", () => {
    const table = emptyTable(3, 4);
    expect(table.ok && checkTable(table.value)).toEqual({ ok: true, value: { rows: 3, columns: 4 } });
    expect(matrixToTable([])).toMatchObject({ ok: false, error: { reason: "table-empty" } });
    expect(emptyTable(MAX_ROWS + 1, 2)).toMatchObject({ ok: false, error: { reason: "table-too-large", rows: MAX_ROWS + 1, columns: 2 } });
    expect(matrixToTable([["a", "b"], ["c"]])).toMatchObject({ ok: false, error: { reason: "table-ragged" } });
  });

  it("counts merged cells when checking that every row is as wide as the first", () => {
    const merged = {
      type: "table",
      content: [
        { type: "tableRow", content: [{ type: "tableCell", attrs: { rowspan: 2 } }, { type: "tableCell" }] },
        { type: "tableRow", content: [{ type: "tableCell" }] },
        { type: "tableRow", content: [{ type: "tableCell", attrs: { colspan: 2 } }] },
      ],
    };
    expect(checkTable(merged)).toEqual({ ok: true, value: { rows: 3, columns: 2 } });
    expect(checkTable({ ...merged, content: [...merged.content, { type: "tableRow", content: [{ type: "tableCell" }] }] })).toMatchObject({ ok: false, error: { reason: "table-ragged" } });
  });

  it("Excel's HTML keeps its table and merged cell, and loses its styling", () => {
    const cleaned = cleanPastedHtml(excelHtml);
    expect(cleaned.ok && cleaned.value.html).toBe(
      '<table><tbody><tr><td>Region</td><td>Revenue</td></tr><tr><td>North</td><td>1200.50</td></tr><tr><td colspan="2">Total to follow</td></tr></tbody></table>',
    );
  });
});

it("counts ticked checklist items, nested ones included", () => {
  const item = (checked: boolean, nested: Block[] = []): Block => ({ type: "taskItem", attrs: { checked }, content: [{ type: "paragraph" }, ...nested] });
  const body = { type: "doc", content: [{ type: "taskList", content: [item(true), item(false, [{ type: "taskList", content: [item(true)] }])] }] };
  expect(checklistProgress(body)).toEqual({ done: 2, total: 3 });
});
