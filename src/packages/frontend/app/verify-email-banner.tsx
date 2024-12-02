/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

import { Space } from "antd";
import { FormattedMessage, useIntl } from "react-intl";

import { emailVerificationMsg } from "@cocalc/frontend/account/settings/email-verification";
import { Button } from "@cocalc/frontend/antd-bootstrap";
import {
  CSS,
  redux,
  useActions,
  useAsyncEffect,
  useState,
  useTypedRedux,
} from "@cocalc/frontend/app-framework";
import { CloseX2, HelpIcon, Icon, Text } from "@cocalc/frontend/components";
import { labels } from "@cocalc/frontend/i18n";
import * as LS from "@cocalc/frontend/misc/local-storage-typed";
import { webapp_client } from "@cocalc/frontend/webapp-client";
import { once } from "@cocalc/util/async-utils";
import { COLORS } from "@cocalc/util/theme";

const VERIFY_EMAIL_STYLE: CSS = {
  width: "100%",
  padding: "5px",
  borderBottom: `1px solid ${COLORS.GRAY_D}`,
  background: COLORS.ATND_BG_RED_L,
} as const;

const DISMISSED_KEY_LS = "verify-email-dismissed";

export function VerifyEmail() {
  const intl = useIntl();
  const page_actions = useActions("page");
  const email_address = useTypedRedux("account", "email_address");

  const [error, setError] = useState<string>("");
  const [show, setShow] = useState<boolean>(true);
  const [sending, setSending] = useState<boolean>(false);
  const [sent, setSent] = useState<boolean>(false);

  async function verify(): Promise<void> {
    try {
      setSending(true);
      await webapp_client.account_client.send_verification_email();
    } catch (err) {
      const errMsg = `Problem sending email verification: ${err}`;
      setError(errMsg);
    } finally {
      setSent(true);
    }
  }

  // TODO: at one point this should be a popup to just edit the email address
  function edit() {
    page_actions.set_active_tab("account");
  }

  function dismiss() {
    const now = webapp_client.server_time().getTime();
    LS.set(DISMISSED_KEY_LS, now);
    setShow(false);
  }

  function renderBanner() {
    if (error) {
      return <Text type="danger">{error}</Text>;
    }
    return (
      <Text strong>
        <Icon name="mail" />{" "}
        <FormattedMessage
          id="app.verify-email-banner.text"
          defaultMessage={`{sent, select,
            true {Sent! Plesae check your email inbox (maybe spam) and click on the confirmation link.}
            other {Please check and verify your email address: <code>{email}</code>}}`}
          values={{
            sent,
            email: email_address,
            code: (c) => <Text code>{c}</Text>,
          }}
        />{" "}
        {sent ? (
          <Button
            onClick={() => setShow(false)}
            bsStyle="success"
            bsSize={"xsmall"}
          >
            {intl.formatMessage(labels.close)}
          </Button>
        ) : (
          <Space size={"small"}>
            <Button bsSize={"xsmall"} onClick={edit}>
              <Icon name="pencil" /> {intl.formatMessage(labels.edit)}
            </Button>
            <Button
              onClick={verify}
              bsStyle="success"
              disabled={sent || sending}
              bsSize={"xsmall"}
            >
              {intl.formatMessage(emailVerificationMsg, {
                disabled_button: sent,
              })}
            </Button>
            <HelpIcon
              title={intl.formatMessage({
                id: "app.verify-email-banner.help.title",
                defaultMessage: "Email Verification",
              })}
            >
              <FormattedMessage
                id="app.verify-email-banner.help.text"
                defaultMessage="It's important to have a working email address. We use this for password resets, sending messages, billing notifications, and support. Please ensure your email is correct to stay informed."
              />
            </HelpIcon>
          </Space>
        )}
      </Text>
    );
  }

  if (!show) return;

  return (
    <div style={VERIFY_EMAIL_STYLE}>
      {renderBanner()}
      <CloseX2 close={dismiss} />
    </div>
  );
}

export function useShowVerifyEmail(): boolean {
  const email_address = useTypedRedux("account", "email_address");
  const email_address_verified = useTypedRedux(
    "account",
    "email_address_verified",
  );
  const [loaded, setLoaded] = useState<boolean>(false);

  // wait until the account settings are loaded to show the banner
  useAsyncEffect(async () => {
    const store = redux.getStore("account");
    if (!store.get("is_ready")) {
      await once(store, "is_ready");
    }
    setLoaded(true);
  }, []);

  const created = useTypedRedux("account", "created");

  const dismissedTS = LS.get<number>(DISMISSED_KEY_LS);

  const show_verify_email =
    !email_address || !email_address_verified?.get(email_address);

  // we also do not show this for newly created accounts
  const now = webapp_client.server_time().getTime();
  const oneDay = 1 * 24 * 60 * 60 * 1000;
  const notTooNew = created != null && now > created.getTime() + oneDay;

  // dismissed banner works for a week
  const dismissed =
    typeof dismissedTS === "number" && now < dismissedTS + 7 * oneDay;

  return show_verify_email && loaded && notTooNew && !dismissed;
}
