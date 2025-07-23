/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

import { Map } from "immutable";
import { rclass, redux, rtypes, Component } from "../../app-framework";
import { UpgradeAdjustor, r_join } from "../../components";
import { PROJECT_UPGRADES } from "@cocalc/util/schema";
import { ProjectTitle } from "../../projects/project-title";
import { Row, Col, Panel } from "../../antd-bootstrap";
import { plural, len, round1 } from "@cocalc/util/misc";

interface reduxProps {
  get_total_upgrades: Function;
  help_email: string;
  project_map: Map<string, any>;
  get_total_upgrades_you_have_applied: Function;
  get_upgrades_you_applied_to_project: Function;
  get_total_project_quotas: Function;
  get_upgrades_to_project: Function;
  get_projects_upgraded_by: Function;
}

interface State {
  show_adjustor: Map<string, boolean>; // project_id : bool
}

class ProjectUpgradesTable extends Component<reduxProps, State> {
  static reduxProps() {
    return {
      account: {
        get_total_upgrades: rtypes.func,
      },
      customize: {
        help_email: rtypes.string,
      },
      projects: {
        project_map: rtypes.immutable.Map,
        get_total_upgrades_you_have_applied: rtypes.func,
        get_upgrades_you_applied_to_project: rtypes.func,
        get_total_project_quotas: rtypes.func,
        get_upgrades_to_project: rtypes.func,
        get_projects_upgraded_by: rtypes.func,
      },
    };
  }

  constructor(props, state) {
    super(props, state);
    this.state = {
      show_adjustor: Map({}),
    };
  }

  open_project_settings(e, project_id: string) {
    redux.getActions("projects").open_project({
      project_id,
      target: "settings",
      switch_to: !(e.which === 2 || e.ctrlKey || e.metaKey),
    });
    e.preventDefault();
  }

  submit_upgrade_quotas({ project_id, new_quotas }) {
    redux
      .getActions("projects")
      .apply_upgrades_to_project(project_id, new_quotas);
    this.toggle_adjustor(project_id);
  }

  generate_on_click_adjust(project_id: string) {
    return (e) => {
      e.preventDefault();
      return this.toggle_adjustor(project_id);
    };
  }

  toggle_adjustor(project_id: string) {
    const status = this.state.show_adjustor.get(project_id);
    const show_adjustor = this.state.show_adjustor.set(project_id, !status);
    this.setState({ show_adjustor });
  }

  private render_upgrades_to_project(project_id: string, upgrades) {
    const v: React.JSX.Element[] = [];
    for (let param in upgrades) {
      const val = upgrades[param];
      if (!val) {
        continue;
      }
      const info = PROJECT_UPGRADES.params[param];
      if (info == null) {
        console.warn(
          `Invalid upgrades database entry for project_id='${project_id}' -- if this problem persists, email ${this.props.help_email} with the project_id: ${param}`,
        );
        continue;
      }
      const n = round1(val != null ? info.display_factor * val : 0);
      v.push(
        <span key={param}>
          {info.display}: {n} {plural(n, info.display_unit)}
        </span>,
      );
    }
    return r_join(v);
  }

  private render_upgrade_adjustor(project_id: string) {
    return (
      <UpgradeAdjustor
        key={`adjustor-${project_id}`}
        total_project_quotas={this.props.get_total_project_quotas(project_id)}
        upgrades_you_can_use={this.props.get_total_upgrades()}
        upgrades_you_applied_to_all_projects={this.props.get_total_upgrades_you_have_applied()}
        upgrades_you_applied_to_this_project={this.props.get_upgrades_you_applied_to_project(
          project_id,
        )}
        quota_params={PROJECT_UPGRADES.params}
        submit_upgrade_quotas={(new_quotas) =>
          this.submit_upgrade_quotas({ new_quotas, project_id })
        }
        cancel_upgrading={() => this.toggle_adjustor(project_id)}
        style={{ margin: "25px 0px 0px 0px" }}
        omit_header={true}
      />
    );
  }

  private render_upgraded_project(project_id: string, upgrades, darker) {
    return (
      <Row
        key={project_id}
        style={darker ? { backgroundColor: "#eee" } : undefined}
      >
        <Col sm={4}>
          <ProjectTitle
            project_id={project_id}
            handle_click={(e) => this.open_project_settings(e, project_id)}
          />
        </Col>
        <Col sm={8}>
          <a onClick={this.generate_on_click_adjust(project_id)} role="button">
            {this.render_upgrades_to_project(project_id, upgrades)}
          </a>
        </Col>
        {this.state.show_adjustor.get(project_id)
          ? this.render_upgrade_adjustor(project_id)
          : undefined}
      </Row>
    );
  }

  private render_upgraded_projects_rows(upgraded_projects): React.JSX.Element[] {
    let i = -1;
    const result: React.JSX.Element[] = [];
    for (let project_id in upgraded_projects) {
      const upgrades = upgraded_projects[project_id];
      i += 1;
      result.push(
        this.render_upgraded_project(project_id, upgrades, i % 2 === 0),
      );
    }
    return result;
  }

  private render_header() {
    return (
      <div>
        <Row>
          <Col sm={12} style={{ display: "flex" }}>
            <div style={{ flex: "1" }}>
              Upgrades you have applied to projects
            </div>
          </Col>
        </Row>
      </div>
    );
  }

  render() {
    const upgraded_projects = this.props.get_projects_upgraded_by();
    if (!len(upgraded_projects)) {
      return null;
    }
    return (
      <Panel header={this.render_header()}>
        <Row key="header">
          <Col sm={4}>
            <strong>Project</strong>
          </Col>
          <Col sm={8}>
            <strong>
              Upgrades you have applied to this project (click to edit)
            </strong>
          </Col>
        </Row>
        {this.render_upgraded_projects_rows(upgraded_projects)}
      </Panel>
    );
  }
}

const tmp = rclass(ProjectUpgradesTable);
export { tmp as ProjectUpgradesTable };
