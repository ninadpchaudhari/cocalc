/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

/*
API for direct connection to a project; implemented using the websocket.
*/

import { redux } from "@cocalc/frontend/app-framework";
import { RunNotebookOptions } from "@cocalc/frontend/jupyter/nbgrader/api";
import {
  Capabilities,
  Configuration,
  ConfigurationAspect,
  isMainConfiguration,
  ProjectConfiguration,
} from "@cocalc/frontend/project_configuration";
import type {
  Config as FormatterConfig,
  Options as FormatterOptions,
} from "@cocalc/util/code-formatter";
import { syntax2tool } from "@cocalc/util/code-formatter";
import { DirectoryListingEntry } from "@cocalc/util/types";
import { reuseInFlight } from "@cocalc/util/reuse-in-flight";
import { Channel, Mesg, NbconvertParams } from "@cocalc/comm/websocket/types";
import call from "@cocalc/sync/client/call";

export class API {
  private conn;
  private project_id: string;
  private cachedVersion?: number;

  constructor(conn: string, project_id: string) {
    this.conn = conn;
    this.project_id = project_id;
    this.listing = reuseInFlight(this.listing.bind(this));
    this.conn.on("end", () => {
      delete this.cachedVersion;
    });
  }

  async call(mesg: Mesg, timeout_ms: number): Promise<any> {
    return await call(this.conn, mesg, timeout_ms);
  }

  async version(): Promise<number> {
    // version can never change (except when you restart the project!), so its safe to cache
    if (this.cachedVersion != null) {
      return this.cachedVersion;
    }
    try {
      this.cachedVersion = await this.call({ cmd: "version" }, 15000);
    } catch (err) {
      if (err.message?.includes('command "version" not implemented')) {
        this.cachedVersion = 0;
      } else {
        throw err;
      }
    }
    if (this.cachedVersion == null) {
      return 0;
    }
    return this.cachedVersion;
  }

  async delete_files(
    paths: string[],
    compute_server_id?: number,
  ): Promise<void> {
    return await this.call(
      { cmd: "delete_files", paths, compute_server_id },
      60000,
    );
  }

  // Move the given paths to the dest.  The folder dest must exist
  // already and be a directory, or this is in an error.
  async move_files(
    paths: string[],
    dest: string,
    compute_server_id?: number,
  ): Promise<void> {
    return await this.call(
      { cmd: "move_files", paths, dest, compute_server_id },
      60000,
    );
  }

  // Rename the file src to be the file dest.  The dest may be
  // in a different directory or may even exist already (in which)
  // case it is overwritten if it is a file. If dest exists and
  // is a directory, it is an error.
  async rename_file(
    src: string,
    dest: string,
    compute_server_id?: number,
  ): Promise<void> {
    return await this.call(
      { cmd: "rename_file", src, dest, compute_server_id },
      30000,
    );
  }

  async listing(
    path: string,
    hidden: boolean = false,
    timeout: number = 15000,
    compute_server_id: number = 0,
  ): Promise<DirectoryListingEntry[]> {
    return await this.call(
      { cmd: "listing", path, hidden, compute_server_id },
      timeout,
    );
  }

  /* Normalize the given paths relative to the HOME directory.
     This takes any old weird looking mess of a path and makes
     it one that can be opened properly with our file editor,
     and the path appears to be to a file *in* the HOME directory.
  */
  async canonical_path(path: string): Promise<string> {
    const v = await this.canonical_paths([path]);
    const x = v[0];
    if (typeof x != "string") {
      throw Error("bug in canonical_path");
    }
    return x;
  }
  async canonical_paths(paths: string[]): Promise<string[]> {
    return await this.call({ cmd: "canonical_paths", paths }, 15000);
  }

  async configuration(
    aspect: ConfigurationAspect,
    no_cache = false,
  ): Promise<Configuration> {
    return await this.call({ cmd: "configuration", aspect, no_cache }, 15000);
  }

