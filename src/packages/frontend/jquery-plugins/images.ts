/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

import $ from "jquery";
import { startswith } from "@cocalc/util/misc";

export function init() {
  // Force reload all images by appending random query param to their src URL.
  // But not for base64 data images -- https://github.com/sagemathinc/cocalc/issues/3141
  // @ts-ignore
  $.fn.reload_images = function () {
    this.each(function () {
      // @ts-ignore -- $(this)
      for (const img of $(this).find("img")) {
        const src = $(img).attr("src");
        if (startswith(src, "data:")) {
          continue;
        }
        $(img).attr("src", src + "?" + Math.random());
      }
    });
  };

  // Pluging to support smc-image-scale attribute, which is used to implement certain
  // Jupyter kernels for Sage worksheets.
  // See https://github.com/sagemathinc/cocalc/issues/1192 and
  //     https://github.com/sagemathinc/cocalc/issues/4421
  // @ts-ignore
  $.fn.smc_image_scaling = function () {
    this.each(function () {
      // @ts-ignore -- $(this)
      for (const x of $(this).find("img")) {
        const y = $(x);
        // see https://github.com/sagemathinc/cocalc/issues/1192
        const img_scaling = y.attr("smc-image-scaling");
        if (img_scaling == null) {
          continue;
        }
        const img = y.get(0);
        if (img != null) {
          const scale_img = function () {
            const width = img.naturalWidth;
            const factor = parseFloat(img_scaling);
            if (!isNaN(factor)) {
              const new_width = width * factor;
              y.css("width", `${new_width}px`);
            } else {
              // fallback that is better than nothing!
              y.css("max-width", "800px");
            }
          };
          scale_img();
          img.onload = scale_img;
        }
      }
    });
  };
}
