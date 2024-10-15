/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

import { LanguageModel } from "@cocalc/util/db-schema/llm-utils";
import type * as immutable from "immutable";

export type NotebookMode = "edit" | "escape";

export type CellType = "raw" | "markdown" | "code" | "multi";

export type Scroll =
  | number
  | "cell visible"
  | "cell visible force"
  | "cell top"
  | "list up" // should probably have been called "page up" and "page down"...
  | "list down";

export type KernelInfo = immutable.Map<string, any>;

export type CellToolbarName =
  | "slideshow"
  | "attachments"
  | "tags"
  | "ids"
  | "metadata"
  | "create_assignment";

// TODO -- this is pretty complicated, but will be nice to nail down.
export type Cell = immutable.Map<string, any>;

export type Cells = immutable.Map<string, Cell>;

export interface Usage {
  mem: number; // MiB
  mem_limit: number;
  mem_alert: AlertLevel;
  mem_pct: number; // %
  cpu: number; // 1 core = 100%
  cpu_runtime: number; // seconds, wall-time (not cpu time)
  cpu_limit: number;
  cpu_alert: AlertLevel;
  cpu_pct: number; // 100% full container quota
  time_alert: AlertLevel;
}

export type AlertLevel = "low" | "mid" | "high" | "none";

export type BackendState =
  | "init"
  | "ready"
  | "spawning"
  | "starting"
  | "running";

export interface KernelSpec {
  name: string;
  display_name: string;
  language: string;
  interrupt_mode: string; // usually "signal"
  env: { [key: string]: string }; // usually {}
  metadata?: KernelMetadata;
  resource_dir: string;
  argv: string[]; // comamnd+args, how the kernel will be launched
}

export type KernelMetadata = {
  // top level could contain a "cocalc" key, containing special settings understood by cocalc
  cocalc?: {
    priority?: number; // level 10 means it is important, on short list of choices, etc. 1 is low priority, for older versions
    description: string; // Explains what the kernel is, eventually visible to the user
    url: string; // a link to a website with more info about the kernel
  } & {
    // nested string/string key/value dictionary
    [key: string]: string | Record<string, string>;
  };
};

export interface LLMTools {
  model: LanguageModel;
  setModel: (llm: LanguageModel) => void;
  toolComponents: {
    LLMCellTool;
    LLMError;
  };
}
