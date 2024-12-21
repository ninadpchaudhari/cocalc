/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

import { redux } from "@cocalc/frontend/app-framework";
import { filename_extension } from "@cocalc/util/misc";
import { file_associations } from "@cocalc/frontend/file-associations";
import React from "react";
import { AddCommentTitleBarButton } from "@cocalc/frontend/frame-editors/generic/comments/add-comment";
import { Icon } from "@cocalc/frontend/components/icon";

interface Props {
  is_current?: boolean;
  project_id: string;
  path: string;
}

const STYLE = {
  borderBottom: "1px solid lightgrey",
  borderRight: "1px solid lightgrey",
  padding: "0 5px",
  borderTopLeftRadius: "5px",
  borderTopRightRadius: "5px",
  color: "#337ab7",
  cursor: "pointer",
  width: "100%",
  fontSize: "10pt",
} as const;

const CURRENT_STYLE = {
  ...STYLE,
  ...{ background: "#337ab7", color: "white" },
} as const;

export const Path: React.FC<Props> = React.memo(
  ({ is_current, path, project_id }) => {
    const ext = filename_extension(path);
    const x = file_associations[ext];
    return (
      <div
        style={is_current ? CURRENT_STYLE : STYLE}
        onClick={(evt) => {
          // shift+clicking opens the given path as its own tab...
          if (!evt.shiftKey) return;
          const project_actions = redux.getProjectActions(project_id);
          project_actions.open_file({ path, foreground: true });
        }}
      >
        {x?.icon && <Icon name={x.icon} />} {path}
        <AddCommentTitleBarButton />
      </div>
    );
  },
);
