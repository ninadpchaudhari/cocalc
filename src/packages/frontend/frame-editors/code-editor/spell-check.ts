/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

/*
Backend spell checking support
*/

import { filename_extension } from "@cocalc/util/misc";
import { exec, ExecOutput } from "../generic/client";
import { language } from "../../misc";
import { KNITR_EXTS } from "../latex-editor/constants";

interface Options {
  project_id: string;
  path: string;
  lang: string;
  time?: number;
}

export async function misspelled_words(
  opts: Options,
): Promise<string[] | string> {
  if (!opts.lang) {
    opts.lang = language();
  }
  if (opts.lang == "browser") return "browser";
  if (opts.lang === "disabled") {
    return [];
  }

  let mode: string;
  const ext = filename_extension(opts.path);
  if (ext == "html") {
    mode = "--mode=html";
  } else if (ext == "tex" || KNITR_EXTS.includes(ext)) {
    mode = "--mode=tex";
  } else {
    mode = "--mode=none";
  }

  let lang;
  switch (opts.lang) {
    case "default":
      lang = `--lang=${language()}`;
      break;
    case "disabled":
      lang = "";
      break;
    default:
      lang = `--lang=${opts.lang}`;
  }
  const command = `cat '${opts.path}' | aspell ${mode} ${lang} list | sort -u`;
  //console.log(command);

  const output: ExecOutput = await exec(
    {
      project_id: opts.project_id,
      command,
      bash: true,
      err_on_exit: true,
      aggregate: opts.time,
    },
    opts.path,
  );

  if (output.stderr) {
    throw Error(output.stderr);
  }

  return output.stdout.slice(0, output.stdout.length - 1).split("\n"); // have to slice final \n
}
