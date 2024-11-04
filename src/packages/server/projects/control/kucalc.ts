/*
Compute client for use in Kubernetes cluster by the hub.

This **modifies the database** to get "something out there (manage-actions) to"
start and stop the project, copy files between projects, etc.
*/

import {
  BaseProject,
  CopyOptions,
  ProjectStatus,
  ProjectState,
  getProject,
} from "./base";
import { db } from "@cocalc/database";
import { callback2 } from "@cocalc/util/async-utils";
import { expire_time, is_valid_uuid_string, uuid } from "@cocalc/util/misc";

import getLogger from "@cocalc/backend/logger";
const winston = getLogger("project-control-kucalc");

class Project extends BaseProject {
  constructor(project_id: string) {
    super(project_id);
  }

  private async get(columns: string[]): Promise<{ [field: string]: any }> {
    return await callback2(db().get_project, {
      project_id: this.project_id,
      columns,
    });
  }

  async state(): Promise<ProjectState> {
    return (await this.get(["state"]))?.state ?? {};
  }

  async status(): Promise<ProjectStatus> {
    const status = (await this.get(["status"]))?.status ?? {};
    // In KuCalc the ports for various services are hardcoded constants,
    // and not actually storted in the database, so we put them here.
    // This is also hardcoded in kucalc's addons/project/image/init/init.sh (!)
    status["hub-server.port"] = 6000;
    status["browser-server.port"] = 6001;
    return status;
  }

  async start(): Promise<void> {
    if (this.stateChanging != null) return;
    winston.info(`start ${this.project_id}`);

    if ((await this.state()).state == "running") {
      winston.debug("start -- already running");
      return;
    }
    try {
      this.stateChanging = { state: "starting" };

      // TODO: once "manage" processes site licenses, we can remove this line!
      // Manage has to do the equivalent of this.computeQuota()
      await this.siteLicenseHook(false);
      await this.actionRequest("start");
      await this.waitUntilProject(
        (project) =>
          project.state?.state == "running" || project.action_request?.finished,
        120,
      );
    } finally {
      this.stateChanging = undefined;
    }
  }

  // TODO/ATTN: I don't think this is actualy used by kucalc yet.
  // In kucalc there's cluster2/addons/manage/image/src/k8s-control.coffee
  // which does a lot of this stuff *directly* via the database and
  // kubernetes.  It needs to be rewritten...
  async stop(): Promise<void> {
    if (this.stateChanging != null) return;
    winston.info("stop ", this.project_id);
    await this.closePayAsYouGoPurchases();
    if ((await this.state()).state != "running") {
      return;
    }
    try {
      this.stateChanging = { state: "stopping" };
      await this.actionRequest("stop");
      await this.waitUntilProject(
        (project) =>
          (project.state != null &&
            project.state != "running" &&
            project.state != "stopping") ||
          project.action_request?.finished,
        60,
      );
    } finally {
      this.stateChanging = undefined;
    }
  }

