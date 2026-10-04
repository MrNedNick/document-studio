/** Excel's HTML: a style block, column widths, number formats and classes on every cell. */
export const excelHtml = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><style>.xl65{mso-number-format:"0.00"}</style></head><body>
<table border=0 cellpadding=0 cellspacing=0 width=256 style='border-collapse:collapse'>
<col width=128 span=2>
<tr height=20><td height=20 class=xl65 width=128>Region</td><td class=xl65 width=128>Revenue</td></tr>
<tr height=20><td height=20>North</td><td class=xl65 align=right x:num>1200.50</td></tr>
<tr height=20><td colspan=2 height=20>Total to follow</td></tr>
</table></body></html>`;

/** Excel's plain text for the same kind of range: tabs, and a quoted cell holding a line break and quotes. */
export const excelText = 'Item\tNote\r\nDesk\t"Two lines\r\nwith ""quotes"""\r\nChair\tplain\r\n';

/** Text with tabs that is not a table: rows of different widths. */
export const raggedText = "a\tb\nc\n";
