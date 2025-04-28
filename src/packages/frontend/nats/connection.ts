/*
This should work for clients just like a normal NATS connection, but it
also dynamically reconnects to adjust permissions for projects
a browser client may connect to.

This is needed ONLY because:

 - in NATS you can't change the permissions of an existing
   connection when auth is done via auth-callout like we're doing.
   This could become possible in the future, with some change
   to the NATS server. Or maybe I just don't understand it.

 - There is a relatively small limit on the number of permissions for
   one connection, which must be explicitly listed on creation of
   the connection.   However, in CoCalc, a single account can be a
   collaborator on 20,000+ projects, and connect to any one of them
   at any time.


The other option would be to have a separate nats connection for each
project that the browser has open.  This is also viable and probably
simpler.  We basically do that with primus.  The drawbacks:

 - browsers limit the number of websockets for a tab to about 200
 - more connections ==> more load on nats and limits scalability

I generally "feel" like this should be the optimal approach given
all the annoying constraints.  We will likely do something
involving always including recent projects.

---

Subscription Leaks:

This code in a browser is useful for monitoring the number of subscriptions:

setInterval(()=>console.log(cc.redux.getStore('page').get('nats').toJS().data.numSubscriptions),1000)

If things are off, look at

cc.client.nats_client.refCacheInfo()
*/

import { appBasePath } from "@cocalc/frontend/customize/app-base-path";
import { webapp_client } from "@cocalc/frontend/webapp-client";
import { join } from "path";
import type {
  NatsConnection,
  ServerInfo,
  Payload,
  PublishOptions,
  RequestOptions,
  Msg,
  SubscriptionOptions,
  RequestManyOptions,
  Stats,
  Status,
  Subscription,
} from "@nats-io/nats-core";
import { connect as natsConnect } from "nats.ws";
import { inboxPrefix } from "@cocalc/nats/names";
import { CONNECT_OPTIONS } from "@cocalc/util/nats";
import { EventEmitter } from "events";
import { reuseInFlight } from "@cocalc/util/reuse-in-flight";
import { asyncDebounce } from "@cocalc/util/async-utils";
import { delay } from "awaiting";
import {
  getPermissionsCache,
  type NatsProjectPermissionsCache,
} from "./permissions-cache";
import { isEqual } from "lodash";
import { alert_message } from "@cocalc/frontend/alerts";
import jsonStable from "json-stable-stringify";

const MAX_SUBSCRIPTIONS = 400;

// When we create a new connection to change permissions (i.e., open a project
// we have not opened in a while), we wait this long before draining the
// old connection.  Draining immediately should work fine and be more efficient;
// however, it might cause more "disruption".  On the other hand, this might
// mask a subtle bug hence set this to 0 for some debugging purposes.
const DELAY_UNTIL_DRAIN_PREVIOUS_CONNECTION_MS = 30 * 1000;
// for debugging/testing
// const DELAY_UNTIL_DRAIN_PREVIOUS_CONNECTION_MS = 0;

function natsWebsocketUrl() {
  return `${location.protocol == "https:" ? "wss" : "ws"}://${location.host}${join(appBasePath, "nats")}`;
}

function connectingMessage({ server, project_ids }) {
  console.log(
    `Connecting to ${server} to use ${JSON.stringify(project_ids)}...`,
  );
}

const getNewNatsConn = reuseInFlight(async ({ cache, user }) => {
  const account_id = await getAccountId();
  if (!account_id) {
    throw Error("you must be signed in before connecting to NATS");
  }
  const server = natsWebsocketUrl();
  const project_ids = cache.get();
  connectingMessage({ server, project_ids });
  const options = {
    name: jsonStable(user),
    user: `account-${account_id}`,
    ...CONNECT_OPTIONS,
    servers: [server],
    inboxPrefix: inboxPrefix({ account_id }),
  };
  while (true) {
    try {
      console.log("Connecting to NATS...");
      return await natsConnect(options);
    } catch (err) {
      console.log(`WARNING: failed to connect to NATS -- will retry -- ${err}`);
      await delay(3000);
    }
  }
});

// This is a hack to get around circular import during initial page load.
// TODO: properly clean up the import order
async function getAccountId() {
  try {
    return webapp_client.account_id;
  } catch {
    await delay(1);
    return webapp_client.account_id;
  }
}

let cachedConnection: CoCalcNatsConnection | null = null;
export const connect = reuseInFlight(async () => {
  if (cachedConnection != null) {
    return cachedConnection;
  }
  const account_id = await getAccountId();
  const cache = getPermissionsCache();
  const project_ids = cache.get();
  const user = { account_id, project_ids };
  const nc = await getNewNatsConn({ cache, user });
  cachedConnection = new CoCalcNatsConnection(nc, user, cache);
  return cachedConnection;
});

