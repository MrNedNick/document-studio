# Exporting and transferring a document

Write a document, insert a table, add a picture and give it a caption. Undo the table insertion once
and redo it: exporting reads the editor's current content, even before the next autosave.

1. Choose **Export → Web page (HTML)**. Open the downloaded file with the network off: the words,
   table, picture, description and caption are there. Pictures are embedded as data URLs.
2. Choose **Print or save as PDF**. The browser's print dialog prints the same page, with readable
   table borders and pictures. Select Save as PDF or a printer. Paper size, margins and pagination
   come from the browser; this is browser printing rather than a separate PDF renderer.
3. Choose **Document file (.json)**. The file contains the document and only the pictures it uses.
   This is the editable backup and transfer format; HTML and PDF are reading copies.
4. Choose **Documents → Import…**, select the JSON file, and keep writing. It opens as a new copy,
   with new identifiers for the document and its pictures. The original remains in the list.
5. Reload. The imported copy, table, picture and caption return from storage.

A damaged file, an unsupported future format or missing picture bytes are refused with a reason.
Import writes the document and pictures in one transaction: a failed write leaves existing records
intact. A missing picture in an HTML export appears as a note with its description; JSON export is
refused until the picture is restored, so the backup cannot silently lose it.

All data stays in this browser; clearing site data removes the local documents. Keep downloaded
document files outside the browser for backups and for moving work between devices.