  // use the returned FormatterOptions for the API formatting call!
  private check_formatter_available(config: FormatterConfig): FormatterOptions {
    const formatting = this.get_formatting();
    if (formatting == null) {
      throw new Error(
        "Code formatting status not available. Please restart your project!",
      );
    }
    // TODO refactor the assocated formatter and smc-project into a common configuration object
    const tool = syntax2tool[config.syntax];
    if (tool == null) {
      throw new Error(`No known tool for '${config.syntax}' available`);
    }
    if (formatting[tool] !== true) {
      throw new Error(
        `For this project, the code formatter '${tool}' for language '${config.syntax}' is not available.`,
      );
    }
    return { parser: tool };
  }

  get_formatting(): Capabilities | undefined {
    const project_store = redux.getProjectStore(this.project_id) as any;
    const configuration = project_store.get(
      "configuration",
    ) as ProjectConfiguration;
    // configuration check only for backwards compatibility, i.e. newer clients and old projects
    if (configuration == null) {
      return;
    }
    const main = configuration.get("main");
    if (main != null && isMainConfiguration(main)) {
      return main.capabilities.formatting;
    } else {
      return {} as Capabilities;
    }
  }

  // Returns  { status: "ok", patch:... the patch} or
  // { status: "error", phase: "format", error: err.message }.
  // We return a patch rather than the entire file, since often
  // the file is very large, but the formatting is tiny.  This is purely
  // a data compression technique.
  async formatter(path: string, config: FormatterConfig): Promise<any> {
    const options: FormatterOptions = this.check_formatter_available(config);
    // TODO change this to "formatter" at some point in the future (Sep 2020)
    return await this.call({ cmd: "prettier", path: path, options }, 15000);
  }

  async formatter_string(
    str: string,
    config: FormatterConfig,
    timeout_ms: number = 15000,
  ): Promise<any> {
    const options: FormatterOptions = this.check_formatter_available(config);
    // TODO change this to "formatter_string" at some point in the future (Sep 2020)
    return await this.call(
      {
        cmd: "prettier_string",
        str,
        options,
      },
      timeout_ms,
    );
  }

  async jupyter(
    path: string,
    endpoint: string,
    query: any = undefined,
    timeout_ms: number = 20000,
  ): Promise<any> {
    return await this.call(
      { cmd: "jupyter", path, endpoint, query },
      timeout_ms,
    );
  }

  async exec(opts: any): Promise<any> {
    let timeout_ms = 10000;
    if (opts.timeout) {
      timeout_ms = opts.timeout * 1000 + 2000;
    }
    return await this.call({ cmd: "exec", opts }, timeout_ms);
  }

  async eval_code(code: string, timeout_ms: number = 20000): Promise<any> {
    return await this.call({ cmd: "eval_code", code }, timeout_ms);
  }

  async realpath(path: string): Promise<string> {
    return await this.call({ cmd: "realpath", path }, 15000);
  }

  async terminal(path: string, options: object = {}): Promise<Channel> {
    const channel_name = await this.call(
      {
        cmd: "terminal",
        path: path,
        options,
      },
      60000,
    );
    //console.log(path, "got terminal channel", channel_name);
    return this.conn.channel(channel_name);
  }

  async project_info(): Promise<Channel> {
    const channel_name = await this.call({ cmd: "project_info" }, 60000);
    return this.conn.channel(channel_name);
  }

  // Get the lean *channel* for the given '.lean' path.
  async lean_channel(path: string): Promise<Channel> {
    const channel_name = await this.call(
      {
        cmd: "lean_channel",
        path: path,
      },
      60000,
    );
    return this.conn.channel(channel_name);
  }

  // Get the x11 *channel* for the given '.x11' path.
  async x11_channel(path: string, display: number): Promise<Channel> {
    const channel_name = await this.call(
      {
        cmd: "x11_channel",
        path,
        display,
      },
      60000,
    );
    return this.conn.channel(channel_name);
  }

