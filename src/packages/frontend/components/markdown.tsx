/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

import { HTML } from "./html";
import { markdown_to_html } from "../markdown";
import { Props as HTMLProps } from "./html";

type Props = HTMLProps & {
  // inject data attributes with line numbers to enable reverse search:
  line_numbers?: boolean;
};

export function Markdown(props: Props) {
  function to_html() {
    if (!props.value) {
      return;
    }
    return markdown_to_html(props.value, {
      line_numbers: props.line_numbers,
    });
  }

  return (
    <HTML
      id={props.id}
      auto_render_math={true}
      preProcessMath={false}
      value={to_html()}
      style={props.style}
      project_id={props.project_id}
      file_path={props.file_path}
      className={props.className}
      href_transform={props.href_transform}
      post_hook={props.post_hook}
      safeHTML={props.safeHTML ?? true}
      reload_images={props.reload_images}
      smc_image_scaling={props.smc_image_scaling}
      highlight_code={props.highlight_code ?? true}
      content_editable={props.content_editable}
      onClick={props.onClick}
      onDoubleClick={props.onDoubleClick}
    />
  );
}
