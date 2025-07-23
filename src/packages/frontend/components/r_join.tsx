/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

import { ReactNode } from "react";
import { len } from "@cocalc/util/misc";

export function r_join(
  components: ReactNode[],
  sep: ReactNode = ", "
): React.JSX.Element {
  const w: ReactNode[] = [];
  for (const c of components) {
    if (c != null) {
      w.push(c);
    }
  }
  const v: ReactNode[] = [];
  const n: number = len(w);
  for (let i: number = 0; i < w.length; i++) {
    const x: ReactNode = w[i];
    v.push(x);
    if (i < n - 1) {
      v.push(<span key={-i - 1}>{sep}</span>);
    }
  }
  return <>{v}</>;
}
