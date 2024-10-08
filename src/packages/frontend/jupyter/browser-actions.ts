/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

/*
browser-actions: additional actions that are only available in the
web browser frontend.
*/
import * as awaiting from "awaiting";
import { fromJS, Map } from "immutable";
import { debounce, isEqual } from "lodash";

import { getIntl, jupyter, labels } from "@cocalc/frontend/i18n";
import { open_new_tab } from "@cocalc/frontend/misc";
import {
  delete_local_storage,
  get_local_storage,
  set_local_storage,
} from "@cocalc/frontend/misc/local-storage";
import track from "@cocalc/frontend/user-tracking";
import { webapp_client } from "@cocalc/frontend/webapp-client";
import { JupyterActions as JupyterActions0 } from "@cocalc/jupyter/redux/actions";
import { CellToolbarName } from "@cocalc/jupyter/types";
import { callback2, once } from "@cocalc/util/async-utils";
import { base64ToBuffer, bufferToBase64 } from "@cocalc/util/base64";
import { Config as FormatterConfig, Syntax } from "@cocalc/util/code-formatter";
import { from_json, merge_copy, to_json, uuid } from "@cocalc/util/misc";
import { reuseInFlight } from "@cocalc/util/reuse-in-flight";
import { JUPYTER_CLASSIC_MODERN } from "@cocalc/util/theme";
import type { ImmutableUsageInfo } from "@cocalc/util/types/project-usage-info";
import { get_usage_info, UsageInfoWS } from "../project/websocket/usage-info";
import { cm_options } from "./cm_options";
import { ConfirmDialogOptions } from "./confirm-dialog";
import { parseHeadings } from "./contents";
import { CursorManager } from "./cursor-manager";
import { NBGraderActions } from "./nbgrader/actions";
import * as parsing from "./parsing";
import { WidgetManager } from "./widgets/manager";

export class JupyterActions extends JupyterActions0 {
  public widget_manager?: WidgetManager;
  public nbgrader_actions: NBGraderActions;
  private cursor_manager: CursorManager;
  private account_change_editor_settings: any;
  private update_keyboard_shortcuts: any;
  private usage_info?: UsageInfoWS;
  private lastComputeServerId?: number;

  protected init2(): void {
    this.update_contents = debounce(this.update_contents.bind(this), 2000);
    this.setState({
      toolbar: !this.get_local_storage("hide_toolbar"),
      cell_toolbar: this.get_local_storage("cell_toolbar"),
    });

    this.usage_info_handler = this.usage_info_handler.bind(this);

    const do_set = () => {
      if (this.syncdb == null || this._state === "closed") return;
      const has_unsaved_changes = this.syncdb.has_unsaved_changes();
      const has_uncommitted_changes = this.syncdb.has_uncommitted_changes();
      this.setState({ has_unsaved_changes, has_uncommitted_changes });
      if (has_uncommitted_changes) {
        this.syncdb.save(); // save them.
      }
    };
    const f = () => {
      do_set();
      return setTimeout(do_set, 3000);
    };
    this.set_save_status = debounce(f, 1500);
    this.syncdb.on("metadata-change", this.set_save_status);
    this.syncdb.on("connected", this.set_save_status);

    // Also maintain read_only state.
    this.syncdb.on("metadata-change", this.sync_read_only);
    this.syncdb.on("connected", this.sync_read_only);

    // first update
    this.syncdb.once("change", this.updateContentsNow);

    this.syncdb.on("change", () => {
      // And activity indicator
      this.activity();
      // Update table of contents
      this.update_contents();
    });

    // Load kernel (once ipynb file loads).
    (async () => {
      await this.set_kernel_after_load();
      if (!this.store) return;
      track("jupyter", {
        kernel: this.store.get("kernel"),
        project_id: this.project_id,
        path: this.path,
      });
    })();

    // nbgrader support
    this.nbgrader_actions = new NBGraderActions(this, this.redux);

    this.syncdb.once("ready", () => {
      const ipywidgets_state = this.syncdb.ipywidgets_state;
      if (ipywidgets_state == null) {
        throw Error("bug -- ipywidgets_state must be defined");
      }
      this.widget_manager = new WidgetManager({
        ipywidgets_state: ipywidgets_state!,
        actions: this,
      });
      // Stupid hack for now -- this just causes some activity so
      // that the syncdb syncs.
      // This should not be necessary, and may indicate a bug in the sync layer?
      // id has to be set here since it is a primary key
      this.syncdb.set({ type: "user", id: 0, time: Date.now() });
      this.syncdb.commit();

      // If using nbgrader ensure document is fully updated.
      if (this.store.get("cell_toolbar") == "create_assignment") {
        // We only do this for notebooks where the toolbar is open, not for *any* old
        // random notebook.  It would be dumb to run this always (e.g., for a 1000
        // cell notebook that has nothing to do with nbgrader).
        this.nbgrader_actions.update_metadata();
      }

      const usage_info = (this.usage_info = get_usage_info(this.project_id));
      usage_info.watch(this.path);
      const key = usage_info.event_key(this.path);
      usage_info.on(key, this.usage_info_handler);
    });

    // Put an entry in the project log once the jupyter notebook gets opened.
    // NOTE: Obviously, the project does NOT need to put entries in the log.
    this.syncdb.once("change", () =>
      this.redux.getProjectActions(this.project_id).log_opened_time(this.path),
    );

    // project doesn't care about cursors, but browser clients do:
    this.syncdb.on("cursor_activity", this.syncdb_cursor_activity);
    this.cursor_manager = new CursorManager();

    if (window != null && (window as any).$ != null) {
      // frontend browser client with jQuery
      this.set_jupyter_kernels(); // must be after setting project_id above.

      // set codemirror editor options whenever account editor_settings change.
      const account_store = this.redux.getStore("account") as any; // TODO: check if ever is undefined
      this.account_change = this.account_change.bind(this);
      account_store.on("change", this.account_change);
      this.account_change_editor_settings =
        account_store.get("editor_settings");
    }
  }

