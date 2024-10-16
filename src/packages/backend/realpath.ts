/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

// path is assumed relative to the HOME directory
// return value is also relative to HOME directory -- if it is
// a symlink to something outside of the HOME directory, we just
// return the input!  This is used for sync so this is the best
// we can do for now (see https://github.com/sagemathinc/cocalc/issues/4732)
import { realpath as fs_realpath } from "node:fs/promises";

// SMC_LOCAL_HUB_HOME is used for developing cocalc inside cocalc...
const HOME: string =
  process.env.SMC_LOCAL_HUB_HOME ?? process.env.HOME ?? "/home/user";

export default async function realpath(
  path: string,
  home?: string,
): Promise<string> {
  home = home ?? HOME;
  const fullpath = home + "/" + path;
  const rpath = await fs_realpath(fullpath);
  if (rpath == fullpath || !rpath.startsWith(home + "/")) {
    return path;
  }
  return rpath.slice((home + "/").length);
}