  async copyPath(opts: CopyOptions): Promise<string> {
    const dbg = this.dbg("copyPath");
    dbg(JSON.stringify(opts));
    if (opts.path == null) {
      throw Error("path must be specified");
    }
    opts.target_project_id = opts.target_project_id
      ? opts.target_project_id
      : this.project_id;
    opts.target_path = opts.target_path ? opts.target_path : opts.path;

    // check UUID are valid
    if (!is_valid_uuid_string(opts.target_project_id)) {
      throw Error(`target_project_id=${opts.target_project_id} is invalid`);
    }

    const copyID = uuid();
    dbg(`copyID=${copyID}`);

    // expire in 1 month
    const oneMonthSecs = 60 * 60 * 24 * 30;
    let expire: Date = expire_time(oneMonthSecs);

    if (opts.scheduled) {
      // we parse it if it is a string
      if (typeof opts.scheduled === "string") {
        const scheduledTS: number = Date.parse(opts.scheduled);

        if (isNaN(scheduledTS)) {
          throw new Error(
            `opts.scheduled = ${opts.scheduled} is not a valid date. Can't be parsed by Date.parse()`,
          );
        }

        opts.scheduled = new Date(scheduledTS);
      }

      if (opts.scheduled instanceof Date) {
        // We have to remove the timezone info, b/c the PostgreSQL field is without timezone.
        // Ideally though, this is always UTC, e.g. "2019-08-08T18:34:49".
        const d = new Date(opts.scheduled);
        const offset = d.getTimezoneOffset() / 60;
        opts.scheduled = new Date(d.getTime() - offset);
        opts.wait_until_done = false;
        dbg(`opts.scheduled = ${opts.scheduled}`);
        // since scheduled could be in the future, we want to expire it 1 month after that
        expire = new Date(
          Math.max(opts.scheduled.getTime(), Date.now()) + oneMonthSecs * 1000,
        );
      } else {
        throw new Error(
          `opts.scheduled = ${opts.scheduled} is not a valid date.`,
        );
      }
    }

    dbg("write query requesting the copy to happen to the database");

    await callback2(db()._query, {
      query: "INSERT INTO copy_paths",
      values: {
        "id                ::UUID": copyID,
        "time              ::TIMESTAMP": new Date(),
        "source_project_id ::UUID": this.project_id,
        "source_path       ::TEXT": opts.path,
        "target_project_id ::UUID": opts.target_project_id,
        "target_path       ::TEXT": opts.target_path,
        "overwrite_newer   ::BOOLEAN": opts.overwrite_newer,
        "public            ::BOOLEAN": opts.public,
        "delete_missing    ::BOOLEAN": opts.delete_missing,
        "backup            ::BOOLEAN": opts.backup,
        "bwlimit           ::TEXT": opts.bwlimit,
        "timeout           ::NUMERIC": opts.timeout,
        "scheduled         ::TIMESTAMP": opts.scheduled,
        "exclude           ::TEXT[]": opts.exclude,
        "expire            ::TIMESTAMP": expire,
      },
    });

    if (opts.wait_until_done == true) {
      dbg("waiting for the copy request to complete...");
      await this.waitUntilCopyFinished(copyID, 60 * 4);
      dbg("finished");
      return "";
    } else {
      dbg("NOT waiting for copy to complete");
      return copyID;
    }
  }

  private getProjectSynctable() {
    // this is all in coffeescript, hence the any type above.
    return db().synctable({
      table: "projects",
      columns: ["state", "action_request"],
      where: { "project_id = $::UUID": this.project_id },
      // where_function is a fast easy test for matching:
      where_function: (project_id) => project_id == this.project_id,
    });
  }

  private async actionRequest(action: "start" | "stop"): Promise<void> {
    await callback2(db()._query, {
      query: "UPDATE projects",
      where: { "project_id  = $::UUID": this.project_id },
      jsonb_set: {
        action_request: {
          action,
          time: new Date(),
          started: undefined,
          finished: undefined,
        },
      },
    });
  }

  private async waitUntilProject(
    until: (obj) => boolean,
    timeout: number, // in seconds
  ): Promise<void> {
    let synctable: any = undefined;
    try {
      synctable = this.getProjectSynctable();
      await callback2(synctable.wait, {
        until: () => until(synctable.get(this.project_id)?.toJS() ?? {}),
        timeout,
      });
    } finally {
      synctable?.close();
    }
  }

  private getCopySynctable(copyID: string): any {
    return db().synctable({
      table: "copy_paths",
      columns: ["started", "error", "finished"],
      where: { "id = $::UUID": copyID },
      where_function: (id) => id == copyID,
    });
  }

  private async waitUntilCopyFinished(
    copyID: string,
    timeout: number, // in seconds
  ): Promise<void> {
    let synctable: any = undefined;
    try {
      synctable = this.getCopySynctable(copyID);
      await callback2(synctable.wait, {
        until: () => synctable.getIn([copyID, "finished"]),
        timeout,
      });
      const err = synctable.getIn([copyID, "error"]);
      if (err) {
        throw Error(err);
      }
    } finally {
      synctable?.close();
    }
  }
}

export default function get(project_id: string): Project {
  return (getProject(project_id) as Project) ?? new Project(project_id);
}
