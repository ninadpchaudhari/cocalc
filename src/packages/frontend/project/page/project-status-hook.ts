/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */
import { React } from "@cocalc/frontend/app-framework";
import { webapp_client } from "@cocalc/frontend/webapp-client";
import { ProjectStatus as WSProjectStatus } from "../websocket/project-status";
import { ProjectStatus } from "@cocalc/comm/project-status/types";
import { ProjectActions } from "@cocalc/frontend/project_actions";
import { useProjectState } from "./project-state-hook";

// this records data from the synctable "project_status" in redux.
// used in page/page when a project is added to the UI
// if you want to know the project state, do
// const project_status = useTypedRedux({ project_id }, "status");
export function useProjectStatus(actions?: ProjectActions): void {
  const project_id: string | undefined = actions?.project_id;
  const statusRef = React.useRef<WSProjectStatus | null>(null);
  const project_state = useProjectState(project_id);

  function set_status(status) {
    actions?.setState({ status });
  }

  function connect() {
    if (project_id == null) {
      return;
    }
    const status_sync = webapp_client.project_client.project_status(project_id);
    statusRef.current = status_sync;
    const update = () => {
      const data = status_sync.get();
      if (data != null) {
        set_status(data.toJS() as ProjectStatus);
      } else {
        // For debugging:
        // console.warn(`status_sync ${project_id}: got no data`);
      }
    };
    status_sync.once("ready", update);
    status_sync.on("change", update);
  }

  // each time the project state changes to running (including when mounted) we connect/reconnect
  React.useEffect(() => {
    if (project_state == null) return;
    if (project_state.get("state") !== "running") return;
    try {
      connect();
      return () => {
        statusRef.current?.close();
      };
    } catch (err) {
      console.warn(`status_sync ${project_id} error: ${err}`);
    }
  }, [project_state]);
}
