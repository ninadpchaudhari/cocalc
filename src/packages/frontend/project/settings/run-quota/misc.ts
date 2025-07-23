/*
 *  This file is part of CoCalc: Copyright © 2022 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

import { plural, round2 } from "@cocalc/util/misc";
import { PROJECT_UPGRADES } from "@cocalc/util/schema";
import { upgrades } from "@cocalc/util/upgrade-spec";
import { Quota } from "@cocalc/util/upgrades/quota";

export const QUOTAS_BOOLEAN = [
  "member_host",
  "network",
  "always_running",
  "ext_rw",
] as const;

export const SHOW_MAX: readonly string[] = [
  "disk_quota",
  "cpu_limit",
  "memory_limit",
] as const;

export const MAX_UPGRADES = upgrades.max_per_project;
export const PARAMS = PROJECT_UPGRADES.params;

export type RunQuotaType = Partial<Quota>;
export type Value = string | boolean | number;
export type DisplayQuota = { [key in keyof Quota]: Value };
export type Usage =
  | { display: string | undefined; element: React.JSX.Element | boolean }
  | undefined;
export type CurrentUsage = { [key in keyof RunQuotaType]: Usage };

export interface QuotaData {
  key: string;
  desc: string;
  quota: Value;
  quotaDedicated: Value | undefined;
  maximum: string | undefined;
  maxDedicated: string | undefined;
  display: string | undefined;
  usage: Usage;
}

export function renderValueUnit(val: number, unit: string): string {
  if (unit === "MB" && val >= 1000) {
    return `${round2(val / 1000)} GB`;
  } else {
    return `${round2(val)} ${plural(val, unit)}`;
  }
}

export function booleanValueStr(quota) {
  if (typeof quota === "boolean") {
    return quota ? "enabled" : "disabled";
  } else {
    return "N/A";
  }
}