// There should be at most one single global instance of CoCalcNatsConnection!  It
// is responsible for managing any connection to nats.  It is assumed that nothing else
// does and that there is only one of these.
class CoCalcNatsConnection extends EventEmitter implements NatsConnection {
  conn: NatsConnection;
  prev: NatsConnection[] = [];
  private standbyMode = false;
  info?: ServerInfo;
  protocol;
  options;
  user: { account_id: string; project_ids: string[] };
  permissionsCache: NatsProjectPermissionsCache;
  currStatus?;

  constructor(conn, user, permissionsCache) {
    super();
    this.setMaxListeners(500);
    this.conn = conn;
    this.protocol = conn.protocol;
    this.info = conn.info;
    this.options = conn.options;
    this.user = {
      project_ids: uniq(user.project_ids),
      account_id: user.account_id,
    };
    this.permissionsCache = permissionsCache;
    this.updateCache();
  }

  standby = () => {
    if (this.standbyMode) {
      return;
    }
    this.standbyMode = true;
    // standby is used when you are idle, so you should have nothing important to save.
    // Also, we can't get rid of this.conn until we have a new connection, which would make
    // no sense here.... so we do NOT use this.conn.drain().
    this.conn.close();
    // @ts-ignore
    if (this.conn.protocol) {
      // @ts-ignore
      this.conn.protocol.connected = false;
    }
  };

  resume = async () => {
    console.log("nats connection: resume");
    if (!this.standbyMode) {
      console.log("nats connection: not in standby mode");
      return;
    }
    this.standbyMode = false;
    // @ts-ignore
    if (this.conn.protocol?.connected) {
      console.log("nats connection: already connected");
      return;
    }
    console.log("nats connection: getNewNatsConn");
    const conn = await getNewNatsConn({
      cache: this.permissionsCache,
      user: this.user,
    });
    console.log("nats connection: got conn");
    // @ts-ignore
    this.conn = conn;
    // @ts-ignore
    this.protocol = conn.protocol;
    // @ts-ignore
    this.info = conn.info;
    // @ts-ignore
    this.options = conn.options;
    this.emit("reconnect");
  };

  // gets *actual* projects that this connection has permission to access
  getProjectPermissions = async (): Promise<string[]> => {
    const info = await this.getConnectionInfo();
    const project_ids: string[] = [];
    for (const x of info.data.permissions.publish.allow) {
      if (x.startsWith("project.")) {
        const v = x.split(".");
        project_ids.push(v[1]);
      }
    }
    return project_ids;
  };

  // one time on first connection we set the cache to match
  // the actual projects, so we don't keep requesting ones we
  // don't have access to, e.g., on sign out, then sign in as
  // different user (or being removed as collaborator).
  private updateCache = async () => {
    try {
      this.permissionsCache.set(await this.getProjectPermissions());
    } catch {}
  };

  getConnectionInfo = async () => {
    return await webapp_client.nats_client.info(this.conn);
  };

  private subscriptionPenalty = 20000;
  numSubscriptions = () => {
    // @ts-ignore
    let subs = this.conn.protocol.subscriptions.subs.size;
    for (const nc of this.prev) {
      // @ts-ignore
      subs += nc.protocol.subscriptions.subs.size;
    }
    if (subs >= MAX_SUBSCRIPTIONS) {
      // For now, we put them in standby for a bit
      // then resume.  This saves any work and disconnects them.
      // They then get reconnected.  This might help.
      console.warn(
        `WARNING: Using ${subs} subscriptions which exceeds the limit of ${MAX_SUBSCRIPTIONS}.`,
      );
      alert_message({
        type: "warning",
        message:
          "Your browser is using too many resources; refresh your browser or close some files.",
      });
      this.standby();
      this.subscriptionPenalty *= 1.25;
      setTimeout(this.resume, this.subscriptionPenalty);
    }
    return subs;
  };

  getSubscriptions = (): string[] => {
    const subjects: string[] = [];
    // @ts-ignore
    for (const sub of this.conn.protocol.subscriptions.subs) {
      subjects.push(sub[1].subject);
    }
    return subjects;
  };

  addProjectPermissions = async (project_ids: string[]) => {
    this.permissionsCache.add(project_ids);
    await this.updateProjectPermissions();
  };