  // Get the sync *channel* for the given SyncTable project query.
  async synctable_channel(
    query: { [field: string]: any },
    options: { [field: string]: any }[],
  ): Promise<Channel> {
    const channel_name = await this.call(
      {
        cmd: "synctable_channel",
        query,
        options,
      },
      10000,
    );
    // console.log("synctable_channel", query, options, channel_name);
    return this.conn.channel(channel_name);
  }

  // Command-response API for synctables.
  //   - mesg = {cmd:'close'} -- closes the synctable, even if persistent.
  async syncdoc_call(
    path: string,
    mesg: { [field: string]: any },
    timeout_ms: number = 30000, // ms timeout for call
  ): Promise<any> {
    return await this.call({ cmd: "syncdoc_call", path, mesg }, timeout_ms);
  }

  // Do a request/response command to the lean server.
  async lean(opts: any): Promise<any> {
    let timeout_ms = 10000;
    if (opts.timeout) {
      timeout_ms = opts.timeout * 1000 + 2000;
    }
    return await this.call({ cmd: "lean", opts }, timeout_ms);
  }

  // Convert a notebook to some other format.
  // --to options are listed in packages/frontend/jupyter/nbconvert.tsx
  // and implemented in packages/project/jupyter/convert/index.ts
  async jupyter_nbconvert(opts: NbconvertParams): Promise<any> {
    return await this.call(
      { cmd: "jupyter_nbconvert", opts },
      (opts.timeout ?? 60) * 1000 + 5000,
    );
  }

  // Get contents of an ipynb file, but with output and attachments removed (to save space)
  async jupyter_strip_notebook(ipynb_path: string): Promise<any> {
    return await this.call(
      { cmd: "jupyter_strip_notebook", ipynb_path },
      15000,
    );
  }

  // Run the notebook filling in the output of all cells, then return the
  // result as a string.  Note that the output size (per cell and total)
  // and run time is bounded to avoid the output being HUGE, even if the
  // input is dumb.

  async jupyter_run_notebook(opts: RunNotebookOptions): Promise<string> {
    const max_total_time_ms = opts.limits?.max_total_time_ms ?? 20 * 60 * 1000;
    return await this.call(
      { cmd: "jupyter_run_notebook", opts },
      60 + 2 * max_total_time_ms,
      // a bit of extra time -- it's better to let the internal project
      // timer do the job, than have to wait for this generic timeout here,
      // since we want to at least get output for problems that ran.
    );
  }

  // I think this isn't used.  It was going to support
  // sync_channel, but obviously a more nuanced protocol
  // was required.
  async symmetric_channel(name: string): Promise<Channel> {
    const channel_name = await this.call(
      {
        cmd: "symmetric_channel",
        name,
      },
      30000,
    );
    return this.conn.channel(channel_name);
  }

  // Do a database query, but via the project.  This has the project
  // do the query, so the identity used to access the database is that
  // of the project.  This isn't useful in the browser, where the user
  // always has more power to directly use the database.  It is *is*
  // very useful when using a project-specific api key.
  async query(opts: any): Promise<any> {
    if (opts.timeout == null) {
      opts.timeout = 30;
    }
    const timeout_ms = opts.timeout * 1000 + 2000;
    return await this.call({ cmd: "query", opts }, timeout_ms);
  }

  async computeServerSyncRequest(compute_server_id: number) {
    if (!(typeof compute_server_id == "number" && compute_server_id > 0)) {
      throw Error("compute_server_id must be a positive integer");
    }
    await this.call(
      {
        cmd: "compute_server_sync_request",
        opts: { compute_server_id },
      },
      30000,
    );
  }

  async copyFromProjectToComputeServer(opts: {
    compute_server_id: number;
    paths: string[];
    dest?: string;
    timeout?: number;
  }) {
    await this.call(
      { cmd: "copy_from_project_to_compute_server", opts },
      (opts.timeout ?? 60) * 1000,
    );
  }

  async copyFromComputeServerToProject(opts: {
    compute_server_id: number;
    paths: string[];
    dest?: string;
    timeout?: number;
  }) {
    await this.call(
      { cmd: "copy_from_compute_server_to_project", opts },
      (opts.timeout ?? 60) * 1000,
    );
  }
}