  public run_cell(
    id: string,
    save: boolean = true,
    no_halt: boolean = false,
  ): void {
    if (this.store.get("read_only")) return;
    const cell = this.store.getIn(["cells", id]);
    if (cell == null) {
      // it is trivial to run a cell that does not exist -- nothing needs to be done.
      return;
    }

    const cell_type = cell.get("cell_type", "code");
    if (cell_type == "code") {
      const code = this.get_cell_input(id).trim();
      if (!code) {
        this.clear_cell(id, save);
        return;
      }
      this.run_code_cell(id, save, no_halt);
      if (save) {
        this.save_asap();
      }
    }
  }

  private async api_call_formatter(
    str: string,
    config: FormatterConfig,
    timeout_ms?: number,
  ): Promise<string | undefined> {
    if (this._state === "closed") {
      throw Error("closed -- api_call_formatter");
    }
    const api = await webapp_client.project_client.api(this.project_id);
    return await api.formatter_string(str, config, timeout_ms);
  }

  // throws an error if anything goes wrong. the error
  // has a formatInput attribute with the input that was
  // sent to the formatter.
  private async format_cell(id: string): Promise<void> {
    const cell = this.store.getIn(["cells", id]);
    if (cell == null) {
      throw new Error(`no cell with id ${id}`);
    }
    let code: string = cell.get("input", "").trim();
    let config: FormatterConfig;
    const cell_type: string = cell.get("cell_type", "code");
    switch (cell_type) {
      case "code":
        const syntax: Syntax | undefined = this.store.get_kernel_syntax();
        if (syntax == null) {
          return; // no-op on these.
        }
        config = { syntax: syntax };
        break;
      case "markdown":
        config = { syntax: "markdown" };
        break;
      default:
        // no-op -- do not format unknown cells
        return;
    }
    //  console.log("FMT", cell_type, options, code);
    let resp: string | undefined;
    code = parsing.process_magics(code, config.syntax, "escape");
    try {
      resp = await this.api_call_formatter(code, config);
    } catch (err) {
      try {
        err.formatInput = code;
      } catch (_err) {
        // it's possible that err = 'timeout', which is a string, and then the above fails.
        // to see this, disconnect your laptop from the internet then try to format a cell.
      }
      throw err;
    }
    resp = parsing.process_magics(resp, config.syntax, "unescape");
    if (resp == null) return; // make everyone happy …
    // We additionally trim the output, because formatting code introduces
    // a trailing newline
    this.set_cell_input(id, JupyterActions.trim_code(resp), false);
  }