  // this is debounce since adding permissions tends to come in bursts:
  private updateProjectPermissions = asyncDebounce(
    async () => {
      let project_ids = this.permissionsCache.get();
      if (isEqual(this.user.project_ids, project_ids)) {
        // nothing to do
        return;
      }
      const account_id = await getAccountId();
      if (!account_id) {
        throw Error("you must be signed in before connecting to NATS");
      }
      const user = {
        account_id,
        project_ids,
      };
      const server = natsWebsocketUrl();
      connectingMessage({ server, project_ids });
      const options = {
        // name: used to convey who we claim to be:
        name: jsonStable(user),
        // user: displayed in logs
        user: `account-${account_id}`,
        ...CONNECT_OPTIONS,
        servers: [server],
        inboxPrefix: inboxPrefix({ account_id }),
      };
      const cur = this.conn;
      const conn = (await natsConnect(options)) as any;

      this.conn = conn;
      this.prev.push(cur);
      this.currStatus?.stop();

      this.protocol = conn.protocol;
      this.info = conn.info;
      this.options = options;
      this.user = user;
      // tell clients they should reconnect, since the connection they
      // had used is going to drain soon.
      this.emit("reconnect");
      // we wait a while, then drain the previous connection.
      // Since connection usually change rarely, it's fine to wait a while,
      // to minimize disruption.  Make this short as a sort of "bug stress test".
      delayThenDrain(cur, DELAY_UNTIL_DRAIN_PREVIOUS_CONNECTION_MS);
    },
    1000,
    { leading: true, trailing: true },
  );

  async closed(): Promise<void | Error> {
    return await this.conn.closed();
  }

  async close(): Promise<void> {
    await this.conn.close();
  }

  publish(subject: string, payload?: Payload, options?: PublishOptions): void {
    this.conn.publish(subject, payload, options);
  }

  publishMessage(msg: Msg): void {
    this.conn.publishMessage(msg);
  }

  respondMessage(msg: Msg): boolean {
    return this.conn.respondMessage(msg);
  }

  subscribe(subject: string, opts?: SubscriptionOptions): Subscription {
    return this.conn.subscribe(subject, opts);
  }

  // not in the public api, but used by jetstream.
  _resub(s: Subscription, subject: string, max?: number) {
    return (this.conn as any)._resub(s, subject, max);
  }

  // not in the public api
  _check(subject: string, sub: boolean, pub: boolean) {
    return (this.conn as any)._check(subject, sub, pub);
  }

  async request(
    subject: string,
    payload?: Payload,
    opts?: RequestOptions,
  ): Promise<Msg> {
    return await this.conn.request(subject, payload, opts);
  }

  async requestMany(
    subject: string,
    payload?: Payload,
    opts?: Partial<RequestManyOptions>,
  ): Promise<AsyncIterable<Msg>> {
    return await this.conn.requestMany(subject, payload, opts);
  }

  async flush(): Promise<void> {
    this.conn.flush();
  }

  async drain(): Promise<void> {
    await this.conn.drain();
  }

  isClosed(): boolean {
    return this.conn.isClosed();
  }

  isDraining(): boolean {
    return this.conn.isDraining();
  }

  getServer(): string {
    return this.conn.getServer();
  }

  // The kv and stream clients use this, which alerts when connection is closing.
  // They also get the 'reconnect' event and drop this connection and get a new one,
  // thus also getting a new status.
  status(): AsyncIterable<Status> {
    return this.conn.status();
  }

  // The main client here (./client.ts) uses this to know the status of the primary
  // connection, mainly for presentation in the UI. Thus this has to always have
  // the latest connection status.
  async *statusOfCurrentConnection() {
    while (true) {
      this.currStatus = this.conn.status();
      for await (const x of this.currStatus) {
        this.emit("status", x);
        yield x;
      }
    }
  }

  // sum total of all data across *all* connections we've made here.
  stats(): Stats & { numSubscriptions: number } {
    // @ts-ignore: undocumented API
    let { inBytes, inMsgs, outBytes, outMsgs } = this.conn.stats();
    for (const conn of this.prev) {
      // @ts-ignore
      const x = conn.stats();
      inBytes += x.inBytes;
      outBytes += x.outBytes;
      inMsgs += x.inMsgs;
      outMsgs += x.outMsgs;
    }
    return {
      inBytes,
      inMsgs,
      outBytes,
      outMsgs,
      numSubscriptions: this.numSubscriptions(),
    };
  }

  async rtt(): Promise<number> {
    return await this.conn.rtt();
  }

  async reconnect(): Promise<void> {
    try {
      await this.conn.reconnect();
    } catch (err) {
      console.warn(`NATS reconnect failed -- ${err}`);
    }
  }

  get features() {
    return this.protocol.features;
  }

  getServerVersion(): SemVer | undefined {
    const info = this.info;
    return info ? parseSemVer(info.version) : undefined;
  }
}

async function delayThenDrain(conn, time) {
  await delay(time);
  try {
    await conn.drain();
  } catch (err) {
    console.log("delayThenDrain err", err);
  }
}

export { type CoCalcNatsConnection };

export type SemVer = { major: number; minor: number; micro: number };
export function parseSemVer(s = ""): SemVer {
  const m = s.match(/(\d+).(\d+).(\d+)/);
  if (m) {
    return {
      major: parseInt(m[1]),
      minor: parseInt(m[2]),
      micro: parseInt(m[3]),
    };
  }
  throw new Error(`'${s}' is not a semver value`);
}

function uniq(v: string[]): string[] {
  return Array.from(new Set(v));
}
