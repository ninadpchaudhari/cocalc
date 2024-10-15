import { Alert, Modal } from "antd";
import type { StudentsMap } from "./store";
import type { UserMap } from "@cocalc/frontend/todo-types";
import AddStudents from "@cocalc/frontend/course/students/add-students";
import { Icon } from "@cocalc/frontend/components/icon";
import {
  ReconfigureAllProjects,
  StartAllProjects,
  ExportGrades,
  ResendInvites,
  CopyMissingHandoutsAndAssignments,
} from "@cocalc/frontend/course/configuration/actions-panel";
import type { ProjectMap } from "@cocalc/frontend/todo-types";
import { TerminalCommandPanel } from "@cocalc/frontend/course/configuration/terminal-command";
import EmptyTrash from "@cocalc/frontend/course/configuration/empty-trash";
import { DeleteAllStudentProjects } from "@cocalc/frontend/course/configuration//delete-all-student-projects";
import { DeleteAllStudents } from "@cocalc/frontend/course/configuration//delete-all-students";
import { DeleteSharedProjectPanel } from "@cocalc/frontend/course/shared-project/delete-shared-project";
import { SharedProjectPanel } from "@cocalc/frontend/course/shared-project/shared-project-panel";
import {
  CollaboratorPolicy,
  EmailInvitation,
  EnvVariables,
  NetworkFilesystem,
  RestrictStudentProjects,
  TitleAndDescription,
  UpgradeConfiguration,
  ConfigureSoftwareEnvironment,
} from "@cocalc/frontend/course/configuration/configuration-panel";
import ConfigurationCopying from "@cocalc/frontend/course/configuration/configuration-copying";
import { Parallel } from "@cocalc/frontend/course/configuration/parallel";
import { Nbgrader } from "@cocalc/frontend/course/configuration/nbgrader";
import { AddAssignments } from "@cocalc/frontend/course/assignments/assignments-panel";
import { AddHandouts } from "@cocalc/frontend/course/handouts/handouts-panel";
import { COMMANDS } from "@cocalc/frontend/course/commands";

interface Props {
  frameActions;
  actions;
  modal?: string;
  name: string;
  students?: StudentsMap;
  user_map?: UserMap;
  project_map?: ProjectMap;
  project_id: string;
  path: string;
  configuring_projects?: boolean;
  reinviting_students?: boolean;
  settings;
  redux;
}

export default function Modals(props: Props) {
  const { students, user_map, project_map, modal } = props;
  if (students == null || user_map == null || project_map == null || !modal) {
    return null;
  }
  const close = () => {
    props.frameActions.setState({ modal: "" });
  };
  const { title, Body, icon } = getModal(modal);

  return (
    <Modal
      onCancel={close}
      onOk={close}
      cancelButtonProps={{ style: { display: "none" } }}
      okText="Close"
      open
      title={
        title ? (
          <>
            {icon && <Icon name={icon} />} {title}
          </>
        ) : undefined
      }
      width={800}
    >
      <br />
      <Body
        {...props}
        students={students}
        user_map={user_map}
        project_map={project_map}
        close={close}
      />
    </Modal>
  );
  return null;
}

function getModal(modal: string) {
  const { label: title, icon } = COMMANDS[modal] ?? {};
  switch (modal) {
    case "add-students":
      return { Body: AddStudents, title, icon };
    case "add-assignments":
      return {
        Body: AddAssignments,
        title: "Add Assignments",
        icon: "share-square",
      };
    case "add-handouts":
      return { Body: AddHandouts, title, icon };

    case "start-all-projects":
      return {
        Body: StartAllProjects,
      };

    case "terminal-command":
      return { Body: TerminalCommandPanel };

    case "reconfigure-all-projects":
      return {
        Body: ReconfigureAllProjects,
      };

    case "export-grades":
      return { Body: ExportGrades };

    case "resend-invites":
      return { Body: ResendInvites };

    case "copy-missing-handouts-and-assignments":
      return { Body: CopyMissingHandoutsAndAssignments };

    case "empty-trash":
      return { Body: EmptyTrash };

    case "delete-student-projects":
      return { Body: DeleteAllStudentProjects };

    case "delete-students":
      return { Body: DeleteAllStudents };

    case "delete-shared-project":
      return { Body: DeleteSharedProjectPanel };

    case "create-shared-project":
      return { Body: SharedProjectPanel };

    case "title-and-description":
      return { Body: TitleAndDescription };

    case "email-invitation":
      return { Body: EmailInvitation };
    case "copy-limit":
      return { Body: Parallel };
    case "collaborator-policy":
      return { Body: CollaboratorPolicy };
    case "restrict-student-projects":
      return { Body: RestrictStudentProjects };
    case "nbgrader":
      return { Body: Nbgrader };
    case "network-file-systems":
      return { Body: NetworkFilesystem };
    case "env-variables":
      return { Body: EnvVariables };
    case "upgrades":
      return { Body: UpgradeConfiguration };
    case "software-environment":
      return { Body: ConfigureSoftwareEnvironment };
    case "configuration-copying":
      return { Body: ConfigurationCopying };

    default:
      return {
        Body: () => (
          <Alert type="warning" message={<>BUG -- Unknown modal: {modal}</>} />
        ),
        title: "Error",
        icon: "bug",
      };
  }
}
