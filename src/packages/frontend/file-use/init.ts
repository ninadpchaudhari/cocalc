/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

import { redux } from "../app-framework";

import { FileUseStore } from "./store";
import { FileUseActions } from "./actions";
import { FileUseTable } from "./table";

export function init() {
  redux.createStore("file_use", FileUseStore, { notify_count: 0 });
  const actions = redux.createActions("file_use", FileUseActions);

  // We only initialize the actual FileUseTable when not in kiosk
  // mode.  In kiosk mode, there is no point, and it wastes resources
  // since the user can never see notifications at all.  By not
  // initializing the FileUseTable, the Store stays empty.
  if (redux.getStore("page").get("fullscreen") != "kiosk") {
    redux.createTable("file_use", FileUseTable);
  }
  actions._init(); // must be after making store
}
