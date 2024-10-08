/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

// Manage codemirror gutters that highlight latex typesetting issues.
//
// NOTE: If there are multiple errors/warnings/etc., on the SAME line, only the last
// one gets a gutter mark, with pref to errors.  The main error log shows everything, so this should be OK.

import { Popover } from "antd";

import { Icon } from "@cocalc/frontend/components";
//import { Actions } from "@cocalc/frontend/frame-editors/code-editor/actions";
import { Localize } from "@cocalc/frontend/app/localize";
import HelpMeFix from "@cocalc/frontend/frame-editors/llm/help-me-fix";
import { capitalize } from "@cocalc/util/misc";
import { Actions } from "./actions";
import { SPEC, SpecItem } from "./errors-and-warnings";
import { Error, IProcessedLatexLog } from "./latex-log-parser";

export function update_gutters(opts: {
  log: IProcessedLatexLog;
  set_gutter: Function;
  actions: Actions;
}): void {
  for (const group of ["typesetting", "warnings", "errors"]) {
    // errors last so always shown if multiple issues on a single line!
    let item: Error;
    for (item of opts.log[group]) {
      if (!item.file) continue;
      if (item.line == null) {
        /* no gutter mark in a line if there is no line number, e.g., "there were missing refs" */
        continue;
      }
      opts.set_gutter(
        item.file,
        item.line - 1,
        component(
          item.level,
          item.message,
          item.content,
          opts.actions,
          group,
          item.line,
        ),
      );
    }
  }
}

function component(
  level: string,
  message: string,
  content: string | undefined,
  actions: Actions,
  group: string,
  line: number,
) {
  const spec: SpecItem = SPEC[level];
  if (content === undefined) {
    content = message;
    message = capitalize(level);
  }
  // NOTE/BUG: despite allow_touch true below, this still does NOT work on my iPad -- we see the icon, but nothing
  // happens when clicking on it; this may be a codemirror issue.
  // NOTE: the IntlProvider (in Localize) is necessary, because this is mounted outside the application's overall context.
  // TODO: maybe make this part of the application react root.
  return (
    <Localize>
      <Popover
        title={message}
        content={
          <div>
            {content}
            {group == "errors" && (
              <>
                <br />
                <HelpMeFix
                  size="small"
                  style={{ marginTop: "5px" }}
                  task={"ran latex"}
                  error={content}
                  input={() => {
                    const s = actions._syncstring.to_str();
                    const v = s
                      .split("\n")
                      .slice(0, line + 1)
                      .join("\n");
                    //line+1 since lines are 1-based
                    return v + `% this is line number ${line + 1}`;
                  }}
                  language={"latex"}
                  extraFileInfo={actions.languageModelExtraFileInfo()}
                  tag={"latex-error-popover"}
                  prioritize="end"
                />
              </>
            )}
          </div>
        }
        placement={"right"}
        mouseEnterDelay={0}
      >
        <Icon
          name={spec.icon}
          style={{ color: spec.color, cursor: "pointer" }}
        />
      </Popover>
    </Localize>
  );
}
