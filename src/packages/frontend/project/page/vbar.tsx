/*
 *  This file is part of CoCalc: Copyright © 2023 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

import { defineMessage } from "react-intl";

import { AccountStore } from "@cocalc/frontend/account";
import { redux } from "@cocalc/frontend/app-framework";

const FLYOUT_DEFAULT_DATE = new Date("2100-01-01");

// in the other_settings map
export const VBAR_KEY = "vertical_fixed_bar";

export const VBAR_EXPLANATION = defineMessage({
  id: "project.page.vbar.explanation",
  defaultMessage: `This feature modifies the functionality of the project's left-side button bar.
  By default, it displays buttons for full pages and small caret signs for flyout panels.
  When selecting the "full pages" option, only buttons are shown, and they open full pages upon clicking.
  Conversely, when opting for the "flyout panels" mode, only flyout panels expand upon clicking.
  In both of the latter cases, the alternative panel type can be displayed by shift-clicking on the corresponding button.`,
});

export const VBAR_OPTIONS = {
  both: defineMessage({
    id: "project.page.vbar.option.both",
    defaultMessage: "Full pages and flyout panels",
  }),
  flyout: defineMessage({
    id: "project.page.vbar.option.flyout",
    defaultMessage: "Buttons expand/collapse compact flyouts",
  }),
  full: defineMessage({
    id: "project.page.vbar.option.full",
    defaultMessage: "Buttons show full pages",
  }),
} as const;

// New users created after this date will have the default VBAR option set to "flyout"
function getDefaultVBAROption() {
  const store: AccountStore = redux.getStore("account");
  if (store == null) return "both";
  const created = store.get("created");
  // check that cretaed is a Date
  if (created == null || !(created instanceof Date)) return "both";
  // if created is after this date return "flyout", else "both"
  if (created > FLYOUT_DEFAULT_DATE) {
    return "flyout";
  } else {
    return "both";
  }
}

export function getValidVBAROption(
  vbar_setting: any,
): keyof typeof VBAR_OPTIONS {
  if (typeof vbar_setting !== "string" || VBAR_OPTIONS[vbar_setting] == null) {
    return getDefaultVBAROption();
  }
  return vbar_setting as keyof typeof VBAR_OPTIONS;
}
