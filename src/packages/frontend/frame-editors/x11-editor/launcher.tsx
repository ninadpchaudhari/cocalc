/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

/*
X11 Window frame.
*/

import { debounce, keys, sortBy } from "lodash";
import { APPS } from "@cocalc/comm/x11-apps";
import { Button } from "@cocalc/frontend/antd-bootstrap";
import { Rendered, TypedMap, useRedux } from "@cocalc/frontend/app-framework";
import { Icon, isIconName } from "@cocalc/frontend/components";
import { Capabilities } from "@cocalc/frontend/project_configuration";
import { Actions } from "./actions";

function sort_apps(k): string {
  const label = APPS[k].label;
  const name = label ? label : k;
  return name.toLowerCase();
}

const APP_KEYS: ReadonlyArray<string> = Object.freeze(
  sortBy(keys(APPS), sort_apps),
);

interface Props {
  actions: Actions;
  name: string;
}

export function Launcher(props: Props) {
  const { actions, name } = props;

  const x11_apps: TypedMap<Capabilities> | undefined = useRedux(
    name,
    "x11_apps",
  );

  const launch = debounce(_launch, 1000, { leading: true, trailing: false });

  function _launch(app: string): void {
    const desc = APPS[app];
    if (desc == null) return;
    actions.launch(desc.command ? desc.command : app, desc.args);
  }

  function render_launcher(app: string): Rendered {
    const desc = APPS[app];
    if (desc == null) return;

    let icon: Rendered = undefined;
    if (desc.icon != null && isIconName(desc.icon)) {
      icon = <Icon name={desc.icon} style={{ marginRight: "5px" }} />;
    }

    return (
      <Button
        key={app}
        onClick={() => launch(app)}
        title={desc.desc}
        style={{ margin: "5px" }}
      >
        {icon}
        {desc.label ? desc.label : app}
      </Button>
    );
  }

  function render_launchers(): Rendered[] {
    // i.e. wait until we know which apps exist …
    const available = x11_apps;
    if (available == null) return [];
    // hide those apps, where we know for certain they're not available
    return APP_KEYS.filter((app) => {
      const avail = available.get(app);
      return avail !== false;
    }).map(render_launcher);
  }

  return (
    <div style={{ overflowY: "auto", padding: "5px" }}>
      {render_launchers()}
    </div>
  );
}
