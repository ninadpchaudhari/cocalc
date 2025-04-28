/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

/*
Synctable that uses the project websocket rather than the database.
*/

import { delay } from "awaiting";

import { type SyncTable, synctable_no_database } from "@cocalc/sync/table";
import { once, retry_until_success } from "@cocalc/util/async-utils";
import { assertDefined } from "@cocalc/util/misc";
import { reuseInFlight } from "@cocalc/util/reuse-in-flight";
import type { AppClient } from "./types";

// Always wait at least this long between connect attempts.  This
// avoids flooding the project with connection requests if, e.g., the
// client limit for a particular file is reached.
const MIN_CONNECT_WAIT_MS = 5000;

interface Options {
  project_id: string;
  query: object;
  options: any[];
  client: AppClient;
  throttle_changes?: undefined | number;
  id: string;
}

import { EventEmitter } from "events";

class SyncTableChannel extends EventEmitter {
  public synctable?: SyncTable;
  private project_id: string;
  private client: AppClient;
  private channel?: any;
  private websocket?: any;
  private query: any;
  private options: any;
  private key: string;

  private last_connect: number = 0;

  private connected: boolean = false;

  constructor(opts: Options) {
    super();
    const { project_id, query, options, client, throttle_changes } = opts;
    if (query == null) {
      throw Error("query must be defined");
    }
    if (options == null) {
      throw Error("options must be defined");
    }
    this.key = key(opts);
    this.synctable = synctable_no_database(
      query,
      options,
      client,
      throttle_changes,
      [],
      project_id,
    );
    (this.synctable as any).channel = this; // for debugging
    this.project_id = project_id;
    this.client = client;
    this.query = query;
    this.options = options;
    this.init_synctable_handlers();

    this.connect = reuseInFlight(this.connect.bind(this));
    this.log = this.log.bind(this);
    this.connect();
  }

  public is_connected(): boolean {
    return this.connected;
  }

  private log = (..._args) => {
    //console.log("SyncTableChannel", this.query, ..._args);
  };

  private async connect(): Promise<void> {
    this.log("connect...");
    if (this.synctable == null) return;
    this.set_connected(false);
    this.clean_up_sockets();

    const time_since_last_connect = Date.now() - this.last_connect;
    if (time_since_last_connect < MIN_CONNECT_WAIT_MS) {
      // Last attempt to connect was very recent, so we wait a little before
      // trying again.
      await delay(MIN_CONNECT_WAIT_MS - time_since_last_connect);
    }

    await retry_until_success({
      max_delay: 5000,
      f: this.attempt_to_connect.bind(this),
      desc: "webapp-synctable-connect",
      log: this.log,
    });

    this.last_connect = Date.now();
  }

  private set_connected(connected: boolean): void {
    if (this.synctable == null) return;
    this.log("set_connected", connected);
    this.connected = connected;
    if (this.synctable.client.set_connected != null) {
      this.synctable.client.set_connected(connected);
    }
    if (connected) {
      this.emit("connected");
    } else {
      this.emit("disconnected");
    }
  }
  // Various things could go wrong, e.g., the websocket breaking
  // while trying to get the api synctable_channel, touch
  // project might time out, etc.
  private async attempt_to_connect(): Promise<void> {
    // Start with fresh websocket and channel -- old one may be dead.
    this.clean_up_sockets();
    // touch_project mainly makes sure that some hub is connected to
    // the project, so the project can do DB queries.  Also
    // starts the project.
    this.client.touch_project(this.project_id);
    // Get a websocket.
    this.websocket = await this.client.project_client.websocket(
      this.project_id,
    );
    if (this.websocket.state != "online") {
      // give websocket state one chance to change.
      // It could change to destroyed or online.
      this.log(
        "wait for websocket to connect since state is",
        this.websocket.state,
      );
      await once(this.websocket, "state");
    }
    if (this.websocket.state != "online") {
      // Already offline... let's try again from the top.
      this.log("websocket failed");
      throw Error("websocket went offline already");
    }

    this.log("Get a channel");
    const api = await this.client.project_client.api(this.project_id);
    this.channel = await api.synctable_channel(this.query, this.options);

    if (this.websocket.state != "online") {
      // Already offline... let's try again from the top.
      throw Error("websocket went offline already");
    }

    this.channel.on("data", this.handle_mesg_from_project.bind(this));
    this.websocket.on("offline", this.connect);
    this.channel.on("close", this.connect);
  }

  private init_synctable_handlers(): void {
    assertDefined(this.synctable);
    this.synctable.on("timed-changes", (timed_changes) => {
      this.send_mesg_to_project({ timed_changes });
    });
    this.synctable.once("closed", this.close.bind(this));
  }

