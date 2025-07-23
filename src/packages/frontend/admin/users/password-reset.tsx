/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

import { Component, Rendered } from "@cocalc/frontend/app-framework";
import { Button } from "@cocalc/frontend/antd-bootstrap";
import {
  CopyToClipBoard,
  Icon,
  ErrorDisplay,
} from "@cocalc/frontend/components";
import { webapp_client } from "../../webapp-client";
import { appBasePath } from "@cocalc/frontend/customize/app-base-path";

interface Props {
  account_id: string;
  email_address: string;
}

interface State {
  error?: string;
  running: boolean;
  link?: string;
}

export class PasswordReset extends Component<Props, State> {
  mounted: boolean = true;

  constructor(props: any) {
    super(props);
    this.state = { running: false };
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  async do_request(): Promise<void> {
    this.setState({ running: true });
    let link: string;
    try {
      link = await webapp_client.conat_client.hub.system.adminResetPasswordLink(
        { user_account_id: this.props.account_id },
      );
    } catch (err) {
      if (!this.mounted) return;
      this.setState({ error: `${err}`, running: false });
      return;
    }
    if (!this.mounted) return;
    link = `${document.location.origin}${
      appBasePath.length <= 1 ? "" : appBasePath
    }${link}`;
    this.setState({ link, running: false });
  }

  render_password_reset_button(): Rendered {
    return (
      <Button
        disabled={this.state.running}
        onClick={() => {
          this.do_request();
        }}
      >
        <Icon
          name={this.state.running ? "sync" : "lock-open"}
          spin={this.state.running}
        />{" "}
        Request Password Reset Link...
      </Button>
    );
  }

  render_error(): Rendered {
    if (!this.state.error) {
      return;
    }
    return (
      <ErrorDisplay
        style={{ margin: "30px" }}
        error={this.state.error}
        onClose={() => {
          this.setState({ error: undefined });
        }}
      />
    );
  }

  render_password_reset_link(): Rendered {
    if (!this.state.link) return;
    return (
      <div>
        <div style={{ marginTop: "20px" }}>
          {" "}
          Send this somehow to{" "}
          <a
            href={`mailto:${this.props.email_address}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {this.props.email_address}.
          </a>
          <br />
          <CopyToClipBoard value={this.state.link} />
        </div>
      </div>
    );
  }

  render(): Rendered {
    if (!this.props.email_address) {
      return (
        <div>
          User does not have an email address set, so password reset does not
          make sense.
        </div>
      );
    }
    return (
      <div>
        <b>Password Reset:</b>
        <br />
        {this.render_error()}
        {this.render_password_reset_button()}
        {this.render_password_reset_link()}
        <br />
        <br />
      </div>
    );
  }
}
