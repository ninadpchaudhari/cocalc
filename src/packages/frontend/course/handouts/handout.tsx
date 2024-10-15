/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

import { redux, CSS } from "@cocalc/frontend/app-framework";
import { useState } from "react";
import { capitalize, trunc_middle } from "@cocalc/util/misc";
import { Alert, Button, Input, Card, Col, Popconfirm, Row, Space } from "antd";
import { Icon, MarkdownInput, Tip } from "../../components";
import { UserMap } from "../../todo-types";
import { CourseActions } from "../actions";
import { CourseStore, HandoutRecord, StudentsMap } from "../store";
import * as styles from "../styles";
import { StudentListForHandout } from "./handout-student-list";

// Could be merged with steps system of assignments.
// Probably not a good idea mixing the two.
// Could also be coded into the components below but steps could be added in the future?
const STEPS = ["handout"] as const;
type STEP_TYPES = (typeof STEPS)[number];

function step_direction(step: STEP_TYPES): string {
  switch (step) {
    case "handout":
      return "to";
    default:
      throw Error(`BUG! step_direction('${step}')`);
  }
}

function step_verb(step: STEP_TYPES): string {
  switch (step) {
    case "handout":
      return "distribute";
    default:
      throw Error(`BUG! step_verb('${step}')`);
  }
}

function step_ready(step: STEP_TYPES): string | undefined {
  switch (step) {
    case "handout":
      return "";
  }
}

function past_tense(word: string): string {
  if (word[word.length - 1] === "e") {
    return word + "d";
  } else {
    return word + "ed";
  }
}

interface HandoutProps {
  frame_id?: string;
  name: string;
  handout: HandoutRecord;
  backgroundColor?: string;
  actions: CourseActions;
  is_expanded: boolean;
  students: StudentsMap;
  user_map: UserMap;
  project_id: string;
}

