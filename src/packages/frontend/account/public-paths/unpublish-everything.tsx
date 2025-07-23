/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

import { Alert, Button, Input } from "antd";
import { useIntl } from "react-intl";

import {
  React,
  useIsMountedRef,
  useMemo,
  useState,
} from "@cocalc/frontend/app-framework";
import { webapp_client } from "@cocalc/frontend/webapp-client";
import { PublicPath } from "@cocalc/util/db-schema/public-paths";
import { plural } from "@cocalc/util/misc";

interface Props {
  data?: PublicPath[];
  refresh: Function;
}

export const UnpublishEverything: React.FC<Props> = React.memo(
  ({ data, refresh }) => {
    const intl = useIntl();
    const [confirm, set_confirm] = useState<boolean>(false);
    const [confirm_text, set_confirm_text] = useState<string>("");
    const [counter, set_counter] = useState<number>(-1);
    const isMountedRef = useIsMountedRef();

    const unpublishEverything = intl.formatMessage({
      id: "account.public-path.unpublish.title",
      defaultMessage: "Unpublish Everything",
    });

    const num_published = useMemo(() => {
      if (data == null) return -1;
      let n = 0;
      for (const x of data) {
        if (!x.disabled) {
          n += 1;
        }
      }
      return n;
    }, [data]);

    function render_confirm(): React.JSX.Element {
      const goal = "YES, UNPUBLISH EVERYTHING!";
      const body = (
        <div>
          <div style={{ fontSize: "12pt", margin: "auto", maxWidth: "800px" }}>
            {`Are you sure you want to unpublish ALL ${num_published} listed and unlisted ${plural(
              num_published,
              "path",
            )} published in all projects on which you collaborate and have been active?  You cannot easily undo this operation, though you could tediously republish everything.  To unpublish everything type "${goal}" below, then click the button.`}
          </div>
          <br />
          <br />
          <Input
            size="large"
            placeholder={goal}
            value={confirm_text}
            onChange={(e) => set_confirm_text(e.target.value)}
          />
          <br />
          <br />
          <Button
            disabled={confirm_text != goal}
            onClick={() => {
              set_confirm(false);
              set_confirm_text("");
              disable_all();
            }}
          >
            {unpublishEverything}
          </Button>
        </div>
      );
      return (
        <Alert
          style={{ marginBottom: "20px" }}
          message={<h3>{unpublishEverything}?</h3>}
          description={body}
          type="warning"
          showIcon
          closable
          afterClose={() => {
            set_confirm(false);
            set_confirm_text("");
          }}
        />
      );
    }

    async function disable_all(): Promise<void> {
      if (data == null) return;
      set_counter(0);
      for (const x of data) {
        if (x.disabled) continue;
        if (!isMountedRef.current) return;
        await webapp_client.async_query({
          query: {
            public_paths: {
              id: x.id,
              project_id: x.project_id,
              path: x.path,
              disabled: true,
            },
          },
        });
        set_counter(counter + 1);
      }
      refresh();
      set_counter(-1);
    }

    return (
      <div>
        {confirm && render_confirm()}
        {counter >= 0 && num_published > 0 && (
          <h1>
            Unpublished: {counter}/{num_published}
          </h1>
        )}
        <Button
          onClick={() => set_confirm(true)}
          disabled={num_published == 0 || confirm}
        >
          {unpublishEverything}...
        </Button>
      </div>
    );
  },
);