  private static trim_code(str: string): string {
    str = str.trim();
    if (str.length > 0 && str.slice(-1) == "\n") {
      return str.slice(0, -2);
    }
    return str;
  }

  // this just throws an exception if the formatting fails
  public async format_cells(
    cell_ids: string[],
    sync: boolean = true,
  ): Promise<void> {
    const jobs: string[] = cell_ids.filter((id) =>
      this.store.is_cell_editable(id),
    );

    // TODO: This is badly implemented in terms of performance.
    // Imagine a notebook
    // with hundreds of cells... this would involves hundreds of distinct
    // calls to the backend to run yapf (say) repeatedly.  It would be
    // absolutely horrendous!  Instead, it should just all be done as
    // one single call (in a single string), and parsed.  Gees.
    await awaiting.map(jobs, 4, this.format_cell.bind(this));

    if (sync) {
      this._sync();
    }
  }

  public async format_all_cells(sync: boolean = true): Promise<void> {
    await this.format_cells(this.store.get_cell_ids_list(), sync);
  }

  private usage_info_handler(usage: ImmutableUsageInfo): void {
    // console.log("jupyter usage", this.path, "→", usage?.toJS());
    this.setState({ kernel_usage: usage });
  }

  public async close(): Promise<void> {
    if (this.is_closed()) return;
    if (this.usage_info != null) {
      const key = this.usage_info.event_key(this.path);
      this.usage_info.off(key, this.usage_info_handler);
    }
    await super.close();
  }

  private activity(): void {
    if (this._state === "closed") return;
    this.redux.getProjectActions(this.project_id).flag_file_activity(this.path);
  }

  focus = (wait?: any) => {
    this.deprecated("focus", wait);
  };

  blur = (wait?: any) => {
    this.deprecated("blur", wait);
  };

  blur_lock = () => {
    //this.deprecated("blur_lock");
  };

  focus_unlock = () => {
    // this.deprecated("focus_unlock");
  };

  protected close_client_only(): void {
    const account = this.redux.getStore("account");
    if (account != null) {
      account.removeListener("change", this.account_change);
    }
  }

  private syncdb_cursor_activity = (): void => {
    if (
      this.store == null ||
      this.syncdb == null ||
      this.cursor_manager == null
    ) {
      return;
    }
    const cursors = this.syncdb.get_cursors();
    const cells = this.cursor_manager.process(this.store.get("cells"), cursors);
    if (cells != null) {
      this.setState({ cells });
    }
    const computeServerId = this.cursor_manager.computeServerId(cursors);
    if (computeServerId != this.lastComputeServerId) {
      this.lastComputeServerId = computeServerId;
      this.fetch_jupyter_kernels();
    }
    this.setState({ computeServerId });
  };

  private account_change(state: Map<string, any>): void {
    // TODO: it might be better to implement redux
    // change listeners for particular keys.
    if (
      !state.get("editor_settings").equals(this.account_change_editor_settings)
    ) {
      const new_settings = state.get("editor_settings");
      if (
        this.account_change_editor_settings.get(
          "jupyter_keyboard_shortcuts",
        ) !== new_settings.get("jupyter_keyboard_shortcuts")
      ) {
        this.update_keyboard_shortcuts();
      }

      this.account_change_editor_settings = new_settings;
      this.set_cm_options();
    }
  }

  _keyboard_settings = () => {
    if (this.account_change_editor_settings == null) {
      console.warn("account settings not loaded"); // should not happen
      return;
    }
    const k = this.account_change_editor_settings.get(
      "jupyter_keyboard_shortcuts",
    );
    if (k != null) {
      return JSON.parse(k);
    } else {
      return {};
    }
  };

  show_find_and_replace = (): void => {
    this.blur_lock();
    this.setState({ find_and_replace: true });
  };

  close_find_and_replace = () => {
    this.setState({ find_and_replace: false });
    this.focus_unlock();
  };

  show_keyboard_shortcuts = (): void => {
    this.requireToggleReadonly();
    this.blur_lock();
    this.setState({ keyboard_shortcuts: { show: true } });
  };

