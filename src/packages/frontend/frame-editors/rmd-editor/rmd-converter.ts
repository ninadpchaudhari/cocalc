/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

/*
Convert R Markdown file to hidden Markdown file, then read.
*/

import { reuseInFlight } from "@cocalc/util/reuse-in-flight";
import { path_split } from "@cocalc/util/misc";
import { exec, ExecOutput } from "../generic/client";

export const convert = reuseInFlight(_convert);

async function _convert(
  project_id: string,
  path: string,
  frontmatter: string,
  hash,
): Promise<ExecOutput> {
  const x = path_split(path);
  const infile = x.tail;
  // console.log("frontmatter", frontmatter);
  let cmd: string;
  // https://www.rdocumentation.org/packages/rmarkdown/versions/1.10/topics/render
  // unless user specifies some self_contained value or user did set an explicit "output: ..." mode,
  // we disable it as a convenience (rough heuristic, but should be fine)
  if (
    frontmatter.indexOf("self_contained") >= 0 ||
    frontmatter.indexOf("output:") >= 0
  ) {
    cmd = `rmarkdown::render('${infile}', output_format = NULL, run_pandoc = TRUE)`;
  } else {
    cmd = `rmarkdown::render('${infile}', output_format = NULL, run_pandoc = TRUE, output_options = list(self_contained = FALSE))`;
  }

  return await exec(
    {
      timeout: 4 * 60,
      bash: true, // so timeout is enforced by ulimit
      command: "Rscript",
      args: ["-e", cmd],
      env: { MPLBACKEND: "Agg" }, // for python plots -- https://github.com/sagemathinc/cocalc/issues/4202
      project_id: project_id,
      path: x.head,
      err_on_exit: false,
      aggregate: { value: hash },
    },
    path,
  );
}
