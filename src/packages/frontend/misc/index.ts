/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

export { BASE_URL } from "./base-url";
export { open_new_tab, open_popup_window } from "./open-browser-tab";
export * from "./misc";
export * from "./sanitize";
export * from "./language";
export * from "./iframe";
export * from "./cookies";
export * from "./tracking";
export * from "./sagews-canonical-mode";
export * from "./show-react-modal";

import "./bootstrap-fixes";

export {
  set_local_storage,
  get_local_storage,
  has_local_storage,
  delete_local_storage,
  local_storage_length,
} from "./local-storage";
