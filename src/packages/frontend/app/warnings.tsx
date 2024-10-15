/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

import { React, redux, TypedMap } from "@cocalc/frontend/app-framework";
import { Gap, Icon } from "@cocalc/frontend/components";
import { SiteName } from "@cocalc/frontend/customize";
import { get_browser } from "@cocalc/frontend/feature";
import { webapp_client } from "@cocalc/frontend/webapp-client";

interface VersionWarningProps {
  new_version: TypedMap<{ min_version: number; version: number }>;
}

const VERSION_WARNING_STYLE: React.CSSProperties = {
  fontSize: "12pt",
  position: "fixed",
  left: 12,
  backgroundColor: "#fcf8e3",
  color: "#8a6d3b",
  top: 20,
  borderRadius: 4,
  padding: "15px",
  zIndex: 900,
  boxShadow: "8px 8px 4px #888",
  width: "70%",
  marginTop: "1em",
} as const;

export const VersionWarning: React.FC<VersionWarningProps> = React.memo(
  ({ new_version }) => {
    function render_critical() {
      if (new_version.get("min_version") <= webapp_client.version()) {
        return;
      }
      return (
        <div>
          <br />
          THIS IS A CRITICAL UPDATE. YOU MUST <Gap />
          <a
            onClick={() => window.location.reload()}
            style={{
              cursor: "pointer",
              color: "white",
              fontWeight: "bold",
              textDecoration: "underline",
            }}
          >
            RELOAD THIS PAGE
          </a>
          <Gap /> IMMEDIATELY OR YOU WILL BE DISCONNECTED. Sorry for the
          inconvenience.
        </div>
      );
    }

    function render_close() {
      if (new_version.get("min_version") <= webapp_client.version()) {
        return (
          <Icon
            name="times"
            className="pull-right"
            style={{ cursor: "pointer" }}
            onClick={() => redux.getActions("page").set_new_version(undefined)}
          />
        );
      }
    }

    let style: React.CSSProperties = VERSION_WARNING_STYLE;
    if (new_version.get("min_version") > webapp_client.version()) {
      style = { ...style, ...{ backgroundColor: "red", color: "#fff" } };
    }

    return (
      <div style={style}>
        <Icon name={"refresh"} /> New Version Available: upgrade by <Gap />
        <a
          onClick={() => window.location.reload()}
          style={{
            cursor: "pointer",
            fontWeight: "bold",
            color: style.color,
            textDecoration: "underline",
          }}
        >
          reloading this page
        </a>
        .{render_close()}
        {render_critical()}
      </div>
    );
  },
);

const WARNING_STYLE: React.CSSProperties = {
  position: "fixed",
  left: 12,
  backgroundColor: "red",
  color: "#fff",
  top: 20,
  opacity: 0.9,
  borderRadius: 4,
  padding: 5,
  marginTop: "1em",
  zIndex: 100000,
  boxShadow: "8px 8px 4px #888",
  width: "70%",
} as const;

export const CookieWarning: React.FC = React.memo(() => {
  return (
    <div style={WARNING_STYLE}>
      <Icon name="warning" /> You <em>must</em> enable cookies to use{" "}
      <SiteName />.
    </div>
  );
});

const STORAGE_WARNING_STYLE: React.CSSProperties = {
  ...WARNING_STYLE,
  top: 55,
};

export const LocalStorageWarning: React.FC = React.memo(() => {
  return (
    <div style={STORAGE_WARNING_STYLE}>
      <Icon name="warning" /> You <em>must</em> enable local storage to use{" "}
      <SiteName />
      {get_browser() === "safari"
        ? " (on Safari you must disable private browsing mode)"
        : undefined}
      .
    </div>
  );
});