  close_keyboard_shortcuts = () => {
    this.setState({ keyboard_shortcuts: undefined });
    this.focus_unlock();
  };

  add_keyboard_shortcut = (name: any, shortcut: any) => {
    const k = this._keyboard_settings();
    if (k == null) {
      return;
    }
    const v = k[name] != null ? k[name] : [];
    for (const x of v) {
      if (isEqual(x, shortcut)) {
        return;
      }
    }
    v.push(shortcut);
    k[name] = v;
    return this._set_keyboard_settings(k);
  };

  _set_keyboard_settings = (k: any) => {
    return (this.redux.getTable("account") as any).set({
      editor_settings: { jupyter_keyboard_shortcuts: JSON.stringify(k) },
    });
  };

  delete_keyboard_shortcut = (name: any, shortcut: any) => {
    const k = this._keyboard_settings();
    if (k == null) {
      return;
    }
    const v = k[name] != null ? k[name] : [];
    const w = (() => {
      const result: any = [];
      for (const x of v) {
        if (!isEqual(x, shortcut)) {
          result.push(x);
        }
      }
      return result;
    })();
    if (w.length === v.length) {
      // must be removing a default shortcut
      v.push(merge_copy(shortcut, { remove: true }));
    }
    k[name] = v;
    return this._set_keyboard_settings(k);
  };

  command = (name: any): void => {
    this.deprecated("command", name);
  };

  send_comm_message_to_kernel = async ({
    msg_id,
    comm_id,
    target_name,
    data,
    buffers,
  }: {
    msg_id?: string;
    comm_id: string;
    target_name: string;
    data: unknown;
    buffers?: ArrayBuffer[] | ArrayBufferView[];
  }): Promise<string> => {
    if (!msg_id) {
      msg_id = uuid();
    }
    let buffers64;
    if (buffers != null) {
      buffers64 = buffers.map(bufferToBase64);
    } else {
      buffers64 = [];
    }
    const msg = { msg_id, target_name, comm_id, data, buffers64 };
    await this.api_call("comm", msg);
    // console.log("send_comm_message_to_kernel", "sent", msg);
    return msg_id;
  };

  ipywidgetsGetBuffer = reuseInFlight(
    async (model_id: string, buffer_path: string): Promise<ArrayBuffer> => {
      const { buffer64 } = await this.api_call("ipywidgets-get-buffer", {
        model_id,
        buffer_path,
      });
      return base64ToBuffer(buffer64);
    },
  );

  // NOTE: someday move this to the frame-tree actions, since it would
  // be generically useful!
  // Display a confirmation dialog, then return the chosen option.
  public async confirm_dialog(
    confirm_dialog: ConfirmDialogOptions,
  ): Promise<string> {
    this.blur_lock();
    this.setState({ confirm_dialog });
    function dialog_is_closed(state): string | undefined {
      const c = state.get("confirm_dialog");
      if (c == null) {
        // deleting confirm_dialog prop is same as canceling.
        return "cancel";
      } else {
        return c.get("choice");
      }
    }
    try {
      return await callback2(this.store.wait, {
        until: dialog_is_closed,
        timeout: 0,
      });
    } catch (err) {
      console.warn("Jupyter modal dialog error -- ", err);
      return "cancel";
    } finally {
      this.focus_unlock();
    }
  }

  public close_confirm_dialog(choice?: string): void {
    if (choice === undefined) {
      this.setState({ confirm_dialog: undefined });
      return;
    }
    const confirm_dialog = this.store.get("confirm_dialog");
    if (confirm_dialog != null) {
      this.setState({
        confirm_dialog: confirm_dialog.set("choice", choice),
      });
    }
  }

