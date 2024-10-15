/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

import { useRedux } from "@cocalc/frontend/app-framework";
import { useState } from "react";
import ScrollableList from "@cocalc/frontend/components/scrollable-list";
import { cmp } from "@cocalc/util/misc";
import { Alert, Button } from "antd";
import { Set } from "immutable";
import { Icon, Tip } from "../../components";
import { UserMap } from "../../todo-types";
import { CourseActions } from "../actions";
import { AddItems, FoldersToolbar } from "../common/folders-tool-bar";
import { HandoutRecord, HandoutsMap, StudentsMap } from "../store";
import * as styles from "../styles";
// CoCalc and course components
import * as util from "../util";
import { Handout } from "./handout";

interface HandoutsPanelReactProps {
  frame_id?: string;
  name: string;
  actions: CourseActions;
  project_id: string;
  handouts: HandoutsMap; // handout_id -> handout
  students: StudentsMap; // student_id -> student
  user_map: UserMap;
  frameActions;
}

export function HandoutsPanel({
  frame_id,
  name,
  actions,
  project_id,
  handouts,
  students,
  user_map,
  frameActions,
}: HandoutsPanelReactProps) {
  const expanded_handouts: Set<string> | undefined = useRedux(
    name,
    "expanded_handouts",
  );

  const [show_deleted, set_show_deleted] = useState<boolean>(false);

  const pageFilter = useRedux(name, "pageFilter");
  const filter = pageFilter?.get("handouts") ?? "";
  const setFilter = (filter: string) => {
    actions.setPageFilter("handouts", filter);
  };

  function get_handout(id: string): HandoutRecord {
    const handout = handouts.get(id);
    if (handout == undefined) {
      console.warn(`Tried to access undefined handout ${id}`);
    }
    return handout as any;
  }

  function compute_handouts_list() {
    let num_deleted, num_omitted;
    let list = util.immutable_to_list(handouts, "handout_id");

    ({ list, num_omitted } = util.compute_match_list({
      list,
      search_key: "path",
      search: filter.trim(),
    }));

    ({ list, num_deleted } = util.order_list({
      list,
      compare_function: (a, b) =>
        cmp(a.path?.toLowerCase(), b.path?.toLowerCase()),
      reverse: false,
      include_deleted: show_deleted,
    }));

    return {
      shown_handouts: list,
      num_omitted,
      num_deleted,
    };
  }

  function render_show_deleted_button(num_deleted, num_shown) {
    if (show_deleted) {
      return (
        <Button
          style={styles.show_hide_deleted({ needs_margin: num_shown > 0 })}
          onClick={() => set_show_deleted(false)}
        >
          <Tip
            placement="left"
            title="Hide deleted"
            tip="Handouts are never really deleted.  Click this button so that deleted handouts aren't included at the bottom of the list."
          >
            Hide {num_deleted} deleted handouts
          </Tip>
        </Button>
      );
    } else {
      return (
        <Button
          style={styles.show_hide_deleted({ needs_margin: num_shown > 0 })}
          onClick={() => {
            set_show_deleted(true);
            setFilter("");
          }}
        >
          <Tip
            placement="left"
            title="Show deleted"
            tip="Handouts are not deleted forever even after you delete them.  Click this button to show any deleted handouts at the bottom of the list of handouts.  You can then click on the handout and click undelete to bring the handout back."
          >
            Show {num_deleted} deleted handouts
          </Tip>
        </Button>
      );
    }
  }

  function render_handout(handout_id: string, index: number) {
    return (
      <Handout
        frame_id={frame_id}
        backgroundColor={index % 2 === 0 ? "#eee" : undefined}
        key={handout_id}
        handout={get_handout(handout_id)}
        project_id={project_id}
        students={students}
        user_map={user_map}
        actions={actions}
        is_expanded={expanded_handouts?.has(handout_id) ?? false}
        name={name}
      />
    );
  }

  function render_handouts(handouts) {
    if (handouts.length == 0) {
      return render_no_handouts();
    }
    return (
      <ScrollableList
        virtualize
        rowCount={handouts.length}
        rowRenderer={({ key, index }) => render_handout(key, index)}
        rowKey={(index) => handouts[index]?.handout_id ?? ""}
        cacheId={`course-handouts-${name}-${frame_id}`}
      />
    );
  }

  function render_no_handouts() {
    return (
      <div>
        <Alert
          type="info"
          style={{
            margin: "15px auto",
            fontSize: "12pt",
            maxWidth: "800px",
          }}
          message={
            <b>
              <a onClick={() => frameActions.setModal("add-handouts")}>
                Add Handouts to your Course
              </a>
            </b>
          }
          description={
            <div>
              <p>
                A handout is a <i>directory</i> of files somewhere in your
                CoCalc project, which you copy to all of your students. They can
                then do anything they want with that handout.
              </p>
              <p>
                <a onClick={() => frameActions.setModal("add-handouts")}>
                  Add handouts to your course
                </a>{" "}
                by clicking "Add Handout..." above. You can create or select one
                or more directories and they will become handouts that you can
                then customize and distribute to your students.
              </p>
            </div>
          }
        />
      </div>
    );
  }

  // Computed data from state changes have to go in render
  const { shown_handouts, num_omitted, num_deleted } = compute_handouts_list();

  const header = (
    <FoldersToolbar
      search={filter}
      search_change={setFilter}
      num_omitted={num_omitted}
      project_id={project_id}
      items={handouts}
      add_folders={actions.handouts.addHandout}
      item_name={"handout"}
      plural_item_name={"handouts"}
    />
  );

  return (
    <div className={"smc-vfill"} style={{ margin: "0" }}>
      {header}
      <div style={{ marginTop: "5px" }} />
      {render_handouts(shown_handouts)}
      {num_deleted > 0
        ? render_show_deleted_button(
            num_deleted,
            shown_handouts.length != null ? shown_handouts.length : 0,
          )
        : undefined}
    </div>
  );
}

export function HandoutsPanelHeader(props: { n: number }) {
  return (
    <Tip
      delayShow={1300}
      title="Handouts"
      tip="This tab lists all of the handouts associated with your course."
    >
      <span>
        <Icon name="files" /> Handouts {props.n != null ? ` (${props.n})` : ""}
      </span>
    </Tip>
  );
}

// used for adding assignments outside of the above component.
export function AddHandouts({ name, actions, close }) {
  const handouts = useRedux(name, "handouts");
  return (
    <AddItems
      itemName="handout"
      items={handouts}
      addItems={(paths) => {
        actions.handouts.addHandout(paths);
        close?.();
      }}
      selectorStyle={{
        position: null,
        width: "100%",
        boxShadow: null,
        zIndex: null,
        backgroundColor: null,
      }}
      defaultOpen
      closable={false}
    />
  );
}
