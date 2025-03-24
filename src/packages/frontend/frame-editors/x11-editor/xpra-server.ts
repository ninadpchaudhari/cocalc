/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

/*
Control backend Xpra server daemon
*/

import { exec, ExecOutput, ExecOpts } from "../generic/client";
import { reuseInFlight } from "@cocalc/util/reuse-in-flight";
import { MAX_WIDTH, MAX_HEIGHT } from "./xpra/surface";
import { splitlines, split } from "@cocalc/util/misc";
import { appBasePath } from "@cocalc/frontend/customize/app-base-path";

export interface ExecOpts0 {
  command: string;
  path?: string;
  args?: string[];
  timeout?: number;
  err_on_exit?: boolean;
  env?: any; // custom environment variables.
}

interface XpraServerOptions {
  project_id: string;
  display: number;
  command?: string;
}

export class XpraServer {
  private project_id: string;
  private display: number;
  private state: string = "ready";
  private hostname: string = "";

  constructor(opts: XpraServerOptions) {
    this.project_id = opts.project_id;
    try {
      this.get_hostname(); // start trying...
    } catch (err) {
      console.warn("xpra: Failed to get hostname.");
    }
    this.display = opts.display;
    this.start = reuseInFlight(this.start.bind(this));
    this.stop = reuseInFlight(this.stop.bind(this));
    this.get_port = reuseInFlight(this.get_port.bind(this));
    this.get_hostname = reuseInFlight(this.get_hostname.bind(this));
    this.pgrep = reuseInFlight(this.pgrep.bind(this));
  }

  destroy(): void {
    this.state = "destroyed";
  }

  // Returns the port it is running on, or 0 if destroyed before finding one...
  async start(): Promise<number> {
    let port = await this.get_port();
    if (port) {
      return port;
    }
    for (let i = 0; i < 20; i++) {
      if (this.state === "destroyed") {
        return 0;
      }
      port = Math.round(1000 + Math.random() * 64000);
      try {
        await this._start(port);
        return port; // it worked -- no exception
      } catch (err) {
        console.log("random port failed; trying another...", err);
      }
    }
    throw Error("unable to start xpra server");
  }

  // I've noticed that often Xvfb will get left running, and then
  // xpra will *never* start unless you manually kill it. It's much
  // better to just ensure it is dead.
  private async _kill_Xvfb(): Promise<void> {
    const { stdout, exit_code } = await this.exec({
      command: "pgrep",
      args: ["-a", "Xvfb"],
      err_on_exit: false,
    });
    if (exit_code !== 0) {
      return;
    }
    for (const line of splitlines(stdout)) {
      if (line.indexOf(`Xvfb-for-Xpra-:${this.display}`) !== -1) {
        const pid = line.split(" ")[0];
        await this.exec({
          command: "kill",
          args: ["-9", pid],
          err_on_exit: false,
        });
        return;
      }
    }
  }

  private async _start(port: number): Promise<void> {
    // Kill any existing Xvfb processes that conflict with
    // this one -- they can get left around.
    await this._kill_Xvfb();

    // Make sure directory for logs and sockets exists.
    await this.exec({
      command: "mkdir",
      args: ["-p", `/tmp/xpra-${this.project_id}`],
    });
    // Actually start xpra.

    // xpra start :1507177745 --lock=no --bind-tcp=localhost:10000,auth=none --sharing=yes --terminate-children=yes --daemon=no --html=/projects/6b851643-360e-435e-b87e-f9a6ab64a8b1/upstream/local/usr/share/xpra/www --xvfb="/usr/bin/Xvfb -screen 0 8192x4096x24+32 -nolisten tcp -noreset"
    
    const XVFB = `/usr/bin/Xvfb +extension Composite -screen 0 ${MAX_WIDTH}x${MAX_HEIGHT}x24+32 -nolisten tcp -noreset`;
    const command = "xpra";
    const args = [
      "start",
      `:${this.display}`,
      "--mdns=no", // disable dynamic dns via avahi
      "--compression_level=1",
      `--socket-dir=/tmp/xpra-${this.project_id}`,
      "--tray=no",
      "--mousewheel=on",
      `--log-dir=/tmp/xpra-${this.project_id}`,
      "--clipboard=no" /* we use our own clipboard approach */,
      "--notifications=yes",
      "--no-keyboard-sync" /* see https://xpra.org/trac/wiki/Keyboard */,
      "--pulseaudio=no",
      "--bell=no",
      "--sharing=yes",
      "--microphone=off",
      "--av-sync=no",
      "--speaker=off",
      "--terminate-children=yes",
      `--bind-tcp=0.0.0.0:${port}`,
      //l"--html=/tmp" /* just to make it serve the websocket; path isn't actually used.  Must be absolute */,
      "--daemon=yes",
      `--xvfb=${XVFB}`,
    ];
    await this.exec({
      command,
      args,
      err_on_exit: true,
      timeout: 30,
    });
  }

  async stop(): Promise<void> {
    const line = await this.pgrep();
    if (line === "") {
      return;
    }
    await this.exec({
      command: "kill",
      args: [split(line)[0]],
    });
  }

  private async pgrep(): Promise<string> {
    const { stdout, exit_code } = await this.exec({
      command: "pgrep",
      args: ["-a", "xpra"],
      err_on_exit: false,
    });
    if (exit_code !== 0) {
      return "";
    }
    for (const line of splitlines(stdout)) {
      if (line.indexOf(`start :${this.display}`) !== -1) {
        return line;
      }
    }
    return "";
  }

  async is_running(): Promise<boolean> {
    // The following is not as robust as using "xpra info", but it is
    // a thousand times faster (literally).
    return (await this.pgrep()) !== "";
  }

  async get_port(): Promise<number | undefined> {
    const line = await this.pgrep();
    const i = line.indexOf(`bind-tcp=0.0.0.0:`);
    if (i === -1) {
      return;
    }
    const j = line.indexOf(":", i);
    const k = line.indexOf(" ", j);
    if (j === -1 || k === -1) {
      return;
    }
    return parseInt(line.slice(j + 1, k));
  }

  async get_hostname(): Promise<string> {
    const { stdout } = await this.exec({
      command: "hostname",
      err_on_exit: true,
    });
    return (this.hostname = stdout.trim());
  }

  get_socket_path(): string {
    let hostname = this.hostname;
    if (!hostname) {
      // this will fail if hostname hasn't been set yet via an async call
      // and NOT in kucalc (where there hostname is canonical).
      if (appBasePath != "/") {
        // cocalc-in-cocalc dev
        hostname = `project-${appBasePath.slice(1, 37)}`;
      } else {
        // kucalc
        hostname = `project-${this.project_id}`;
      } // else -- it won't work.
    }
    return `/tmp/xpra-${this.project_id}/${hostname}-${this.display}`;
  }

  async exec(opts: ExecOpts0): Promise<ExecOutput> {
    if (opts.env === undefined) {
      opts.env = {};
    }
    opts.env.DISPLAY = `:${this.display}`;
    (opts as any).project_id = this.project_id;
    return await exec(opts as ExecOpts);
  }

  // get the current contents of the X11 clipboard
  async get_clipboard(): Promise<string> {
    const clip = await this.exec({
      command: "xsel",
      err_on_exit: true,
      timeout: 5,
      args: ["--output"], // necessary in ubuntu 20.04, with a newer xpra
    });
    return clip.stdout;
  }
}
