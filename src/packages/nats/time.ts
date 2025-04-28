/*
Time sync entirely using nats itself.

To use this, call the default export, which is a sync
function that returns the current sync'd time (in ms since epoch), or
throws an error if the first time sync hasn't succeeded.
This gets initialized by default on load of your process.
If you want to await until the clock is sync'd, call "await getSkew()"

It works using a key:value store via jetstream,
which is complicated overall.  Normal request/reply
messages don't seem to have a timestamp, so I couldn't
use them.

import getTime, {getSkew} from "@cocalc/nats/time";

// sync - this throws if hasn't connected and sync'd the first time:

getTime();  // -- ms since the epoch

// async -- will wait to connect and tries to sync if haven't done so yet.  Otherwise same as sync:
// once this works you can definitely call getTime henceforth.
await getSkew();

DEVELOPMENT:

See src/packages/backend/nats/test/time.test.ts for unit tests.

Also do this, noting the directory and import of @cocalc/backend/nats.

~/cocalc/src/packages/backend$ node
Welcome to Node.js v18.17.1.
Type ".help" for more information.
> a = require('@cocalc/nats/time'); require('@cocalc/backend/nats')
{
  getEnv: [Getter],
  getConnection: [Function: debounced],
  init: [Function: init],
  getCreds: [AsyncFunction: getCreds]
}
> await a.default()
1741643178722.5

*/

import { dkv as createDkv } from "@cocalc/nats/sync/dkv";
import { getClient, getEnv, reconnect } from "@cocalc/nats/client";
import { reuseInFlight } from "@cocalc/util/reuse-in-flight";
import { randomId } from "@cocalc/nats/names";
import { callback, delay } from "awaiting";
import { nanos } from "@cocalc/nats/util";
import { once } from "@cocalc/util/async-utils";

// max time to try when syncing
const TIMEOUT = 3 * 1000;

// sync clock this frequently once it has sync'd once
const INTERVAL_GOOD = 1000 * 60;
const INTERVAL_BAD = 5 * 1000;

// If clock fails to sync this many times in a row, we reconnect to nats.
const MAX_FAILS = 3;

const RECONNECT_LOGIC = true;

export function init() {
  syncLoop();
  if (RECONNECT_LOGIC) {
    monitorLoop();
  }
}

let state = "running";
export function close() {
  state = "closed";
}

let syncLoopStarted = false;
async function syncLoop() {
  if (syncLoopStarted) {
    return;
  }
  syncLoopStarted = true;
  const client = getClient();
  let fails = 0;
  while (state != "closed" && client.state != "closed") {
    try {
      await getSkew();
      if (state == "closed") return;
      fails = 0;
      await delay(INTERVAL_GOOD);
    } catch (err) {
      if (client.state != "connected") {
        await once(client, "connected");
        continue;
      }
      console.log(`WARNING: failed to sync clock -- ${err}`);
      if (RECONNECT_LOGIC) {
        fails += 1;
        console.log({ fails, MAX_FAILS, state });
        if (state == "closed") return;
        if (fails >= MAX_FAILS) {
          // something is very very wrong -- reconnect
          console.log("WARNING: something is wrong with NATS connection");
          fails = 0;
          try {
            await reconnect();
          } catch (err) {
            console.log(`WARNING: reconnect failed -- ${err}`);
          }
        }
      }
      await delay(INTERVAL_BAD);
    }
  }
}

// periodically check if the client thinks we are connected, but
// the clock isn't updating.  If so, reconnect.
async function monitorLoop() {
  if (process.env.COCALC_TEST_MODE) {
    return;
  }
  const client = getClient();
  while (state != "closed" && client.state != "closed") {
    await delay(5000);
    if (
      client.state == "connected" &&
      Date.now() - lastUpdated > 1.2 * INTERVAL_GOOD
    ) {
      console.log("WARNING: clock isn't updating, so reconnecting");
      await reconnect();
    }
  }
}

let dkv: any = null;
const initDkv = reuseInFlight(async () => {
  const { account_id, project_id } = getClient();
  // console.log({ account_id, project_id, client: getClient() });
  dkv = await createDkv({
    account_id,
    project_id,
    env: await getEnv(),
    name: "time",
    noInventory: true,
    limits: {
      max_age: nanos(4 * TIMEOUT),
    },
  });
});

// skew = amount in ms to subtract from our clock to get sync'd clock
export let skew: number | null = null;
let rtt: number | null = null;
let lastUpdated = Date.now();
export const getSkew = reuseInFlight(async (): Promise<number> => {
  if (dkv == null) {
    await initDkv();
  }
  const start = Date.now();
  const id = randomId();
  dkv.set(id, "");
  const f = (cb) => {
    const handle = ({ key }) => {
      const end = Date.now();
      if (key == id) {
        clearTimeout(timer);
        dkv.removeListener("change", handle);
        const serverTime = dkv.time(key)?.valueOf();
        dkv.delete(key);
        rtt = end - start;
        skew = start + rtt / 2 - serverTime;
        lastUpdated = Date.now();
        cb(undefined, skew);
      }
    };
    dkv.on("change", handle);
    let timer = setTimeout(() => {
      dkv.removeListener("change", handle);
      dkv.delete(id);
      cb("timeout");
    }, TIMEOUT);
  };
  return await callback(f);
});

export async function waitUntilTimeAvailable() {
  if (skew != null) {
    return;
  }
  await getSkew();
}

// get last measured round trip time
export function getLastPingTime(): number | null {
  return rtt;
}
export function getLastSkew(): number | null {
  return skew;
}

export default function getTime({
  noError,
}: { noError?: boolean } = {}): number {
  if (skew == null) {
    init();
    if (noError) {
      return Date.now();
    }
    throw Error("clock skew not known");
  }
  return Date.now() - skew;
}
