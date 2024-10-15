/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

import { Button, Col, Row, Space, Spin } from "antd";
import { ReactNode, useRef, useState } from "react";
import { useActions } from "@cocalc/frontend/app-framework";
import { Icon, Markdown, Gap, Tip } from "@cocalc/frontend/components";
import { MarkdownInput } from "@cocalc/frontend/editors/markdown-input";
import { NotebookScores } from "@cocalc/frontend/jupyter/nbgrader/autograde";
import { to_json } from "@cocalc/util/misc";
import { BigTime } from ".";
import { CourseActions } from "../actions";
import { NbgraderScores } from "../nbgrader/scores";
import {
  AssignmentRecord,
  LastCopyInfo,
  NBgraderRunInfo,
  StudentRecord,
} from "../store";
import { AssignmentCopyType } from "../types";
import { useButtonSize } from "../util";
import { webapp_client } from "@cocalc/frontend/webapp-client";
import { COPY_TIMEOUT_MS } from "@cocalc/frontend/course/consts";
import ShowError from "@cocalc/frontend/components/error";

interface StudentAssignmentInfoProps {
  name: string;
  title: ReactNode;
  student: StudentRecord;
  assignment: AssignmentRecord;
  grade?: string;
  comments?: string;
  info: {
    assignment_id: string;
    student_id: string;
    peer_assignment: boolean;
    peer_collect: boolean;
    last_assignment?: LastCopyInfo;
    last_collect?: LastCopyInfo;
    last_peer_assignment?: LastCopyInfo;
    last_peer_collect?: LastCopyInfo;
    last_return_graded?: LastCopyInfo;
  };
  nbgrader_scores?: { [ipynb: string]: NotebookScores | string };
  nbgrader_score_ids?: { [ipynb: string]: string[] };
  is_editing: boolean;
  nbgrader_run_info?: NBgraderRunInfo;
}

const STEPS = [
  "Assign",
  "Collect",
  "Peer Assign",
  "Peer Collect",
  "Return",
] as const;
type Steps = (typeof STEPS)[number];

interface RenderLastProps {
  step: Steps;
  type: AssignmentCopyType;
  data?: any;
  enable_copy?: boolean;
  copy_tip?: string;
  open_tip?: string;
  omit_errors?: boolean;
}

const RECOPY_INIT: Record<Steps, false> = {
  Assign: false,
  Collect: false,
  "Peer Assign": false,
  Return: false,
  "Peer Collect": false,
};

function useRecopy(): [
  typeof RECOPY_INIT,
  (key: keyof typeof RECOPY_INIT, value: boolean) => void,
] {
  const [recopy, set_recopy] = useState<typeof RECOPY_INIT>(RECOPY_INIT);
  function set(key: keyof typeof RECOPY_INIT, value: boolean) {
    set_recopy({ ...recopy, [key]: value });
  }
  return [recopy, set];
}

