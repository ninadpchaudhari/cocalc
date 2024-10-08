/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

import { redux, Store, TypedMap } from "@cocalc/frontend/app-framework";
import target from "@cocalc/frontend/client/handle-target";
import { parse_target } from "../history";

type TopTab =
  | "about" // the "/help" page
  | "account"
  | "admin"
  | "help" // i.e., the support dialog that makes a ZenDesk ticket....
  | "project"
  | "projects"
  | "file-use"
  | "notifications";

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

export interface PageState {
  active_top_tab: TopTab; // key of the active tab
  show_connection: boolean;
  ping?: number;
  avgping?: number;
  connection_status: ConnectionStatus;
  connection_quality: "good" | "bad" | "flaky";
  new_version?: TypedMap<{ version: number; min_version: number }>;
  fullscreen?: "default" | "kiosk" | "project";
  test?: string; // test query in the URL
  cookie_warning: boolean;
  local_storage_warning: boolean;
  show_file_use: boolean;
  num_ghost_tabs: number;
  session?: string; // session query in the URL
  last_status_time?: Date;
  get_api_key?: string; // Set, e.g., when you visit https://cocalc.com/app?get_api_key=myapp -- see https://doc.cocalc.com/api/index.html#authentication
  kiosk_project_id?: string;

  // If true, a modal asking whether you want to use a project invite token appears.
  // This is 100% for avoiding tricking a user into clicking on a link and silently
  // adding them to a project.  If they are explicitly on purpose trying to use a project
  // invite token, then they will say yes. Otherwise, they will say no.
  popconfirm?: {
    title?;
    description?;
    open?: boolean;
    ok?: boolean;
    cancelText?: string;
    okText?: string;
  };

  settingsModal?: string;
}

export class PageStore extends Store<PageState> {}

export function init_store() {
  const DEFAULT_STATE: PageState = {
    active_top_tab: parse_target(target).page as TopTab,
    show_connection: false,
    connection_status: "connecting",
    connection_quality: "good",
    cookie_warning: false,
    local_storage_warning: false,
    show_file_use: false,
    num_ghost_tabs: 0,
  } as const;

  redux.createStore("page", PageStore, DEFAULT_STATE);
}