  public async switch_to_classical_notebook(): Promise<void> {
    const choice = await this.confirm_dialog({
      title: "Switch to the Classical Notebook?",
      body:
        "If you are having trouble with the the CoCalc Jupyter Notebook, you can switch to the Classical Jupyter Notebook.   You can always switch back to the CoCalc Jupyter Notebook easily later from Jupyter or account settings (and please let us know what is missing so we can add it!).\n\n---\n\n**WARNING:** Multiple people simultaneously editing a notebook, with some using classical and some using the new mode, will NOT work!  Switching back and forth will likely also cause problems (use TimeTravel to recover).  *Please avoid using classical notebook mode if you possibly can!*\n\n[More info and the latest status...](" +
        JUPYTER_CLASSIC_MODERN +
        ")",
      choices: [
        { title: "Switch to Classical Notebook", style: "warning" },
        { title: "Continue using CoCalc Jupyter Notebook", default: true },
      ],
    });
    if (choice !== "Switch to Classical Notebook") {
      return;
    }
    (this.redux.getTable("account") as any).set({
      editor_settings: { jupyter_classic: true },
    });
    await this.save();
    this.file_action("reopen_file", this.store.get("path"));
  }

  public async confirm_close_and_halt(): Promise<void> {
    const intl = await getIntl();
    const cah = intl.formatMessage(jupyter.editor.close_and_halt_label);
    if (
      (await this.confirm_dialog({
        title: "Close this file and halt the kernel",
        body: intl.formatMessage(jupyter.editor.close_and_halt_body),
        choices: [
          { title: intl.formatMessage(labels.cancel) },
          {
            title: cah,
            style: "danger",
            default: true,
          },
        ],
      })) === cah
    ) {
      await this.close_and_halt();
    }
  }

  public async close_and_halt(): Promise<void> {
    // Display the main file listing page
    this.file_open();
    // Fully shutdown kernel, and save this file.
    await this.shutdown();
    // Close the file
    this.file_action("close_file");
  }

  public async trust_notebook(): Promise<void> {
    const intl = await getIntl();
    const choice = await this.confirm_dialog({
      icon: "warning",
      title: intl.formatMessage(jupyter.editor.browser_actions_trust_title),
      body: intl.formatMessage(jupyter.editor.browser_actions_trust_body),
      choices: [
        { title: "Trust", style: "danger", default: true },
        { title: "Cancel" },
      ],
    });
    if (choice === "Trust") {
      this.set_trust_notebook(true);
    }
  }

  public nbconvert_has_started(): boolean {
    const state = this.store.getIn(["nbconvert", "state"]);
    return state === "start" || state === "run";
  }

  public show_nbconvert_dialog(to: string): void {
    this.setState({ nbconvert_dialog: { to } });
  }

  public nbconvert(args: string[]): void {
    if (this.nbconvert_has_started()) {
      // can't run it while it is already running.
      throw Error("nbconvert is already running");
    }
    if (this.syncdb == null) {
      console.warn("nbconvert: syncdb not available, aborting...");
      return;
    }
    this.syncdb.set({
      type: "nbconvert",
      args,
      state: "start",
      error: null,
    });
    this.syncdb.commit();
  }

  public async nbconvert_get_error(): Promise<void> {
    const key: string | undefined = this.store.getIn([
      "nbconvert",
      "error",
      "key",
    ]);
    if (key == null) {
      return;
    }
    let error;
    try {
      error = await this.api_call("store", { key });
    } catch (err) {
      this.set_error(err);
      return;
    }
    if (this._state === "closed") {
      return;
    }
    const nbconvert = this.store.get("nbconvert");
    if (nbconvert != null && nbconvert.getIn(["error", "key"]) === key) {
      this.setState({ nbconvert: nbconvert.set("error", error) });
    }
  }

  public show_about(): void {
    this.setState({ about: true });
    this.set_backend_kernel_info();
  }

  public toggle_line_numbers(): void {
    this.set_line_numbers(!this.get_local_storage("line_numbers"));
  }

  public toggle_cell_line_numbers(id: string): void {
    if (this._state === "closed") return;
    const cells = this.store.get("cells");
    const cell = cells.get(id);
    if (cell == null) throw Error(`no cell with id ${id}`);
    const line_numbers: boolean = !!cell.get(
      "line_numbers",
      this.get_local_storage("line_numbers"),
    );
    this.setState({
      cells: cells.set(id, cell.set("line_numbers", !line_numbers)),
    });
  }

  hide(): void {
    this.deprecated("hide");
    // this.blur();
  }

