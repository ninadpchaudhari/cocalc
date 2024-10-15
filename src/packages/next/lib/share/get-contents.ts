/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

import { promises as fs } from "fs";
import { sortBy } from "lodash";
import { join } from "path";

import { pathToFiles } from "@cocalc/backend/files/path-to-files";
import { hasSpecialViewer } from "@cocalc/frontend/file-extensions";
import { getExtension } from "./util";

const MB: number = 1000000;

const LIMITS = {
  listing: 10000, // directory listing is truncated after this many files
  ipynb: 15 * MB,
  sagews: 10 * MB,
  whiteboard: 5 * MB,
  slides: 5 * MB,
  other: 2 * MB,
} as const;

export interface FileInfo {
  name: string;
  error?: Error;
  isdir?: boolean;
  size?: number;
  mtime?: number;
  url?: string; // if given and click on this file, goes here.  Can be used to make path canonical and is used for navigating github repos (say).
}

export interface PathContents {
  isdir?: boolean;
  listing?: FileInfo[];
  content?: string;
  size?: number;
  mtime?: number;
  truncated?: string;
}

export default async function getContents(
  project_id: string,
  path: string,
): Promise<PathContents> {
  const fsPath = pathToFiles(project_id, path);
  const obj: PathContents = {};

  // use lstat instead of stat so it works on symlinks too
  const stats = await fs.lstat(fsPath);
  obj.isdir = stats.isDirectory();
  obj.mtime = stats.mtime.valueOf();
  if (obj.isdir) {
    // get listing
    const { listing, truncated } = await getDirectoryListing(fsPath);
    obj.listing = listing;
    if (truncated) {
      obj.truncated = truncated;
    }
  } else {
    // get actual file content
    const ext = getExtension(fsPath);
    if (hasSpecialViewer(ext)) {
      if (stats.size >= (LIMITS[ext] ?? LIMITS.other)) {
        obj.truncated = "File too big to be displayed; download it instead.";
      } else {
        obj.content = (await fs.readFile(fsPath)).toString();
      }
    }
    obj.size = stats.size;
  }
  return obj;
}

async function getDirectoryListing(
  path: string,
): Promise<{ listing: FileInfo[]; truncated?: string }> {
  const listing: FileInfo[] = [];
  let truncated: string | undefined = undefined;
  for (const name of await fs.readdir(path)) {
    if (name.startsWith(".")) {
      // We never grab hidden files.  This is a public share server after all.
      continue;
    }
    const obj: FileInfo = { name };
    // use lstat instead of stat so it works on symlinks too
    try {
      const stats = await fs.lstat(join(path, name));
      if (stats.isDirectory()) {
        obj.isdir = true;
        // For a directory, we define "size" to be the number of items
        // in the directory.
        obj.size = (await fs.readdir(join(path, name))).length;
      } else {
        obj.size = stats.size;
      }
      obj.mtime = stats.mtime.valueOf();
    } catch (err) {
      obj.error = err;
    }
    listing.push(obj);
    if (listing.length >= LIMITS.listing) {
      truncated = `Too many files -- only showing ${LIMITS.listing} of them.`;
      break;
    }
  }
  return { listing: sortBy(listing, ["name"]), truncated };
}
