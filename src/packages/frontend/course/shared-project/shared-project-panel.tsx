/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

import { UsergroupAddOutlined } from "@ant-design/icons";
import { Button, Card, Popconfirm } from "antd";
import { AppRedux, useActions } from "@cocalc/frontend/app-framework";
import { Icon } from "@cocalc/frontend/components";
import { CancelText } from "@cocalc/frontend/i18n/components";
import { CourseActions } from "../actions";
import { CourseSettingsRecord } from "../store";
import { DeleteSharedProjectPanel } from "./delete-shared-project";

interface SharedProjectPanelProps {
  settings: CourseSettingsRecord;
  redux: AppRedux;
  name: string;
  close?: Function;
}

export function SharedProjectPanel({
  settings,
  redux,
  name,
  close,
}: SharedProjectPanelProps) {
  const actions = useActions<CourseActions>({ name });

  function panel_header_text(): string {
    if (settings.get("shared_project_id")) {
      return "Shared project that everybody can fully use";
    } else {
      return "Optionally create a shared project for everybody";
    }
  }

  function render_content() {
    if (settings.get("shared_project_id")) {
      return render_has_shared_project();
    } else {
      return render_no_shared_project();
    }
  }

  function render_has_shared_project() {
    return (
      <div>
        <div style={{ color: "#444" }}>
          <p>
            You created a common shared project, which everybody -- students and
            all collaborators on this project (your TAs and other instructors)
            -- have <b>write</b> access to. Use this project for collaborative
            in-class labs, course-wide chat rooms, and making miscellaneous
            materials available for students to experiment with together.
          </p>
          <p>
            When you created the shared project, everybody who has already
            created an account is added as a collaborator to the project.
            Whenever you re-open this course, any students or collaborators on
            the project that contains this course will be added to the shared
            project.
          </p>
        </div>
        <br />
        <div style={{ textAlign: "center" }}>
          <Button onClick={open_project} size={"large"} type={"primary"}>
            Open shared project
          </Button>
        </div>
        <hr />
        <DeleteSharedProjectPanel
          settings={settings}
          actions={actions}
          close={close}
        />
      </div>
    );
  }

  function open_project(): void {
    redux.getActions("projects").open_project({
      project_id: settings.get("shared_project_id"),
    });
    close?.();
  }

  function render_no_shared_project() {
    return (
      <div>
        <div style={{ color: "#444" }}>
          <p>
            <i>Optionally</i> create a single common shared project, which
            everybody -- students and all collaborators on this project (your
            TAs and other instructors) -- will have <b>write</b> access to. This
            can be useful for collaborative in-class labs, course-wide chat
            rooms, and making miscellanous materials available for students to
            experiment with together.
          </p>
          <p>
            When you create the shared project, everybody who has already
            created an account is added as a collaborator to the project.
            Whenever you re-open this course, any students or collaborators on
            the project that contains this course will be added to the shared
            project.
          </p>
          <p>
            After you create the shared project, you should move the shared
            project to a members only server or upgrade it in other ways if you
            want it to be more stable.
          </p>
        </div>
        <br />
        <Popconfirm
          title={
            <div style={{ maxWidth: "400px" }}>
              Are you sure you want to create a shared project and add all
              students in this course as collaborators?
            </div>
          }
          onConfirm={() => {
            const actions = redux.getActions(name) as CourseActions;
            if (actions != null) {
              actions.shared_project.create();
              close?.();
            }
          }}
          okText="Create Shared Project"
          cancelText={<CancelText />}
        >
          <Button size={"large"} icon={<UsergroupAddOutlined />}>
            Create shared project...
          </Button>
        </Popconfirm>
      </div>
    );
  }

  return (
    <div className="smc-vfill" style={{ overflow: "auto" }}>
      <Card
        style={{ maxWidth: "800px", margin: "auto" }}
        title={
          <>
            <Icon name="users" /> {panel_header_text()}
          </>
        }
      >
        {render_content()}
      </Card>
    </div>
  );
}
