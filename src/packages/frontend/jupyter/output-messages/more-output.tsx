/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

import { Button } from "antd";
import { Icon } from "@cocalc/frontend/components/icon";
import React from "react";
import { Map } from "immutable";
import type { JupyterActions } from "@cocalc/jupyter/redux/actions";
import { all_fields_equal } from "@cocalc/util/misc";

interface MoreOutputProps {
  message: Map<string, any>;
  id: string;
  actions?: JupyterActions; // if not set, then can't get more output (button disabled)
}

function should_memoize(prev, next) {
  return all_fields_equal(prev, next, ["message", "id"]);
}

export const MoreOutput: React.FC<MoreOutputProps> = React.memo(
  (props: MoreOutputProps) => {
    const { id, message, actions } = props;

    if (actions == null || message.get("expired")) {
      return (
        <Button style={{ marginTop: "5px" }} disabled>
          <Icon name="eye-slash" /> Additional output not available
        </Button>
      );
    } else if (actions.fetch_more_output == null) {
      // e.g., on the share server, at least until we implement fetching additional output
      // there, which does make sense to do.
      return (
        <div style={{ margin: "15px", fontSize: "12pt" }}>
          Large output truncated: edit to see additional output
        </div>
      );
    } else {
      return (
        <Button
          onClick={() => {
            actions?.fetch_more_output(id);
          }}
          style={{ marginTop: "5px" }}
        >
          <Icon name="eye" /> Fetch additional output...
        </Button>
      );
    }
  },
  should_memoize,
);
