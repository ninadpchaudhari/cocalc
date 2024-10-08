/*
 *  This file is part of CoCalc: Copyright © 2023 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

import { Col, Divider, Modal, Row, Tabs, TabsProps } from "antd";
import { Gutter } from "antd/es/grid/row";
import { useProjectContext } from "@cocalc/frontend/project/context";
import { useState } from "@cocalc/frontend/app-framework";
import { A, Icon, Paragraph, Text, Title } from "@cocalc/frontend/components";
import {
  ComputeServerDocs,
  ComputeServers,
  computeServersEnabled,
  cloudFilesystemsEnabled,
} from "@cocalc/frontend/compute";
import { HelpEmailLink } from "@cocalc/frontend/customize";
import { R_IDE } from "@cocalc/util/consts/ui";
import { NamedServerName } from "@cocalc/util/types/servers";
import { NamedServerPanel } from "../named-server-panel";
import { NewFileButton } from "../new/new-file-button";
import { SagewsControl } from "../settings/sagews-control";
import { useAvailableFeatures } from "../use-available-features";
import { ICON_NAME, ROOT_STYLE, TITLE } from "./consts";
import CloudFilesystems from "@cocalc/frontend/compute/cloud-filesystem/cloud-filesystems";
import {
  getServerTab,
  setServerTab,
  TabName,
} from "@cocalc/frontend/compute/tab";
import { FormattedMessage } from "react-intl";

// Antd's 24 grid system
const md = 6;
const sm = 12;
const y: Gutter = 30;
const gutter: [Gutter, Gutter] = [20, y / 2];
const newRowStyle = { marginTop: `${y}px` };

export function ProjectServers() {
  const { project_id } = useProjectContext();

  const available = useAvailableFeatures(project_id);

  const [showNamedServer, setShowNamedServer] = useState<"" | NamedServerName>(
    "",
  );

  function toggleShowNamedServer(name: NamedServerName): void {
    showNamedServer == name ? setShowNamedServer("") : setShowNamedServer(name);
  }

  const noServers: boolean =
    !available.jupyter_notebook &&
    !available.jupyter_lab &&
    !available.vscode &&
    !available.julia &&
    !available.rserver;

  function renderNamedServers(): JSX.Element {
    return (
      <>
        <Row gutter={gutter} style={newRowStyle}>
          {available.jupyter_lab && (
            <Col sm={sm} md={md}>
              <NewFileButton
                name={<span style={{ fontSize: "14pt" }}>JupyterLab</span>}
                icon={"ipynb"}
                active={showNamedServer === "jupyterlab"}
                on_click={() => toggleShowNamedServer("jupyterlab")}
              />
            </Col>
          )}
          {available.vscode && (
            <Col sm={sm} md={md}>
              <NewFileButton
                name={<span style={{ fontSize: "14pt" }}>VS Code</span>}
                icon={"vscode"}
                active={showNamedServer === "code"}
                on_click={() => toggleShowNamedServer("code")}
              />
            </Col>
          )}
          {available.julia && (
            <Col sm={sm} md={md}>
              <NewFileButton
                name={<span style={{ fontSize: "14pt" }}>Pluto</span>}
                icon={"julia"}
                active={showNamedServer === "pluto"}
                on_click={() => toggleShowNamedServer("pluto")}
              />
            </Col>
          )}
          {available.rserver && (
            <Col sm={sm} md={md}>
              <NewFileButton
                name={<span style={{ fontSize: "14pt" }}>{R_IDE}</span>}
                icon={"r"}
                active={showNamedServer === "rserver"}
                on_click={() => toggleShowNamedServer("rserver")}
              />
            </Col>
          )}
          {available.jupyter_notebook && (
            <Col sm={sm} md={md}>
              <NewFileButton
                name={<span style={{ fontSize: "14pt" }}>Jupyter Classic</span>}
                icon={"ipynb"}
                active={showNamedServer === "jupyter"}
                on_click={() => toggleShowNamedServer("jupyter")}
              />
            </Col>
          )}
          {noServers && (
            <Col sm={sm} md={md}>
              <NewFileButton
                name={"No servers available"}
                icon={"exclamation-circle"}
                on_click={() =>
                  Modal.info({
                    title: "No servers available",
                    content: (
                      <>
                        No available server has been detected in this project
                        environment. You can{" "}
                        <HelpEmailLink text="ask an administrator" /> to install
                        e.g. JupyterLab by running <br />
                        <Text code>pip install jupyterlab</Text>
                        <br />
                        globally.
                      </>
                    ),
                  })
                }
              />
            </Col>
          )}
        </Row>

        <div>
          {showNamedServer && (
            <NamedServerPanel
              project_id={project_id}
              name={showNamedServer}
              style={{ maxWidth: "600px", margin: "30px auto" }}
            />
          )}
        </div>
      </>
    );
  }

  function renderSageServerControl(): JSX.Element {
    return (
      <Row gutter={gutter} style={newRowStyle}>
        <Col sm={24} md={12}>
          <Title level={3}>
            <Icon name="sagemath" /> Sage Worksheet Server
          </Title>
          <SagewsControl key="worksheet" project_id={project_id} />
        </Col>
      </Row>
    );
  }

  const items: TabsProps["items"] = [];
  items.push({
    key: "notebooks",
    label: (
      <span style={{ fontSize: "14pt" }}>
        <Icon name="jupyter" /> Notebook Servers
      </span>
    ),
    children: (
      <>
        <Paragraph>
          <FormattedMessage
            id="project.servers.project-servers.description"
            defaultMessage={`You can run various notebook servers inside this project with one click.
            They run in the same environment, have access to the same files,
            and stop when the project stops.
            You can also <A>run your own servers</A>.`}
            values={{
              A: (c) => (
                <A href={"https://doc.cocalc.com/howto/webserver.html"}>{c}</A>
              ),
            }}
          />
        </Paragraph>
        {renderNamedServers()}
        <Divider plain />
        {renderSageServerControl()}
      </>
    ),
  });
  if (computeServersEnabled()) {
    items.push({
      key: "compute-servers",
      label: (
        <span style={{ fontSize: "14pt" }}>
          <Icon name="server" /> Compute Servers
        </span>
      ),
      children: (
        <>
          <h2>
            <ComputeServerDocs style={{ float: "right" }} />
            Compute Servers
          </h2>
          <div style={{ marginBottom: "15px" }}>
            Compute servers provide powerful computing capabilities, allowing
            you to scale up to 400+ CPU cores, terabytes of RAM, advanced GPUs,
            extensive storage options and integration with multiple cloud
            services for flexible use. The platform features real-time
            collaboration, pre-configured software, and clear, minute-by-minute
            billing for efficient project management and cost control.
          </div>
          <ComputeServers project_id={project_id} />
        </>
      ),
    });
  }
  if (cloudFilesystemsEnabled()) {
    items.push({
      key: "cloud-filesystems",
      label: (
        <span style={{ fontSize: "14pt" }}>
          <Icon name="disk-round" /> Cloud File Systems
        </span>
      ),
      children: <CloudFilesystems project_id={project_id} />,
    });
  }

  return (
    <div style={{ ...ROOT_STYLE, margin: "0 auto" }}>
      <Title level={2}>
        <Icon name={ICON_NAME} /> {TITLE}
      </Title>
      <Tabs
        items={items}
        defaultActiveKey={getServerTab(project_id)}
        onChange={(tab) => setServerTab(project_id, tab as TabName)}
      />
    </div>
  );
}