  public async restart_and_run_all_no_halt(frame_actions?): Promise<void> {
    const intl = await getIntl();
    const rara = intl.formatMessage(
      jupyter.editor.restart_and_run_all_no_halt_label,
    );
    const choice = await this.confirm_dialog({
      title: intl.formatMessage(
        jupyter.editor.restart_and_run_all_no_halt_title,
      ),
      body: intl.formatMessage(jupyter.editor.restart_and_run_all_no_halt_body),
      choices: [
        { title: intl.formatMessage(labels.cancel) },
        {
          title: rara,
          style: "danger",
          default: true,
        },
      ],
    });
    if (choice === rara) {
      frame_actions?.set_all_md_cells_not_editing();
      await this.restart();
      this.run_all_cells(true);
    }
  }
  public async restart_and_run_all(frame_actions?): Promise<void> {
    const intl = await getIntl();
    const STOP = intl.formatMessage(jupyter.editor.restart_and_run_all_stop);
    const NOSTOP = intl.formatMessage(
      jupyter.editor.restart_and_run_all_nostop,
    );
    const choice = await this.confirm_dialog({
      title: intl.formatMessage(jupyter.editor.restart_and_run_all_title),
      body: intl.formatMessage(jupyter.editor.restart_and_run_all_body),
      choices: [
        { title: intl.formatMessage(labels.cancel) },
        {
          title: STOP,
          style: "danger",
          default: true,
        },
        {
          title: NOSTOP,
          style: "danger",
        },
      ],
    });
    if (choice === STOP) {
      frame_actions?.set_all_md_cells_not_editing();
      await this.restart();
      this.run_all_cells(false);
    }
    if (choice === NOSTOP) {
      frame_actions?.set_all_md_cells_not_editing();
      await this.restart();
      this.run_all_cells(true);
    }
  }

  public async restart_clear_all_output(): Promise<void> {
    const choice = await this.confirm_dialog({
      title: "Restart kernel and clear all output?",
      body: "Do you want to restart the kernel and clear all output?  All variables and outputs will be lost, though most past output is always available in TimeTravel.",
      choices: [
        { title: "Continue running" },
        {
          title: "Restart and clear all outputs",
          style: "danger",
          default: true,
        },
      ],
    });
    if (choice === "Restart and clear all outputs") {
      this.restart();
      this.clear_all_outputs();
    }
  }

  public async confirm_restart(): Promise<void> {
    const intl = await getIntl();
    const restart = intl.formatMessage(jupyter.editor.confirm_restart_label);
    const choice = await this.confirm_dialog({
      title: intl.formatMessage(jupyter.editor.confirm_restart_title),
      body: intl.formatMessage(jupyter.editor.confirm_restart_body),
      choices: [
        {
          title: intl.formatMessage(
            jupyter.editor.confirm_restart_continue_label,
          ),
        },
        { title: restart, style: "danger", default: true },
      ],
    });
    if (choice === restart) {
      this.restart();
    }
  }

  public async confirm_halt_kernel(): Promise<void> {
    const intl = await getIntl();
    const halt = intl.formatMessage(jupyter.editor.confirm_halt_kernel_halt);
    const choice = await this.confirm_dialog({
      title: intl.formatMessage(jupyter.editor.confirm_halt_kernel_title),
      body: intl.formatMessage(jupyter.editor.confirm_halt_kernel_body),
      choices: [
        {
          title: intl.formatMessage(
            jupyter.editor.confirm_halt_kernel_continue,
          ),
        },
        { title: halt, style: "danger", default: true },
      ],
    });
    if (choice === halt) {
      this.halt();
    }
  }

  public async confirm_remove_kernel(): Promise<void> {
    const remove = "Remove & Halt";
    const choice = await this.confirm_dialog({
      title: "Remove kernel?",
      body: "You're about to remove the kernel from the notebook, which will also terminate it. All variable values will be lost. Afterwards, you have to select a kernel, in order to be able to run code again.",
      choices: [
        { title: "Continue running" },
        { title: remove, style: "danger", default: true },
      ],
    });
    if (choice === remove) {
      this.select_kernel(""); // this will also call this.halt()
    }
  }