  private clean_up_sockets(): void {
    if (this.channel != null) {
      this.channel.removeListener("close", this.connect);

      // Explicitly emit end -- this is a hack,
      // since this is the only way to force the
      // channel clean-up code to run in primus-multiplex,
      // and it gets run async later if we don't do this.
      // TODO: rewrite primus-multiplex from scratch.
      this.channel.emit("end");

      try {
        this.channel.end();
      } catch (err) {
        // no op -- this does happen if channel.conn is destroyed
      }
      delete this.channel;
    }

    if (this.websocket != null) {
      this.websocket.removeListener("offline", this.connect);
      delete this.websocket;
    }
  }

  private async close(): Promise<void> {
    delete cache[this.key];
    this.clean_up_sockets();
    if (this.synctable != null) {
      const s = this.synctable;
      delete this.synctable;
      await s.close();
    }
  }

  private handle_mesg_from_project(mesg): void {
    this.log("project --> client: ", mesg);
    if (this.synctable == null) {
      this.log("project --> client: NO SYNCTABLE");
      return; // can happen during close
    }
    if (mesg == null) {
      throw Error("mesg must not be null");
    }
    if (mesg.error != null) {
      const { alert_message } = this.client;
      const message = `Error opening file -- ${
        mesg.error
      } -- wait, restart your project or refresh your browser. Query=${JSON.stringify(
        this.query,
      )}`;
      if (alert_message != null) {
        alert_message({ type: "info", message, timeout: 10 });
      } else {
        console.warn(message);
      }
    }
    if (mesg.event == "message") {
      this.synctable.emit("message", mesg.data);
      return;
    }
    if (mesg.init != null) {
      this.log("project --> client: init_browser_client");
      this.synctable.init_browser_client(mesg.init);
      // after init message, we are now initialized
      // and in the connected state.
      this.set_connected(true);
    }
    if (mesg.versioned_changes != null) {
      this.log("project --> client: versioned_changes");
      this.synctable.apply_changes_to_browser_client(mesg.versioned_changes);
    }
  }

  private send_mesg_to_project(mesg): void {
    this.log("project <-- client: ", mesg);
    if (!this.connected) {
      throw Error("must be connected");
    }
    if (this.websocket == null) {
      throw Error("websocket must not be null");
    }
    if (this.channel == null) {
      throw Error("channel must not be null");
    }
    if (this.websocket.state != "online") {
      throw Error(
        `websocket state must be online but it is '${this.websocket.state}'`,
      );
    }
    this.channel.write(mesg);
  }
}

// We use a cache to ensure there is at most one synctable
// at a time with given defining parameters.  This is just
// for efficiency and sanity, so we use JSON.stringify instead
// of a guranteed stable json.
const cache: { [key: string]: SyncTableChannel } = {};

// ONLY uncomment when developing!
// (window as any).channel_cache = cache;

// The id here is so that the synctables and channels are unique
// **for a given syncdoc**.  There can be multiple syncdocs for
// the same underlying project_id/path, e.g.,
//    - when timetravel and a document are both open at the same time,
//    - when a document is closing (and saving offline changes) at the
//      same time that it is being opened; to see this disconnect from
//      the network, make changes, clocse the file tab, then open it
//      again, and reconnect to the network.
// See https://github.com/sagemathinc/cocalc/issues/3595 for why this
// opts.id below is so important.  I tried several different approaches,
// and this is the best by far.
function key(opts: Options): string {
  return `${opts.id}-${opts.project_id}-${JSON.stringify(
    opts.query,
  )}-${JSON.stringify(opts.options)}`;
}

// NOTE: This function can be called by a LOT of different things at once whenever
// waiting to connect to a project.  The "await once" inside it creates
// a listener on SyncTableChannel, and there is a limit on the number of
// those you can create without raising a limit (that was appearing in the
// console log a lot).  Thus our use of reuseInFlight to prevent this.
async function synctable_project0(opts: Options): Promise<SyncTable> {
  const k = key(opts);
  // console.log("key = ", k);
  let t;
  if (cache[k] !== undefined) {
    t = cache[k];
  } else {
    t = new SyncTableChannel(opts);
    cache[k] = t;
  }
  if (!t.is_connected()) {
    await once(t, "connected");
  }
  return t.synctable;
}

const synctable_project = reuseInFlight(synctable_project0, {
  createKey: (args) =>
    JSON.stringify([args[0].project_id, args[0].query, args[0].options]),
});

export default synctable_project;
