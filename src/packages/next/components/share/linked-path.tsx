/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

import Link from "next/link";

import type { JSX } from "react";

interface Props {
  id: string;
  path: string;
  relativePath: string;
  isDir?: boolean;
}

export default function LinkedPath({ id, path, relativePath, isDir }: Props) {
  let href = `/share/public_paths/${id}`;
  const first = (
    <Link href={href} key={href}>
      {path}
    </Link>
  );
  const slash = (key) => <span key={"slash" + key}> / </span>;
  const segments: JSX.Element[] = [first, slash(href)];
  for (const segment of relativePath.split("/")) {
    if (!segment) continue;
    href += `/${encodeURIComponent(segment)}`;
    segments.push(
      <Link href={href} key={href}>
        {segment}
      </Link>
    );
    segments.push(slash(href));
  }
  if (!isDir) {
    segments.pop();
  }
  return <>{segments}</>;
}