export function StudentAssignmentInfo({
  name,
  title,
  student,
  assignment,
  grade = "",
  comments = "",
  info,
  nbgrader_scores,
  nbgrader_score_ids,
  is_editing,
  nbgrader_run_info,
}: StudentAssignmentInfoProps) {
  const clicked_nbgrader = useRef<Date>();
  const actions = useActions<CourseActions>({ name });
  const size = useButtonSize();
  const [recopy, set_recopy] = useRecopy();

  function open(
    type: AssignmentCopyType,
    assignment_id: string,
    student_id: string,
  ) {
    return actions.assignments.open_assignment(type, assignment_id, student_id);
  }

  function copy(
    type: AssignmentCopyType,
    assignment_id: string,
    student_id: string,
  ) {
    return actions.assignments.copy_assignment(type, assignment_id, student_id);
  }

  function stop(
    type: AssignmentCopyType,
    assignment_id: string,
    student_id: string,
  ) {
    actions.assignments.stop_copying_assignment(
      assignment_id,
      student_id,
      type,
    );
  }

  function set_edited_feedback() {
    actions.assignments.update_edited_feedback(
      assignment.get("assignment_id"),
      student.get("student_id"),
    );
  }

  function stop_editing() {
    actions.assignments.clear_edited_feedback(
      assignment.get("assignment_id"),
      student.get("student_id"),
    );
  }

  function render_grade() {
    if (is_editing) {
      return (
        <MarkdownInput
          placeholder="Grade..."
          value={grade || ""}
          onBlur={(grade) => {
            actions.assignments.set_grade(
              assignment.get("assignment_id"),
              student.get("student_id"),
              grade,
            );
          }}
          onShiftEnter={() => stop_editing()}
          height="3em"
          hideHelp
          style={{ margin: "5px 0" }}
          autoFocus
        />
      );
    } else {
      const text =
        (grade ?? "").trim() || (comments ?? "").trim()
          ? `Grade: ${grade}`
          : "Enter grade...";
      return (
        <Button
          key="edit"
          onClick={() => set_edited_feedback()}
          disabled={is_editing}
          size={size}
        >
          {text}
        </Button>
      );
    }
  }

  function render_comments() {
    if (!is_editing) {
      if (!comments?.trim()) return;
      return (
        <div style={{ width: "100%", paddingRight: "5px" }}>
          <Markdown
            value={comments}
            style={{
              width: "100%",
              maxHeight: "4em",
              overflowY: "auto",
              padding: "5px",
              border: "1px solid lightgray",
              cursor: "pointer",
              display: "inline-block",
            }}
            onClick={() => set_edited_feedback()}
          />
        </div>
      );
    } else {
      return (
        <MarkdownInput
          placeholder="Optional markdown comments..."
          value={comments || ""}
          onBlur={(comment) => {
            actions.assignments.set_comment(
              assignment.get("assignment_id"),
              student.get("student_id"),
              comment,
            );
          }}
          onShiftEnter={() => stop_editing()}
          height="7em"
          hideHelp
        />
      );
    }
  }

  function render_nbgrader_scores() {
    if (!nbgrader_scores) return;
    return (
      <div>
        <NbgraderScores
          show_all={is_editing}
          set_show_all={() => set_edited_feedback()}
          nbgrader_scores={nbgrader_scores}
          nbgrader_score_ids={nbgrader_score_ids}
          name={name}
          student_id={student.get("student_id")}
          assignment_id={assignment.get("assignment_id")}
        />
        {render_run_nbgrader("Run nbgrader again")}
      </div>
    );
  }

  function render_run_nbgrader(label: JSX.Element | string) {
    let running = false;
    if (nbgrader_run_info != null) {
      const t = nbgrader_run_info.get(
        assignment.get("assignment_id") + "-" + student.get("student_id"),
      );
      if (t && webapp_client.server_time() - t <= 1000 * 60 * 10) {
        // Time starting is set and it's also within the last few minutes.
        // This "few minutes" is just in case -- we probably shouldn't need
        // that at all ever, but it could make cocalc state usable in case of
        // weird issues, I guess).  User could also just close and re-open
        // the course file, which resets this state completely.
        running = true;
      }
    }
    label = running ? (
      <span>
        {" "}
        <Spin /> Running nbgrader
      </span>
    ) : (
      <span>{label}</span>
    );

    return (
      <div style={{ marginTop: "5px" }}>
        <Button
          key="nbgrader"
          disabled={running}
          size={size}
          onClick={() => {
            if (
              clicked_nbgrader.current != null &&
              webapp_client.server_time() -
                clicked_nbgrader.current.valueOf() <=
                3000
            ) {
              // User *just* clicked, and we want to avoid double click
              // running nbgrader twice.
              return;
            }

            clicked_nbgrader.current = new Date();
            actions.assignments.run_nbgrader_for_one_student(
              assignment.get("assignment_id"),
              student.get("student_id"),
            );
          }}
        >
          <Icon name="graduation-cap" /> {label}
        </Button>
      </div>
    );
  }

  function render_nbgrader() {
    if (nbgrader_scores) {
      return render_nbgrader_scores();
    }
    if (!assignment.get("nbgrader") || assignment.get("skip_grading")) return;

    return render_run_nbgrader("Run nbgrader");
  }

  function render_save_button() {
    if (!is_editing) return;
    return (
      <Button key="save" size={size} onClick={() => stop_editing()}>
        Save
      </Button>
    );
  }

  function render_last_time(time: string | number | Date) {
    return (
      <div key="time" style={{ color: "#666" }}>
        <BigTime date={time} />
      </div>
    );
  }

  function render_open_recopy_confirm(
    name: Steps,
    copy: Function,
    copy_tip: string,
    placement,
  ) {
    if (recopy[name]) {
      const v: JSX.Element[] = [];
      v.push(
        <Button
          key="copy_cancel"
          size={size}
          onClick={() => set_recopy(name, false)}
        >
          Cancel
        </Button>,
      );
      v.push(
        <Button
          key="recopy_confirm"
          danger
          size={size}
          onClick={() => {
            set_recopy(name, false);
            copy();
          }}
        >
          <Icon
            name="share-square"
            rotate={name.indexOf("ollect") !== -1 ? "180" : undefined}
          />{" "}
          Yes, {name.toLowerCase()} again
        </Button>,
      );
      if (name.toLowerCase() === "assign") {
        // inline-block because buttons above are float:left
        v.push(
          <div
            key="what-happens"
            style={{ margin: "5px", display: "inline-block" }}
          >
            <a
              target="_blank"
              href="https://doc.cocalc.com/teaching-tips_and_tricks.html#how-exactly-are-assignments-copied-to-students"
            >
              What happens when I assign again?
            </a>
          </div>,
        );
      }
      return <Space wrap>{v}</Space>;
    } else {
      return (
        <Button
          key="copy"
          type="dashed"
          size={size}
          onClick={() => set_recopy(name, true)}
        >
          <Tip title={name} placement={placement} tip={<span>{copy_tip}</span>}>
            <Icon
              name="share-square"
              rotate={name.indexOf("ollect") !== -1 ? "180" : undefined}
            />{" "}
            {name}...
          </Tip>
        </Button>
      );
    }
  }

  function render_open_recopy(
    name: Steps,
    open,
    copy,
    copy_tip: string,
    open_tip: string,
  ) {
    const placement = name === "Return" ? "left" : "right";
    return (
      <div key="open_recopy">
        {render_open_recopy_confirm(name, copy, copy_tip, placement)}
        <Gap />
        <Button key="open" size={size} onClick={open}>
          <Tip title="Open assignment" placement={placement} tip={open_tip}>
            <Icon name="folder-open" /> Open
          </Tip>
        </Button>
      </div>
    );
  }

  function render_open_copying(name: Steps, open, stop) {
    return (
      <Space key="open_copying" wrap>
        <Button key="copy" disabled={true} size={size}>
          <Spin /> {name}ing
        </Button>
        <Button key="stop" danger onClick={stop} size={size}>
          Cancel <Icon name="times" />
        </Button>
        <Button key="open" onClick={open} size={size}>
          <Icon name="folder-open" /> Open
        </Button>
      </Space>
    );
  }

  function render_copy(name: string, copy, copy_tip: string) {
    let placement;
    if (name === "Return") {
      placement = "left";
    }
    return (
      <Tip key="copy" title={name} tip={copy_tip} placement={placement}>
        <Button onClick={copy} size={size}>
          <Icon
            name="share-square"
            rotate={name.indexOf("ollect") !== -1 ? "180" : undefined}
          />{" "}
          {name}
        </Button>
      </Tip>
    );
  }

  function render_error(name: string, error) {
    if (typeof error !== "string") {
      error = to_json(error);
    }
    // We search for two different error messages, since different errors happen in
    // KuCalc versus other places cocalc runs.  It depends on what is doing the copy.
    if (
      error.indexOf("No such file or directory") !== -1 ||
      error.indexOf("ENOENT") != -1
    ) {
      error = `The student might have renamed or deleted the directory that contained their assignment.  Open their project and see what happened.   If they renamed it, you could rename it back, then collect the assignment again.\n${error}`;
    } else {
      error = `Try to ${name.toLowerCase()} again:\n` + error;
    }
    return (
      <ShowError
        key="error"
        error={error}
        style={{
          marginTop: "5px",
          maxHeight: "140px",
          overflow: "auto",
          display: "block",
        }}
      />
    );
  }

  function Status({
    step,
    type,
    data = {},
    enable_copy = false,
    copy_tip = "",
    open_tip = "",
    omit_errors = false,
  }: RenderLastProps): JSX.Element {
    const do_open = () => open(type, info.assignment_id, info.student_id);
    const do_copy = () => copy(type, info.assignment_id, info.student_id);
    const do_stop = () => stop(type, info.assignment_id, info.student_id);
    const v: JSX.Element[] = [];
    if (enable_copy) {
      if (webapp_client.server_time() - (data.start ?? 0) < COPY_TIMEOUT_MS) {
        v.push(render_open_copying(step, do_open, do_stop));
      } else if (data.time) {
        v.push(
          render_open_recopy(
            step,
            do_open,
            do_copy,
            copy_tip as string,
            open_tip as string,
          ),
        );
      } else {
        v.push(render_copy(step, do_copy, copy_tip as string));
      }
    }
    if (data.time) {
      v.push(render_last_time(data.time));
    }
    if (data.error && !omit_errors) {
      v.push(render_error(step, data.error));
    }
    return <>{v}</>;
  }

  let show_grade_col, show_return_graded;
  const peer_grade: boolean = !!assignment.getIn(["peer_grade", "enabled"]);
  const skip_grading: boolean = !!assignment.get("skip_grading");
  const skip_assignment: boolean = !!assignment.get("skip_assignment");
  const skip_collect: boolean = !!assignment.get("skip_collect");
  if (peer_grade) {
    show_grade_col = !skip_grading && info.last_peer_collect;
    show_return_graded = grade || (skip_grading && info.last_peer_collect);
  } else {
    show_grade_col = (!skip_grading && info.last_collect) || skip_collect;
    show_return_graded =
      grade ||
      (skip_grading && info.last_collect) ||
      (skip_grading && skip_collect);
  }

  const width = peer_grade ? 4 : 6;

  function render_assignment_col() {
    return (
      <Col md={width} key="last_assignment">
        <Status
          step="Assign"
          data={info.last_assignment}
          type="assigned"
          enable_copy={true}
          copy_tip="Copy the assignment from your project to this student's project so they can do their homework."
          open_tip={
            "Open the student's copy of this assignment directly in their project. " +
            "You will be able to see them type, chat with them, leave them hints, etc."
          }
          omit_errors={skip_assignment}
        />
      </Col>
    );
  }

  function render_collect_col() {
    return (
      <Col md={width} key="last_collect">
        {skip_assignment ||
        !(info.last_assignment != null
          ? info.last_assignment.error
          : undefined) ? (
          <Status
            step="Collect"
            data={info.last_collect}
            type="collected"
            enable_copy={info.last_assignment != null || skip_assignment}
            copy_tip="Copy the assignment from your student's project back to your project so you can grade their work."
            open_tip="Open the copy of your student's work in your own project, so that you can grade their work."
            omit_errors={skip_collect}
          />
        ) : undefined}
      </Col>
    );
  }

  function render_peer_assign_col() {
    if (!peer_grade) return;
    if (!info.peer_assignment) return;
    if (info.last_collect?.error != null) return;
    return (
      <Col md={4} key="peer_assign">
        <Status
          step="Peer Assign"
          data={info.last_peer_assignment}
          type={"peer-assigned"}
          enable_copy={info.last_collect != null}
          copy_tip="Copy collected assignments from your project to this student's project so they can grade them."
          open_tip="Open the student's copies of this assignment directly in their project, so you can see what they are peer grading."
        />
      </Col>
    );
  }

  function render_peer_collect_col() {
    if (!peer_grade) return;
    if (!info.peer_collect) return;
    return (
      <Col md={4} key="peer_collect">
        <Status
          step="Peer Collect"
          data={info.last_peer_collect}
          type="peer-collected"
          enable_copy={info.last_peer_assignment != null}
          copy_tip="Copy the peer-graded assignments from various student projects back to your project so you can assign their official grade."
          open_tip="Open your copy of your student's peer grading work in your own project, so that you can grade their work."
        />
      </Col>
    );
  }

  function render_grade_col() {
    //      {render_enter_grade()}
    return (
      <Col md={width} key="grade">
        {show_grade_col && (
          <div>
            {render_save_button()}
            {render_grade()}
            {render_comments()}
            {render_nbgrader()}
          </div>
        )}
      </Col>
    );
  }

  function render_return_graded_col() {
    return (
      <Col md={width} key="return_graded">
        {show_return_graded ? (
          <Status
            step="Return"
            data={info.last_return_graded}
            type="graded"
            enable_copy={info.last_collect != null || skip_collect}
            copy_tip="Copy the graded assignment back to your student's project."
            open_tip={
              "Open the copy of your student's work that you returned to them. " +
              "This opens the returned assignment directly in their project."
            }
          />
        ) : undefined}
      </Col>
    );
  }

  return (
    <div>
      <Row
        style={{
          borderTop: "1px solid #aaa",
          paddingTop: "5px",
          paddingBottom: "5px",
        }}
      >
        <Col md={4} key="title">
          {title}
        </Col>
        <Col md={20} key="rest">
          <Row>
            {render_assignment_col()}
            {render_collect_col()}
            {render_peer_assign_col()}
            {render_peer_collect_col()}
            {render_grade_col()}
            {render_return_graded_col()}
          </Row>
        </Col>
      </Row>
    </div>
  );
}
