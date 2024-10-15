/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

import { Alert, Button, Input, Popconfirm, Popover } from "antd";
import { fromJS } from "immutable";
import { DebounceInput } from "react-debounce-input";

import { alert_message } from "@cocalc/frontend/alerts";
import {
  React,
  redux,
  TypedMap,
  useEffect,
  useIsMountedRef,
  useState,
  useTypedRedux,
} from "@cocalc/frontend/app-framework";
import {
  Gap,
  Icon,
  Loading,
  Paragraph,
  Text,
  TimeAgo,
} from "@cocalc/frontend/components";
import {
  query,
  user_search,
} from "@cocalc/frontend/frame-editors/generic/client";
import EditLicense from "@cocalc/frontend/purchases/edit-license";
import Subscription from "@cocalc/frontend/purchases/subscription";
import { User } from "@cocalc/frontend/users";
import { webapp_client } from "@cocalc/frontend/webapp-client";
import { describe_quota } from "@cocalc/util/licenses/describe-quota";
import { plural } from "@cocalc/util/misc";
import {
  isLicenseStatus,
  LicenseStatus,
  licenseStatusProvidesUpgrades,
} from "@cocalc/util/upgrades/quota";
import { DisplayUpgrades, scale_by_display_factors } from "./admin/upgrades";
import { LICENSE_ACTIVATION_RULES } from "./rules";
import type {
  SiteLicensePublicInfo as Info,
  SiteLicensePublicInfo as SiteLicensePublicInfoType,
} from "./types";
import { site_license_public_info, trunc_license_id } from "./util";

interface Props {
  license_id: string;
  project_id?: string; // if not given, just provide the public info about the license (nothing about if it is upgrading a specific project or not) -- this is used, e.g., for the course configuration page
  upgrades?: TypedMap<SiteLicensePublicInfoType> | null;
  onRemove?: () => void; // called *before* the license is removed!
  warn_if?: (info) => void | string;
  restartAfterRemove?: boolean; // default false
  tableMode?: boolean; // if true, used via SiteLicensePublicInfoTable
  refresh?: () => void; // called if license is edited.
}

