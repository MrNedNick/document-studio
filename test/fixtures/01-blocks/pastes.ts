/** What Word puts on the clipboard: conditional comments, mso styles, o:p and a font tag. */
export const word = `<html xmlns:o="urn:schemas-microsoft-com:office:office"><head><style>p.MsoNormal{margin:0}</style></head>
<body><!--[if gte mso 9]><xml><o:OfficeDocumentSettings/></xml><![endif]-->
<p class="MsoNormal" style="mso-line-height-alt:12pt"><b><span style="font-family:Calibri">Quarterly report</span></b><o:p></o:p></p>
<p class="MsoNormal"><font face="Arial">Revenue grew by <i>twelve</i> percent.</font><o:p></o:p></p></body></html>`;

/** What Google Docs puts there: a fake bold wrapper and emphasis as inline styles. */
export const googleDocs = `<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-1234"><p dir="ltr"><span style="font-weight:700;">Agenda</span></p><p dir="ltr"><span style="font-style:italic;">Draft</span><span> — please review</span></p></b>`;

/** Hostile markup: a script, an event handler, a javascript: link, an iframe and a style block. */
export const hostile = `<p onclick="steal()">Hello <a href="javascript:alert(1)">click</a> and <a href="https://example.org" onmouseover="x()">this</a></p><script>alert(1)</script><iframe src="https://evil.test"></iframe><style>body{display:none}</style><img src=x onerror="steal()">`;

/** Nothing readable: whitespace, a comment and a style. */
export const empty = `<!-- nothing --><style>p{}</style>   `;
