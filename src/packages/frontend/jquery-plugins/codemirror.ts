/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

// jquery plugins that involve codemirror.

import $ from "jquery";
import * as CodeMirror from "codemirror";
import { startswith } from "@cocalc/util/misc";
import { file_associations } from "../file-associations";

export function init() {
  // Attempt to syntax highlight all code blocks that have CSS class language-*.
  // This is done using CodeMirror in a way that is consistent with the rest
  // of cocalc (e.g., supported languages and how they are mapped to modes).
  // Used e.g., in markdown for
  // ```r
  // v <- c(1,2)
  // ```
  // Here language-[mode] will first see if "mode" is a filename extension and use
  // the corresponding mode, and otherwise fall back to the codemirror mode name.
  // @ts-ignore
  $.fn.highlight_code = function () {
    return this.each(function () {
      // @ts-ignore
      const that = $(this);
      for (const elt of that.find("code")) {
        for (const cls of elt.className.split(/\s+/)) {
          if (startswith(cls, "language-")) {
            const code = $(elt);
            const ext = cls.slice("language-".length);
            const spec = file_associations[ext];
            const mode = spec?.opts.mode ?? ext;
            // TODO: TEMPORARY HACK until we switch to next.js share server.
            // We do this because for the backend server-side rendering, there
            // is a global CodeMirror object with runMode support.
            ((window as any).CodeMirror ?? CodeMirror).runMode(
              code.text(),
              mode,
              elt,
            );
            code.addClass("cm-s-default");
            code.removeClass(cls);
          }
        }
      }
    });
  };
}
