/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

/*
 * license
 */

// A Patch is an entry in the patches table, as represented in memory locally here.

import { SyncTable } from "@cocalc/sync/table/synctable";

import type { ExecuteCodeOptionsWithCallback } from "@cocalc/util/types/execute-code";

export interface Patch {
  time: Date; // timestamp of when patch made
  patch: CompressedPatch /* compressed format patch (stored as a
                   JSON *string* in database, but array/object here) */;
  user_id: number /* 0-based integer "id" of user
                     syncstring table has id-->account_id map) */;
  snapshot?: string; // to_str() applied to the document at this point in time
  sent?: Date; // when patch actually sent, which may be later than when made
  prev?: Date; // timestamp of previous patch sent from this session
  size: number; // size of the patch (by defn length of string representation)
  heads?: number[]; // heads known by this client when patch was created
}

export interface Document {
  apply_patch(CompressedPatch): Document;
  make_patch(Document): CompressedPatch;
  is_equal(Document): boolean;
  to_str(): string;
  set(any): Document; // returns new document with result of set
  get(any?): any; // returns result of get query on document (error for string)
  get_one(any?): any; // returns result of get_one query on document (error for string)
  delete(any?): Document; // delete something from Document (error for string)

  // optional info about what changed going from prev to this.
  changes(prev?: Document): any;
  // how many in this document (length of string number of records in db-doc, etc.)
  count(): number;
}

export type CompressedPatch = any[];

export interface FileWatcher {
  on: (event: string, handler: Function) => void;
  close: () => void;
}

/* This is what we need from the "client".
There's actually a completely separate client
that runs in the browser and one on the project,
but anything that has the following interface
might work... */
import { EventEmitter } from "events";

export interface ProjectClient extends EventEmitter {
  server_time: () => Date;
  is_project: () => boolean;
  is_browser: () => boolean;
  is_compute_server: () => boolean;
  is_connected: () => boolean;
  is_signed_in: () => boolean;
  dbg: (desc: string) => Function;

  query: (opts: { query: any; cb: Function }) => void;

  // Only required to work on project client.
  path_access: (opts: { path: string; mode: string; cb: Function }) => void;

  path_exists: (opts: { path: string; cb: Function }) => void;

  path_stat: (opts: { path: string; cb: Function }) => void;

  path_read: (opts: {
    path: string;
    maxsize_MB?: number;
    cb: Function;
  }) => Promise<void>;

  write_file: (opts: {
    path: string;
    data: string;
    cb: Function;
  }) => Promise<void>;

  watch_file: (opts: { path: string }) => FileWatcher;

  synctable_project: (
    project_id: string,
    query: any,
    options: any,
    throttle_changes?: number,
    id?: string,
  ) => Promise<SyncTable>;

  // account_id or project_id or compute_server_id (encoded as a UUID - use decodeUUIDtoNum to decode)
  client_id: () => string;

  is_deleted: (
    filename: string,
    project_id?: string,
  ) => boolean | undefined | null;
  set_deleted: (filename: string, project_id?: string) => void;

  ipywidgetsGetBuffer?: (
    project_id: string, // id of the project
    path: string, // path = name of ipynb file
    model_id: string, // id of the ipywidgets model
    buffer_path: string, // JSON.stringify(['binary','buffer','path'])
  ) => ArrayBuffer;
}

export interface Client extends ProjectClient {
  log_error: (opts: {
    project_id: string;
    path: string;
    string_id: string;
    error: any;
  }) => void;

  mark_file: (opts: {
    project_id: string;
    path: string;
    action: string;
    ttl: number;
  }) => void;

  synctable_database: (
    query: any,
    options: any,
    throttle_changes?: number,
  ) => Promise<SyncTable>;

  shell: (opts: ExecuteCodeOptionsWithCallback) => void;

  sage_session: (opts: { path: string }) => any;
}

export interface DocType {
  type: string;
  patch_format?: number; // 0=string or 1=dbdoc, if given
  opts?: { [key: string]: any };
}
