/*
Run an interactive bash terminal, but with the nats and nsc command
available and configured to work with full permissions. This is
useful for interactively using those command to inspect the state
of the system, learning how to do something, etc.
*/

import { data, natsPassword, natsUser } from "@cocalc/backend/data";
import { join } from "path";
import { spawnSync } from "node:child_process";
import { natsServerUrl } from "./conf";

const natsBin = join(data, "nats", "bin");

export function natsCoCalcUserEnv({ user = natsUser }: { user?: string } = {}) {
  return {
    NATS_URL: natsServerUrl,
    NATS_PASSWORD: natsPassword,
    NATS_USER: user ?? natsUser,
    PATH: `${natsBin}:${process.env.PATH}`,
  };
}

function params({ user }) {
  return {
    command: "bash",
    args: ["--norc", "--noprofile"],
    env: {
      ...natsCoCalcUserEnv({ user }),
      HOME: process.env.HOME,
      TERM: process.env.TERM,
      PS1: `\\w [nats-${user}]$ `,
    },
  };
}

// echo; echo '# Use CoCalc config of NATS (nats and nsc) via this subshell:'; echo; NATS_URL=nats://${COCALC_NATS_SERVER:=localhost}:${COCALC_NATS_PORT:=4222} XDG_DATA_HOME=${COCALC_ROOT:=$INIT_CWD}/data XDG_CONFIG_HOME=${COCALC_ROOT:=$INIT_CWD}/data PATH=${COCALC_ROOT:=$INIT_CWD}/data/nats/bin:$PATH bash

// the supported users here are natsUser and 'sys'.

export function main({ user = natsUser }: { user?: string } = {}) {
  let { command, args, env } = params({ user });
  console.log("# Use CoCalc config of NATS (nats and nsc) via this subshell:");
  console.log(
    JSON.stringify(
      { ...env, NATS_PASSWORD: "xxx", PATH: natsBin + ":..." },
      undefined,
      2,
    ),
  );
  spawnSync(command, args, {
    env: { ...env, PATH: `${natsBin}:${process.env.PATH}` },
    stdio: "inherit",
  });
}
