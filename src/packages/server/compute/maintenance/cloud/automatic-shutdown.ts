/*
Manage automatic shutdown of compute servers.

Call this function to do the next round of checks.  Ideally this function
gets called once every minute.
*/

import getPool from "@cocalc/database/pool";
import getLogger from "@cocalc/backend/logger";
import callProject from "@cocalc/server/projects/call";
import {
  deprovision,
  suspend,
  start,
  stop,
} from "@cocalc/server/compute/control";
import { uuid } from "@cocalc/util/misc";
import type { ComputeServerEventLogEntry } from "@cocalc/util/compute/log";
import type { AutomaticShutdown } from "@cocalc/util/db-schema/compute-servers";
import { AUTOMATIC_SHUTDOWN_DEFAULTS } from "@cocalc/util/db-schema/compute-servers";

const DEFAULT_INTERVAL_M = AUTOMATIC_SHUTDOWN_DEFAULTS.INTERVAL_MINUTES;
const DEFAULT_ATTEMPTS = AUTOMATIC_SHUTDOWN_DEFAULTS.ATTEMPTS;

const logger = getLogger("server:compute:maintenance:cloud:automatic-shutdown");

export default async function automaticShutdown() {
  try {
    await update();
  } catch (err) {
    logger.debug("WARNING - issue running automatic shutdown update loop", err);
  }
}

const lastRun: { [id: number]: number } = {};
const numAttempts: { [id: number]: number } = {};

async function update() {
  const pool = getPool();
  const { rows } = await pool.query(
    "SELECT id, automatic_shutdown, account_id, project_id FROM compute_servers WHERE cloud!='onprem' AND state='running' AND automatic_shutdown#>>'{command}' != ''",
  );
  const now = Date.now();
  await Promise.all(
    rows
      .filter(
        ({ id, automatic_shutdown }) =>
          (now - (lastRun[id] ?? 0)) / (1000 * 60) >=
          (automatic_shutdown.interval_minutes ?? DEFAULT_INTERVAL_M),
      )
      .map(updateComputeServer),
  );
}

async function updateComputeServer({
  id,
  account_id,
  project_id,
  automatic_shutdown,
}: {
  id: number;
  account_id: string;
  project_id: string;
  automatic_shutdown: AutomaticShutdown;
}) {
  lastRun[id] = Date.now();
  try {
    const { command, exit_code, timeout, action = "stop" } = automatic_shutdown;
    // run command on the compute server using the api
    let resp;
    try {
      logger.debug("run check on ", { compute_server_id: id, project_id });
      resp = await callProject({
        account_id,
        project_id,
        mesg: {
          event: "project_exec",
          project_id,
          compute_server_id: id,
          command,
          timeout,
          bash: true,
          err_on_exit: false,
        },
      });
      if (resp.event == "error") {
        throw Error(resp.error);
      }
      logger.debug("ran a check", { id, resp });
    } catch (err) {
      logger.debug(`failed to run check: ${err}`);
      resp = null;
    }
    if (
      resp == null ||
      (exit_code != null && resp.exit_code == exit_code) ||
      (exit_code == null && resp.exit_code)
    ) {
      const { attempts = DEFAULT_ATTEMPTS } = automatic_shutdown;
      const cur = (numAttempts[id] ?? 0) + 1;
      if (cur < attempts) {
        logger.debug("YES consider shutdown -- but will retry:", {
          id,
          cur,
          attempts,
        });
        numAttempts[id] = cur;
        return;
      }
      logger.debug(
        "YES consider shutdown -- will do shutdown since all attempts used up",
        { id, cur, attempts },
      );
      delete numAttempts[id];
      await createProjectLogEntry({
        id,
        automatic_shutdown,
        account_id,
        project_id,
      });
      if (action == "suspend") {
        await suspend({ account_id, id });
      } else {
        // do the action.
        // always stop first
        await stop({ account_id, id });
        // then possibly delete or start:
        if (action == "restart") {
          await start({ account_id, id });
        } else if (action == "deprovision") {
          await deprovision({ account_id, id });
        }
      }
    } else {
      // success
      logger.debug("do NOT shutdown", { id });
      delete numAttempts[id];
    }
  } catch (err) {
    logger.debug(
      "WARNING - issue running automatic shutdown update loop on compute server",
      id,
      err,
    );
  }
}

async function createProjectLogEntry({
  id,
  account_id,
  project_id,
  automatic_shutdown,
}: {
  id: number;
  account_id: string;
  project_id: string;
  automatic_shutdown: AutomaticShutdown;
}) {
  const pool = getPool();
  await pool.query(
    "INSERT INTO project_log(id, project_id, account_id, time, event) VALUES($1,$2,$3,NOW(),$4)",
    [
      uuid(),
      project_id,
      account_id,
      {
        event: "compute-server",
        action: "automatic-shutdown",
        automatic_shutdown,
        server_id: id,
      } as ComputeServerEventLogEntry,
    ],
  );
}
