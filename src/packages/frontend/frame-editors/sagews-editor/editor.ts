/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

/*
Top-level react component for editing Sage Worksheets.

Ultimately we'll have several views:

 - a single document view: one big editor, with output widgets (using either codemirror+hacks or prosemirror.)
 - cells view: many codemirror editors, one for each cell

Maybe
 - raw JSON lines view
 - just the input cells
 - just the output from that inputs
*/

import { createEditor } from "../frame-tree/editor";
import { EditorDescription } from "../frame-tree/types";
import { set } from "@cocalc/util/misc";
import { CellWorksheet } from "./cell-worksheet";
import { DocumentWorksheet } from "./document-worksheet";
//import { Print } from "./print";
import { terminal } from "../terminal-editor/editor";

const worksheetCommands = set([
  "print",
  "decrease_font_size",
  "increase_font_size",
  "save",
  "time_travel",
  "replace",
  "find",
  "goto_line",
  "cut",
  "paste",
  "copy",
  "undo",
  "redo",
  "format",
]);

const cells: EditorDescription = {
  type: "sagews-cells",
  short: "Cells",
  name: "Cell Worksheet",
  icon: "minus-square",
  component: CellWorksheet as any, // TODO: rclass wrapper does not fit the EditorDescription type
  commands: worksheetCommands,
} as const;

const document: EditorDescription = {
  type: "sagews-document",
  short: "Document",
  name: "Document Worksheet",
  icon: "file-alt",
  component: DocumentWorksheet as any, // TODO: rclass wrapper does not fit the EditorDescription type
  commands: worksheetCommands,
} as const;

const EDITOR_SPEC = {
  cells,
  document,
  terminal,
  /*,
  print: {
    short: "Print",
    name: "Printable View",
    icon: "print",
    component: Print,
    commands: set(["print"])
  }*/
} as const;

/* Ideas:

- Editor that focuses on a single cell.
- Exporting to different formats
- Slideshow
- Sage documentation (e.g., the entire reference manual)
- Snippets
- Terminal (interface to running sage server)
- List of variables you have defined

All this for sagews *or* .ipynb...

- Bash mode cell that becomes part of document.
*/

export const Editor = createEditor({
  format_bar: true,
  editor_spec: EDITOR_SPEC,
  display_name: "SageWorksheetEditor",
});
