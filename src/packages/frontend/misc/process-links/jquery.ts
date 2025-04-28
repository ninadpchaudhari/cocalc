/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

/*
Define a jQuery plugin that processes links:

 - Make all links open internally or in a new tab; etc.
 - Makes relative image, video, object and source paths work.
 - Handles anchor links
*/

import $ from "jquery";
import { redux } from "@cocalc/frontend/app-framework";
import processLinks from "./generic";

interface Options {
  href_transform?: (href: string, tag?: string) => string;
  project_id?: string;
  file_path?: string;
  doubleClick?: boolean;
}

export function init() {
  // @ts-ignore
  if ($.fn.process_smc_links != null) {
    return;
  }
  // @ts-ignore
  $.fn.process_smc_links = function (opts: Options) {
    // @ts-ignore
    processLinks(this, {
      urlTransform: opts?.href_transform,
      projectId: opts?.project_id,
      filePath: opts?.file_path,
      doubleClick: opts?.doubleClick,
      $,
      projectActions: redux.getActions("projects"),
    });
    return this;
  };
}
