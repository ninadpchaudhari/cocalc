/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

import { Popconfirm, Button, Card } from "antd";
import { Icon } from "@cocalc/frontend/components";

export function DeleteSharedProjectPanel({ actions, settings, close }) {
  if (!settings.get("shared_project_id")) {
    return <Card title={"No Shared Project"}></Card>;
  }
  return (
    <Card
      title={
        <Popconfirm
          title="Are you sure you want to delete the shared project?"
          okText="Yes"
          cancelText="No"
          onConfirm={() => {
            actions.shared_project.delete();
            close?.();
          }}
        >
          <Button danger>
            <Icon name="trash" /> Delete Shared Project...
          </Button>
        </Popconfirm>
      }
    >
      If you would like to delete the shared projects that was created for this
      course, you may do so by clicking above. All students will be removed from
      the deleted shared project.
    </Card>
  );
}