  public cell_toolbar(name?: CellToolbarName): void {
    // Set which cell toolbar is visible.
    // At most one may be visible.
    // name=undefined to not show any.
    // When switching to the 'nbgrader' toolbar, the metadata is also updated.
    this.set_local_storage("cell_toolbar", name);
    if (name == "create_assignment") {
      this.nbgrader_actions.update_metadata();
    }
    this.setState({ cell_toolbar: name });
  }

  public custom_jupyter_kernel_docs(): void {
    open_new_tab("https://doc.cocalc.com/howto/custom-jupyter-kernel.html");
  }

  /* Wait until the syncdb is ready *and* there is at
     least one cell in the notebook. For a brand new blank
     notebook, the backend will create a blank cell.

     If the current state is "closed" there is no way
     it'll ever be ready, so we throw an Error.
  */
  public async wait_until_ready(): Promise<void> {
    switch (this.syncdb.get_state()) {
      case "init":
        await once(this.syncdb, "ready");
        break;
      case "closed":
        throw Error("syncdb is closed so will never be ready");
    }
    // Wait until there is at least one cell.  The backend is
    // responsible for ensuring there is at least one cell.
    while ((this.store.get("cell_list")?.size ?? 0) <= 0) {
      // wait for a change event:
      await once(this.store, "change");
    }
  }

  protected set_cm_options(): void {
    const mode = this.store.get_cm_mode();
    const account = this.redux.getStore("account");
    if (account == null) return;
    const immutable_editor_settings = account.get("editor_settings");
    if (immutable_editor_settings == null) return;
    const editor_settings = immutable_editor_settings.toJS();
    const line_numbers =
      this.get_local_storage("line_numbers") ??
      immutable_editor_settings.get("jupyter_line_numbers") ??
      false;
    const read_only = this.store.get("read_only");
    const x = fromJS({
      options: cm_options(mode, editor_settings, line_numbers, read_only),
      markdown: cm_options(
        { name: "gfm2" },
        editor_settings,
        line_numbers,
        read_only,
      ),
    });

    if (!x.equals(this.store.get("cm_options"))) {
      // actually changed
      this.setState({ cm_options: x });
    }
  }

  toggle_toolbar() {
    return this.set_toolbar_state(!this.store.get("toolbar"));
  }

  public set_toolbar_state(toolbar: boolean): void {
    // true = visible
    this.setState({ toolbar });
    this.set_local_storage("hide_toolbar", !toolbar);
  }

  public toggle_header(): void {
    (this.redux.getActions("page") as any).toggle_fullscreen();
  }

  public set_header_state(visible: boolean): void {
    (this.redux.getActions("page") as any).set_fullscreen(
      visible ? "default" : undefined,
    );
  }

  get_local_storage(key: any) {
    const value = get_local_storage(this.name);
    if (value != null) {
      try {
        const x = typeof value === "string" ? from_json(value) : value;
        if (x != null) {
          return x[key];
        }
      } catch {
        // from_json might throw, hence the value is problematic and we delete it
        delete_local_storage(this.name);
      }
    }
  }

  set_line_numbers(show: boolean): void {
    this.set_local_storage("line_numbers", !!show);
    // unset the line_numbers property from all cells
    const cells = this.store
      .get("cells")
      .map((cell) => cell.delete("line_numbers"));
    if (!cells.equals(this.store.get("cells"))) {
      // actually changed
      this.setState({ cells });
    }
    // now cause cells to update
    this.set_cm_options();
  }

  set_local_storage(key, value) {
    if (localStorage == null) return;
    let current_str = get_local_storage(this.name);
    const current =
      current_str != null
        ? typeof current_str === "string"
          ? from_json(current_str)
          : current_str
        : {};
    if (value === null) {
      delete current[key];
    } else {
      current[key] = value;
    }
    set_local_storage(this.name, to_json(current));
  }

  private updateContentsNow = () => {
    if (this._state == "closed") return;
    const cells = this.store.get("cells");
    if (cells == null) return;
    const cell_list = this.store.get("cell_list");
    if (cell_list == null) return;
    const contents = fromJS(parseHeadings(cells, cell_list));
    this.setState({ contents });
  };

  public update_contents(): void {
    this.updateContentsNow();
  }

  protected __syncdb_change_post_hook(_doInit: boolean) {
    if (this._state === "init") {
      this._state = "ready";
    }
    this.check_select_kernel();
  }
}
