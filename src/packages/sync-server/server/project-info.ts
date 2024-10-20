/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

import { reuseInFlight } from "@cocalc/util/reuse-in-flight";
import { close } from "@cocalc/util/misc";
import { SyncTable } from "@cocalc/sync/table";
import {
  get_ProjectInfoServer,
  type ProjectInfoServer,
} from "@cocalc/sync-server/monitor/activity";
import { ProjectInfo } from "@cocalc/util/types/project-info/types";

class ProjectInfoTable {
  private table: SyncTable;
  private logger: { debug: Function };
  private project_id: string;
  private state: "ready" | "closed" = "ready";
  private readonly publish: (info: ProjectInfo) => Promise<void>;
  private readonly info_server: ProjectInfoServer;

  constructor(
    table: SyncTable,
    logger: { debug: Function },
    project_id: string,
  ) {
    this.project_id = project_id;
    this.logger = logger;
    this.log("register");
    this.publish = reuseInFlight(this.publish_impl.bind(this));
    this.table = table;
    this.table.on("closed", () => this.close());
    // initializing project info server + reacting when it has something to say
    this.info_server = get_ProjectInfoServer();
    this.info_server.start();
    this.info_server.on("info", this.publish);
  }

  private async publish_impl(info: ProjectInfo): Promise<void> {
    if (this.state == "ready" && this.table.get_state() != "closed") {
      const next = { project_id: this.project_id, info };
      this.table.set(next, "shallow");
      try {
        await this.table.save();
      } catch (err) {
        this.log(`error saving ${err}`);
      }
    } else if (this.log != null) {
      this.log(
        `ProjectInfoTable state = '${
          this.state
        }' and table is '${this.table?.get_state()}'`,
      );
    }
  }

  public close(): void {
    this.log("close");
    this.info_server?.off("info", this.publish);
    this.table?.close_no_async();
    close(this);
    this.state = "closed";
  }

  private log(...args): void {
    if (this.logger == null) return;
    this.logger.debug("project_info", ...args);
  }
}

let project_info_table: ProjectInfoTable | undefined = undefined;

export function register_project_info_table(
  table: SyncTable,
  logger: any,
  project_id: string,
): void {
  logger.debug("register_project_info_table");
  if (project_info_table != null) {
    logger.debug(
      "register_project_info_table: cleaning up an already existing one",
    );
    project_info_table.close();
  }
  project_info_table = new ProjectInfoTable(table, logger, project_id);
}

export function get_project_info_table(): ProjectInfoTable | undefined {
  return project_info_table;
}