export function Handout({
  frame_id,
  name,
  handout,
  backgroundColor,
  actions,
  is_expanded,
  students,
  user_map,
  project_id,
}: HandoutProps) {
  const [copy_confirm, set_copy_confirm] = useState<boolean>(false);
  const [copy_confirm_handout, set_copy_confirm_handout] =
    useState<boolean>(false);
  const [copy_confirm_all_handout, set_copy_confirm_all_handout] =
    useState<boolean>(false);
  const [copy_handout_confirm_overwrite, set_copy_handout_confirm_overwrite] =
    useState<boolean>(false);
  const [
    copy_handout_confirm_overwrite_text,
    set_copy_handout_confirm_overwrite_text,
  ] = useState<string>("");

  function open_handout_path(e) {
    e.preventDefault();
    const actions = redux.getProjectActions(project_id);
    if (actions != null) {
      actions.open_directory(handout.get("path"));
    }
  }

  function render_more_header() {
    return (
      <div style={{ display: "flex" }}>
        <div
          style={{
            fontSize: "15pt",
            marginBottom: "5px",
            marginRight: "30px",
          }}
        >
          {handout.get("path")}
        </div>
        <Button onClick={open_handout_path}>
          <Icon name="folder-open" /> Open
        </Button>
      </div>
    );
  }

  function render_handout_notes() {
    return (
      <Row key="note" style={styles.note}>
        <Col xs={4}>
          <Tip
            title="Notes about this handout"
            tip="Record notes about this handout here. These notes are only visible to you, not to your students.  Put any instructions to students about handouts in a file in the directory that contains the handout."
          >
            function Handout Notes
            <br />
            <span style={{ color: "#666" }} />
          </Tip>
        </Col>
        <Col xs={20}>
          <MarkdownInput
            persist_id={
              handout.get("path") + handout.get("handout_id") + "note"
            }
            attach_to={name}
            rows={6}
            placeholder="function  notes about this handout (not visible to students)"
            default_value={handout.get("note")}
            on_save={(value) =>
              actions.handouts.set_handout_note(
                handout.get("handout_id"),
                value,
              )
            }
          />
        </Col>
      </Row>
    );
  }

  function render_export_file_use_times() {
    return (
      <Row key="file-use-times-export-handout">
        <Col xs={4}>
          <Tip
            title="Export when students used files"
            tip="Export a JSON file containing extensive information about exactly when students have opened or edited files in this handout.  The JSON file will open in a new tab; the access_times (in milliseconds since the UNIX epoch) are when they opened the file and the edit_times are when they actually changed it through CoCalc's web-based editor."
          >
            Export file use times
            <br />
            <span style={{ color: "#666" }} />
          </Tip>
        </Col>
        <Col xs={20}>
          <Button
            onClick={() =>
              actions.export.file_use_times(handout.get("handout_id"))
            }
          >
            Export file use times for this handout
          </Button>
        </Col>
      </Row>
    );
  }

  function render_copy_all(status) {
    const steps = STEPS;
    const result: (JSX.Element | undefined)[] = [];
    for (const step of steps) {
      if (copy_confirm_handout) {
        result.push(render_copy_confirm(step, status));
      } else {
        result.push(undefined);
      }
    }
    return result;
  }

  function render_copy_confirm(step: string, status) {
    return (
      <span key={`copy_confirm_${step}`}>
        {status[step] === 0
          ? render_copy_confirm_to_all(step, status)
          : undefined}
        {status[step] !== 0
          ? render_copy_confirm_to_all_or_new(step, status)
          : undefined}
      </span>
    );
  }

  function render_copy_cancel() {
    const cancel = (): void => {
      set_copy_confirm_handout(false);
      set_copy_confirm_all_handout(false);
      set_copy_confirm(false);
      set_copy_handout_confirm_overwrite(false);
    };
    return (
      <Button key="cancel" onClick={cancel}>
        Cancel
      </Button>
    );
  }

  function render_copy_handout_confirm_overwrite(step: string) {
    if (!copy_handout_confirm_overwrite) {
      return;
    }
    const do_it = (): void => {
      copy_handout(step, false, true);
      set_copy_handout_confirm_overwrite(false);
      set_copy_handout_confirm_overwrite_text("");
    };
    return (
      <div style={{ marginTop: "15px" }}>
        Type in "OVERWRITE" if you are certain to replace the handout files of
        all students.
        <Input
          autoFocus
          onChange={(e) =>
            set_copy_handout_confirm_overwrite_text(e.target.value)
          }
          style={{ marginTop: "1ex" }}
        />
        <Space style={{ textAlign: "center", marginTop: "15px" }}>
          {render_copy_cancel()}
          <Button
            disabled={copy_handout_confirm_overwrite_text !== "OVERWRITE"}
            danger
            onClick={do_it}
          >
            <Icon name="exclamation-triangle" /> Confirm replacing files
          </Button>
        </Space>
      </div>
    );
  }

  function copy_handout(step, new_only, overwrite?): void {
    // handout to all (non-deleted) students
    switch (step) {
      case "handout":
        actions.handouts.copy_handout_to_all_students(
          handout.get("handout_id"),
          new_only,
          overwrite,
        );
        break;
      default:
        console.log(`BUG -- unknown step: ${step}`);
    }
    set_copy_confirm_handout(false);
    set_copy_confirm_all_handout(false);
    set_copy_confirm(false);
  }

  function render_copy_confirm_to_all(step, status) {
    const n = status[`not_${step}`];
    return (
      <Alert
        type="warning"
        key={`${step}_confirm_to_all`}
        style={{ marginTop: "15px" }}
        message={
          <div>
            <div style={{ marginBottom: "15px" }}>
              {capitalize(step_verb(step))} this handout {step_direction(step)}{" "}
              the {n} student{n > 1 ? "s" : ""}
              {step_ready(step)}?
            </div>
            <Space>
              {render_copy_cancel()}
              <Button
                key="yes"
                type="primary"
                onClick={() => copy_handout(step, false)}
              >
                Yes
              </Button>
            </Space>
          </div>
        }
      />
    );
  }

  function copy_confirm_all_caution(step): string | undefined {
    switch (step) {
      case "handout":
        return `\
  This will recopy all of the files to them.
  CAUTION: if you update a file that a student has also worked on, their work will get copied to a backup file ending in a tilde, or possibly only be available in snapshots.
  Select "Replace student files!" in case you do not want to create any backups and also delete all other files in the handout directory of their projects.\
  `;
    }
  }

  function render_copy_confirm_overwrite_all(step) {
    return (
      <div key="copy_confirm_overwrite_all" style={{ marginTop: "15px" }}>
        <div style={{ marginBottom: "15px" }}>
          {copy_confirm_all_caution(step)}
        </div>
        <Space wrap>
          {render_copy_cancel()}
          <Button key="all" onClick={() => copy_handout(step, false)}>
            Yes, do it
          </Button>
          <Button
            key="all-overwrite"
            danger
            onClick={() => set_copy_handout_confirm_overwrite(true)}
          >
            Replace student files!
          </Button>
        </Space>
        {render_copy_handout_confirm_overwrite(step)}
      </div>
    );
  }

  function render_copy_confirm_to_all_or_new(step, status) {
    const n = status[`not_${step}`];
    const m = n + status[step];
    return (
      <Alert
        type="warning"
        key={`${step}_confirm_to_all_or_new`}
        style={{ marginTop: "15px" }}
        message={
          <div>
            <div style={{ marginBottom: "15px" }}>
              {capitalize(step_verb(step))} this handout {step_direction(step)}
              ...
            </div>
            <Space wrap>
              {render_copy_cancel()}
              <Button
                key="all"
                danger
                onClick={() => {
                  set_copy_confirm_all_handout(true);
                  set_copy_confirm(true);
                }}
                disabled={copy_confirm_all_handout}
              >
                {step === "handout" ? "All" : "The"} {m} students
                {step_ready(step)}
                ...
              </Button>
              {n ? (
                <Button
                  key="new"
                  type="primary"
                  onClick={() => copy_handout(step, true)}
                >
                  The {n} student{n > 1 ? "s" : ""} not already{" "}
                  {past_tense(step_verb(step))} {step_direction(step)}
                </Button>
              ) : undefined}
            </Space>
            {copy_confirm_all_handout
              ? render_copy_confirm_overwrite_all(step)
              : undefined}
          </div>
        }
      />
    );
  }

  function render_handout_button(status) {
    const handout_count = status.handout;
    const { not_handout } = status;
    let type;
    if (handout_count === 0) {
      type = "primary";
    } else {
      if (not_handout === 0) {
        type = "dashed";
      } else {
        type = "default";
      }
    }
    return (
      <Button
        key="handout"
        type={type}
        onClick={() => {
          set_copy_confirm_handout(true);
          set_copy_confirm(true);
        }}
        disabled={copy_confirm}
        style={outside_button_style}
      >
        <Tip
          title={
            <span>
              Handout: <Icon name="user-secret" /> You{" "}
              <Icon name="arrow-right" /> <Icon name="users" /> Students{" "}
            </span>
          }
          tip="Copy the files for this handout from this project to all other student projects."
        >
          <Icon name="share-square" /> Distribute...
        </Tip>
      </Button>
    );
  }

  function delete_handout(): void {
    actions.handouts.delete_handout(handout.get("handout_id"));
  }

  function undelete_handout(): void {
    actions.handouts.undelete_handout(handout.get("handout_id"));
  }

  function render_delete_button() {
    if (handout.get("deleted")) {
      return (
        <Tip
          key="delete"
          placement="left"
          title="Undelete handout"
          tip="Make the handout visible again in the handout list and in student grade lists."
        >
          <Button onClick={undelete_handout} style={outside_button_style}>
            <Icon name="trash" /> Undelete
          </Button>
        </Tip>
      );
    } else {
      return (
        <Popconfirm
          key="delete"
          onConfirm={delete_handout}
          title={
            <div style={{ maxWidth: "400px" }}>
              <b>
                Are you sure you want to delete "
                {trunc_middle(handout.get("path"), 24)}"?
              </b>
              <br />
              This removes it from the handout list and student grade lists, but
              does not delete any files off of disk. You can always undelete an
              handout later by showing it using the 'show deleted handouts'
              button.
            </div>
          }
        >
          <Button style={outside_button_style}>
            <Icon name="trash" /> Delete...
          </Button>
        </Popconfirm>
      );
    }
  }

  function render_more() {
    if (!is_expanded) return;
    return (
      <Row key="more">
        <Col sm={24}>
          <Card title={render_more_header()}>
            <StudentListForHandout
              frame_id={frame_id}
              handout={handout}
              students={students}
              user_map={user_map}
              actions={actions}
              name={name}
            />
            {render_handout_notes()}
            <br />
            <hr />
            <br />
            {render_export_file_use_times()}
          </Card>
        </Col>
      </Row>
    );
  }

  const outside_button_style: CSS = {
    margin: "4px",
    paddingTop: "6px",
    paddingBottom: "4px",
  };

  function render_handout_name() {
    return (
      <h5>
        <a
          href=""
          onClick={(e) => {
            e.preventDefault();
            return actions.toggle_item_expansion(
              "handout",
              handout.get("handout_id"),
            );
          }}
        >
          <Icon
            style={{ marginRight: "10px", float: "left" }}
            name={is_expanded ? "caret-down" : "caret-right"}
          />
          <div>
            {trunc_middle(handout.get("path"), 24)}
            {handout.get("deleted") ? <b> (deleted)</b> : undefined}
          </div>
        </a>
      </h5>
    );
  }

  function get_store(): CourseStore {
    const store = redux.getStore(name);
    if (store == null) throw Error("store must be defined");
    return store as unknown as CourseStore;
  }

  function render_handout_heading() {
    let status = get_store().get_handout_status(handout.get("handout_id"));
    if (status == null) {
      status = {
        handout: 0,
        not_handout: 0,
      };
    }
    return (
      <Row key="summary" style={{ backgroundColor: backgroundColor }}>
        <Col md={8} style={{ paddingRight: "0px" }}>
          {render_handout_name()}
        </Col>
        <Col md={8}>
          <Row style={{ marginLeft: "8px" }}>
            {render_handout_button(status)}
            <span
              style={{ color: "#666", marginLeft: "5px", marginTop: "10px" }}
            >
              ({status.handout}/{status.handout + status.not_handout}{" "}
              transferred)
            </span>
          </Row>
          <Row style={{ marginLeft: "8px" }}>{render_copy_all(status)}</Row>
        </Col>
        <Col md={8}>
          <Row>
            <span className="pull-right">{render_delete_button()}</span>
          </Row>
        </Col>
      </Row>
    );
  }

  return (
    <div>
      <Row style={is_expanded ? styles.selected_entry : styles.entry_style}>
        <Col xs={24} style={{ paddingTop: "5px", paddingBottom: "5px" }}>
          {render_handout_heading()}
          {render_more()}
        </Col>
      </Row>
    </div>
  );
}