export const SiteLicensePublicInfo: React.FC<Props> = (
  props: Readonly<Props>,
) => {
  const {
    license_id,
    project_id,
    upgrades,
    onRemove,
    warn_if,
    restartAfterRemove = false,
    tableMode = false,
    refresh,
  } = props;
  const [info, set_info] = useState<Info | undefined>(undefined);
  const [err, set_err] = useState<string | undefined>(undefined);
  const [loading, set_loading] = useState<boolean>(true);
  const isMountedRef = useIsMountedRef();
  const [is_editing_description, set_is_editing_description] =
    useState<boolean>(false);
  const [is_editing_title, set_is_editing_title] = useState<boolean>(false);
  const [title, set_title] = useState<string>("");
  const [description, set_description] = useState<string>("");
  const [is_adding_manager, set_is_adding_manager] = useState<boolean>(false);
  const [manager_search, set_manager_search] = useState<string>("");
  const [manager_search_result, set_manager_search_result] = useState<
    | false
    | undefined
    | {
        first_name?: string;
        last_name?: string;
        account_id: string;
        last_active?: number;
      }
  >(false);
  const user_map = useTypedRedux("users", "user_map");
  const managedLicenses = useTypedRedux("billing", "managed_licenses");
  const is_commercial = useTypedRedux("customize", "is_commercial");

  function getLicenseStatus(): LicenseStatus | undefined {
    const status = upgrades?.get("status");
    if (isLicenseStatus(status)) {
      return status;
    } else {
      return;
    }
  }

  // in doubt, we assume the best and the license is valid
  const license_status = getLicenseStatus();
  const provides_upgrades = licenseStatusProvidesUpgrades(license_status);

  useEffect(() => {
    if (managedLicenses == null) {
      // make sure managedLicenses is defined, it's used for checking if the
      // license editing button should be displayed.
      redux.getActions("billing").update_managed_licenses();
    }
  }, []);

  useEffect(() => {
    // Optimization: check in redux store for first approximation of
    // info already available locally
    let info = managedLicenses?.get(license_id);
    if (info != null) {
      const info2 = info.toJS() as Info;
      info2.is_manager = true; // redux store *only* has entries that are managed.
      set_info(info2);
    }
    // Now launch async fetch from database.  This has more info, e.g., number of
    // projects that are running right now.
    fetch_info(true);
  }, []);

  async function set_managers(managers: string[]): Promise<void> {
    await query({
      query: { manager_site_licenses: { id: license_id, managers } },
    });
  }

  async function do_add_manager(account_id: string): Promise<void> {
    if (info?.managers == null) return;
    try {
      if (info.managers.indexOf(account_id) == -1) {
        info.managers.push(account_id);
        await set_managers(info.managers);
        if (!isMountedRef.current) return;
      }
      alert_message({
        type: "info",
        message: "Successfully added manager to license.",
      });
      fetch_info(true);
    } catch (err) {
      const message = `Error adding manager to license -- ${err}`;
      alert_message({ type: "error", message });
    }
  }

  async function do_remove_manager(account_id: string): Promise<void> {
    if (info?.managers == null) return;
    try {
      if (info.managers.indexOf(account_id) != -1) {
        info.managers = info.managers.filter((x) => x != account_id);
        await set_managers(info.managers);
        if (!isMountedRef.current) return;
      }
      alert_message({
        type: "info",
        message: "Successfully removed manager from license.",
      });
      fetch_info(true);
    } catch (err) {
      const message = `Error removing manager from license -- ${err}`;
      alert_message({ type: "error", message });
    }
  }

  async function add_manager(): Promise<void> {
    set_is_adding_manager(false);
    const query = manager_search;
    set_manager_search("");
    if (!info?.managers) return;
    // We find the first match that is NOT already a manager.
    // This is just to make the UI really simple for now (not having
    // to choose from multiple matches).
    const x = await user_search({
      query,
      limit: (info?.managers?.length ?? 1) + 1,
    });
    if (!isMountedRef.current || !info?.managers) return;
    for (const y of x) {
      if (info.managers.indexOf(y.account_id) == -1) {
        // not already a manager
        set_manager_search_result(y);
        return;
      }
    }
    set_manager_search_result(undefined);
  }

  async function fetch_info(force: boolean = false): Promise<void> {
    set_err("");
    set_loading(true);
    let info;
    let success = false;
    try {
      info = await site_license_public_info(license_id, force);
      if (info == null) throw new Error(`no info about license ${license_id}`);
      success = true;
    } catch (err) {
      if (!isMountedRef.current) return;
      set_err(`${err}`);
    } finally {
      if (!isMountedRef.current) return;
      set_loading(false);
      if (success) {
        set_info(info);
      }
    }
  }

  function render_expires() {
    // we check if we definitely know the status, otherwise use the date
    // if there is no information, we assume it is valid
    const expired =
      license_status != null
        ? license_status === "expired"
        : info?.expires != null
        ? new Date() >= info.expires
        : false;
    if (!expired && info?.subscription_id) {
      // no need to say anything because it is not expired and
      // a subscription will extend it (unless it is canceled)
      return null;
    }
    const word = expired ? "EXPIRED" : "Paid through";
    const when =
      info?.expires != null ? (
        <TimeAgo date={info.expires} />
      ) : expired ? (
        "in the past"
      ) : info?.expires != null ? (
        "in the future"
      ) : (
        "never"
      );
    return (
      <li
        style={expired ? { fontSize: "110%", fontWeight: "bold" } : undefined}
      >
        {word} {when}
        {!!info?.expires && !expired && (
          <>
            {info?.subscription_id
              ? " depending on subscription status."
              : " unless it is edited."}
          </>
        )}
      </li>
    );
  }

  function get_type(): "warning" | "error" | "success" {
    if (loading || info != null) {
      if (provides_upgrades) {
        return "success";
      } else {
        return "warning";
      }
    } else {
      return "error";
    }
  }

  function render_id(): JSX.Element | undefined {
    if (!license_id) return;
    // dumb minimal security -- only show this for now to managers.
    // Of course, somebody could
    // sniff their browser traffic and get it so this is just to
    // discourage really trivial blatant misuse.  We will have other
    // layers of security.

    // Show only last few digits if not manager.
    // license display for specific project
    return (
      <li>
        {info?.is_manager ? (
          <Paragraph
            copyable={{
              text: license_id,
              tooltips: ["Copy license key", "Copied!"],
            }}
            style={{
              display: "inline",
              margin: 0,
              verticalAlign: "middle",
              fontFamily: "monospace",
            }}
          >
            {license_id}
          </Paragraph>
        ) : (
          <Text style={{ fontFamily: "monospace" }}>
            {trunc_license_id(license_id)}
          </Text>
        )}
      </li>
    );
  }

  function render_license(): JSX.Element | undefined {
    if (!info) {
      if (!loading && !err) {
        return <span>Unknown license key.</span>;
      }
      return;
    }
    return <span>{render_title()}</span>;
  }

  function render_run_limit(): JSX.Element | undefined {
    if (!info) return;
    if (!info.run_limit) {
      return (
        <li>
          Can upgrade an unlimited number of simultaneous running projects.
        </li>
      );
    }
    return (
      <li>Can upgrade up to {info.run_limit} simultaneous running projects.</li>
    );
  }

  function render_running(): JSX.Element | undefined {
    if (info?.running == null) return;
    return (
      <li>
        Actively used by {info.running} running{" "}
        {plural(info.running, "project")}.
      </li>
    );
  }

  function render_applied(): JSX.Element | undefined {
    if (info?.applied == null) return;
    return (
      <li>
        Applied to {info.applied} {plural(info.applied, "project")}.
      </li>
    );
  }

  function render_overall_limit(): JSX.Element | undefined {
    if (!info) return;
    if (!info.run_limit) {
      return (
        <span>to an unlimited number of simultaneous running projects</span>
      );
    }
    return <span>to up to {info.run_limit} simultaneous running projects</span>;
  }

  function render_what_license_provides_overall(): JSX.Element | undefined {
    if (info == null) return;
    if (info.quota != null) {
      return render_quota(info.quota);
    }
    if (!info.upgrades) {
      return <div>Provides no upgrades.</div>;
    }
    return (
      <div>
        Provides the following upgrades {render_overall_limit()}:
        <DisplayUpgrades
          upgrades={scale_by_display_factors(fromJS(info.upgrades))}
          style={{
            border: "1px solid #ddd",
            padding: "0 15px",
            backgroundColor: "white",
            margin: "5px 15px",
          }}
        />
      </div>
    );
  }

  function render_quota(quota): JSX.Element {
    return <div>{describe_quota(quota)}</div>;
  }

  // this restarts the project if "only_if_running" is true and it is running
  function restart_project(only_if_running): void {
    if (!project_id) return;
    const actions = redux.getActions("projects");
    const store = redux.getStore("projects");
    if (only_if_running) {
      if (store.get_state(project_id) === "running") {
        actions.restart_project(project_id);
      }
    } else {
      actions.restart_project(project_id);
    }
  }

  function render_why(): JSX.Element {
    return (
      <Popover
        content={LICENSE_ACTIVATION_RULES}
        trigger="click"
        placement="rightTop"
        title="Licenses activation rules"
      >
        <a>Why?</a>
      </Popover>
    );
  }

  function render_upgrades(): JSX.Element | undefined {
    if (!project_id) {
      // component not being used in the context of a specific project.
      return (
        <div>
          {render_id()}
          {render_expires()}
          {render_what_license_provides_overall()}
          {render_applied()}
          {render_run_limit()}
          {render_running()}
          {render_activated()}
          {render_managers()}
          {render_description()}
        </div>
      );
    }

    let provides: JSX.Element | undefined;
    let show_run: boolean = true;
    if (info == null) {
      if (loading) {
        return; // wait until done loading.
      } else {
        // Show just the id so user can check for typos
        return <ul>{render_id()}</ul>;
      }
    }
    if (info.expires && new Date() >= info.expires) {
      // expired?
      // it is expired, so no point in explaining what upgrades it would
      // provide or telling you to restart your project.
      provides = <></>;
      show_run = false; // no point in showing these
    } else if (!provides_upgrades) {
      // not providing any upgrades -- tell them why
      if (info.running == null) {
        // not loaded yet...
        provides = <li>Currently providing no upgrades to this project.</li>;
      } else {
        if (!info.run_limit || info.running < info.run_limit) {
          provides = (
            <>
              <li>
                Currently providing no upgrades to this project. {render_why()}
              </li>
              <li>
                Try <Icon name="sync" />{" "}
                <a onClick={() => restart_project(false)}>
                  restarting this project
                </a>{" "}
                to attempt using the upgrades provided by this license.
              </li>
              {info?.quota && <li>{describe_quota(info.quota)}</li>}
            </>
          );
        } else {
          provides = (
            <>
              <li>Currently providing no upgrades to this project.</li>
              <li>
                <Icon name="warning" /> License is already being used to upgrade{" "}
                {info.running} other running projects, which is the limit. If
                possible, stop one of those projects, then{" "}
                <a onClick={() => restart_project(false)}>
                  restart this project.
                </a>
              </li>
            </>
          );
        }
      }
    } else {
      // not expired and is providing upgrades.
      if (upgrades == null) throw Error("make typescript happy");
      if (upgrades.has("quota")) {
        provides = (
          <li>{render_quota((upgrades.get("quota") as any)?.toJS())}</li>
        );
      } else {
        provides = (
          <li>
            Currently providing the following {plural(upgrades.size, "upgrade")}
            :
            <DisplayUpgrades
              upgrades={scale_by_display_factors(upgrades)}
              style={{
                border: "1px solid #ddd",
                padding: "0 15px",
                backgroundColor: "white",
                margin: "5px 15px",
              }}
            />
          </li>
        );
      }
    }
    return (
      <ul>
        {render_id()}
        {render_expires()}
        {provides}
        {show_run && render_applied()}
        {show_run && render_run_limit()}
        {show_run && render_running()}
        {render_activated()}
        {render_managers()}
        {render_description()}
      </ul>
    );
  }

  function render_body(): JSX.Element | undefined {
    if (loading) {
      return <Loading style={{ display: "inline" }} />;
    } else {
      return render_license();
    }
  }

  async function remove_license(): Promise<void> {
    if (typeof onRemove === "function") {
      onRemove();
    }
    if (!project_id) return;
    const actions = redux.getActions("projects");
    // newly added licenses
    try {
      await actions.remove_site_license_from_project(project_id, license_id);
    } catch (err) {
      alert_message({
        type: "error",
        message: `Unable to remove license key -- ${err}`,
      });
      return;
    }
    if (restartAfterRemove) {
      restart_project(true);
    }
  }

  function render_refresh_button(): JSX.Element {
    return (
      <Button onClick={() => fetch_info(true)}>
        <Icon name="redo" />
        <Gap /> Refresh
      </Button>
    );
  }

  function render_remove_button_extra() {
    if (!provides_upgrades) return null;
    return (
      <>
        <br />
        The project will no longer get upgraded using this license.{" "}
        {restartAfterRemove && (
          <>
            <br />
            <strong>
              It will also restart, interrupting any running computations.
            </strong>
          </>
        )}
      </>
    );
  }

  function render_remove_button(): JSX.Element | undefined {
    if (!project_id && onRemove == null) return;
    if (tableMode) return;
    const extra = render_remove_button_extra();
    return (
      <Popconfirm
        title={
          <div>
            Are you sure you want to remove this license from the project?
            {extra}
          </div>
        }
        onConfirm={remove_license}
        okText={"Remove"}
        cancelText={"Cancel"}
      >
        <Button>
          <Icon name="times" />
          <Gap /> Remove...
        </Button>
      </Popconfirm>
    );
  }

  // render information about when the license was activated
  function render_activated(): JSX.Element | undefined {
    const activates = info?.activates;
    if (activates == null) return;
    if (activates > new Date()) {
      return (
        <li style={{ fontWeight: "bold" }}>
          Will activate <TimeAgo date={activates} />
        </li>
      );
    } else {
      return (
        <li>
          Activated <TimeAgo date={activates} />
        </li>
      );
    }
  }

  function render_title(): JSX.Element | undefined {
    if (is_editing_title) {
      return (
        <DebounceInput
          style={{ width: "50%" }}
          element={Input as any}
          placeholder={"Title"}
          value={title}
          onChange={(e) => set_title(e.target.value)}
          onBlur={async () => {
            if (title == info?.title) {
              set_is_editing_title(false);
            }
            const query = {
              manager_site_licenses: {
                id: license_id,
                title,
              },
            };
            await webapp_client.query({ query });
            if (!isMountedRef.current) return;
            await fetch_info(true);
            if (!isMountedRef.current) return;
            set_is_editing_title(false);
          }}
        />
      );
    }
    if (!info?.title) {
      if (!info?.is_manager) return;
      return (
        <Button
          style={{ marginBottom: "5px" }}
          onClick={() => {
            set_is_editing_title(true);
            set_title(info?.title);
          }}
        >
          Set title...
        </Button>
      );
    }
    return (
      <div
        style={{
          whiteSpace: "pre-wrap",
          border: "1px solid lightgrey",
          background: "white",
          padding: "4px 11px",
          display: "inline-block",
          margin: "5px 0",
        }}
        onClick={
          info?.is_manager
            ? () => {
                set_is_editing_title(true);
                set_title(info?.title);
              }
            : undefined
        }
      >
        {info?.title}
      </div>
    );
  }

  function render_description(): JSX.Element | undefined {
    if (is_editing_description) {
      return (
        <DebounceInput
          autoSize={{ minRows: 1, maxRows: 6 }}
          element={Input.TextArea as any}
          placeholder={"Description"}
          value={description}
          onChange={(e) => set_description(e.target.value)}
          onBlur={async () => {
            if (description == info?.description) {
              set_is_editing_description(false);
            }
            const query = {
              manager_site_licenses: {
                id: license_id,
                description,
              },
            };
            await webapp_client.query({ query });
            set_is_editing_description(false);
            if (!isMountedRef.current) return;
            await fetch_info(true);
            if (!isMountedRef.current) return;
          }}
        />
      );
    }
    if (!info?.description) {
      if (!info?.is_manager) return;
      return (
        <Button
          onClick={() => {
            set_is_editing_description(true);
            set_description(info?.description);
          }}
        >
          Set description...
        </Button>
      );
    }
    return (
      <li
        style={{
          whiteSpace: "pre-wrap",
          border: "1px solid lightgrey",
          background: "white",
          padding: "4px 11px",
        }}
        onClick={
          info?.is_manager
            ? () => {
                set_is_editing_description(true);
                set_description(info?.description);
              }
            : undefined
        }
      >
        {info?.description}
      </li>
    );
  }

  function render_err(): JSX.Element | undefined {
    if (err) {
      return (
        <div>
          <br />
          {err}
        </div>
      );
    }
  }

  function render_warning(): JSX.Element | undefined {
    if (warn_if == null || info == null) return;
    const s = warn_if(info);
    if (!s) return;
    return (
      <div>
        <hr />
        {s}
      </div>
    );
  }

  function render_add_search_result(): JSX.Element | undefined {
    if (manager_search_result === false) {
      return;
    }
    if (manager_search_result === undefined) {
      return (
        <div>
          No user found{" "}
          <Button onClick={() => set_manager_search_result(false)}>OK</Button>
        </div>
      );
    }
    const active = manager_search_result.last_active ? (
      <>
        {" "}
        (last active <TimeAgo date={manager_search_result.last_active} />)
      </>
    ) : (
      " (created account, but never used it)"
    );
    return (
      <div
        style={{
          background: "white",
          border: "1px solid grey",
          padding: "5px",
          margin: "15px",
        }}
      >
        Add{" "}
        <b>
          {manager_search_result.first_name ?? ""}{" "}
          {manager_search_result.last_name ?? ""}
        </b>
        {active}?
        <br />
        <Button
          onClick={() => {
            set_manager_search_result(false);
            do_add_manager(manager_search_result.account_id);
          }}
        >
          Add
        </Button>{" "}
        <Button onClick={() => set_manager_search_result(false)}>Cancel</Button>
      </div>
    );
  }

  function render_add_manager(): JSX.Element {
    if (is_adding_manager) {
      return (
        <span>
          ,{" "}
          <Input
            autoFocus
            placeholder="Email address or name..."
            style={{ width: "auto" }}
            value={manager_search}
            onChange={(e) => {
              set_manager_search(e.target.value);
            }}
          />{" "}
          <Button disabled={!manager_search} onClick={add_manager}>
            Search
          </Button>{" "}
          <Button
            onClick={() => {
              set_manager_search("");
              set_is_adding_manager(false);
            }}
          >
            Cancel
          </Button>
        </span>
      );
    } else {
      return (
        <a onClick={() => set_is_adding_manager(true)}>
          , <Icon name="plus-circle" /> New...
        </a>
      );
    }
  }

  function render_manager(account_id: string): JSX.Element | null {
    if (account_id == redux.getStore("account").get("account_id")) return null;
    return (
      <span key={account_id}>
        ,{" "}
        <Popconfirm
          title={
            <>
              Remove manager{" "}
              <b>
                <User account_id={account_id} user_map={user_map} />?
              </b>
              <br />
              They will no longer see this license listed under licenses they
              manage.
              <br /> License will <i>not</i> be automatically removed from any
              projects they applied it to.
            </>
          }
          onConfirm={() => do_remove_manager(account_id)}
          okText={"Remove"}
          cancelText={"Cancel"}
        >
          <a>
            <User account_id={account_id} user_map={user_map} />
          </a>
        </Popconfirm>
      </span>
    );
  }

  function render_managers(): JSX.Element | undefined {
    if (!info?.is_manager || !info.managers) return; // only show info about managers to managers
    return (
      <li key="managers">
        {plural(info.managers.length, "Manager")}: You
        {info.managers.map(render_manager)}
        {render_add_manager()}
        {render_add_search_result()}
      </li>
    );
  }

  const message = (
    <div>
      <Button.Group style={{ float: "right" }}>
        {render_refresh_button()}
        {render_remove_button()}
      </Button.Group>
      {project_id != null && (
        <Icon style={{ marginRight: "15px" }} name="key" />
      )}
      {render_body()}
      <br />
      {render_upgrades()}
      {render_err()}
      {render_warning()}
      {is_commercial &&
        license_id &&
        managedLicenses?.getIn([
          license_id,
          "info",
          "purchased",
          "account_id",
        ]) == redux.getStore("account").get("account_id") && (
          <div>
            {info?.subscription_id && (
              <div style={{ marginTop: "15px" }}>
                <Subscription subscription_id={info.subscription_id} />
              </div>
            )}
            <EditLicense
              license_id={license_id}
              refresh={() => {
                fetch_info(true);
                refresh?.();
              }}
            />
          </div>
        )}
    </div>
  );
  return (
    <Alert
      banner={tableMode}
      showIcon={false}
      style={{ marginTop: "5px", minHeight: "48px" }}
      message={message}
      type={get_type()}
    />
  );
};
