/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

/*
Rendering output part of a Sage worksheet cell
*/

import { keys, cmp, len } from "@cocalc/util/misc";
import { FLAGS } from "@cocalc/util/sagews";
import type { OutputMessage, OutputMessages } from "./parse-sagews";
import RENDERERS from "./output-renderers";

interface Props {
  output: OutputMessages;
  flags?: string;
}

export default function CellOutput({ output, flags }: Props) {
  if (flags != null && flags.indexOf(FLAGS.hide_output) != -1) {
    return <span />;
  }

  function renderOutputMesg(elts: React.JSX.Element[], mesg: object): void {
    for (const type in mesg) {
      let value: any = mesg[type];
      let f = RENDERERS[type];
      if (f == null) {
        f = RENDERERS.stderr;
        value = `unknown message type '${type}'`;
      }
      elts.push(f(value, elts.length));
    }
  }

  function renderOutput(): React.JSX.Element[] {
    const elts: React.JSX.Element[] = [];
    for (const mesg of processMessages(output)) {
      renderOutputMesg(elts, mesg);
    }
    return elts;
  }

  return <div style={{ margin: "15px" }}>{renderOutput()}</div>;
}

// sort in order to a list and combine adjacent stdout/stderr messages.
const STRIP = ["done", "error", "once", "javascript", "hide", "show"]; // these are just deleted -- make no sense for static rendering.

function processMessages(output: OutputMessages): object[] {
  const v: string[] = keys(output);
  v.sort((a, b) => cmp(parseInt(a), parseInt(b)));
  let r: OutputMessage[] = [];
  for (const a of v) {
    const m = output[a];
    for (const s of STRIP) {
      if (m[s] != null) {
        delete m[s];
      }
    }
    const n = len(m);
    if (n === 0) {
      continue;
    }
    if (m.clear) {
      r = [];
      continue;
    }
    if (m.delete_last) {
      r.pop();
      continue;
    }
    if (r.length > 0 && n === 1) {
      if (m.stdout != null && r[r.length - 1].stdout != null) {
        r[r.length - 1] = { stdout: r[r.length - 1].stdout + m.stdout };
        continue;
      }
      if (m.stderr != null && r[r.length - 1].stderr != null) {
        r[r.length - 1] = { stderr: r[r.length - 1].stderr + m.stderr };
        continue;
      }
    }
    r.push(m);
  }
  return r;
}
