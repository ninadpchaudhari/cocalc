/*
 *  This file is part of CoCalc: Copyright © 2024 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

/*
React component that describes the input of a cell
*/

import { Button, Dropdown, Tooltip } from "antd";
import { delay } from "awaiting";
import { Map } from "immutable";
import React, { useState } from "react";
import { useFrameContext } from "@cocalc/frontend/app-framework";
import { Icon, isIconName } from "@cocalc/frontend/components";
import ComputeServer from "@cocalc/frontend/compute/inline";
import useNotebookFrameActions from "@cocalc/frontend/frame-editors/jupyter-editor/cell-notebook/hook";
import { jupyter } from "@cocalc/frontend/i18n";
import track from "@cocalc/frontend/user-tracking";
import { LLMTools } from "@cocalc/jupyter/types";
import { FormattedMessage, useIntl } from "react-intl";
import { JupyterActions } from "./browser-actions";
import { CodeBarDropdownMenu } from "./cell-buttonbar-menu";
import { CellIndexNumber } from "./cell-index-number";
import CellTiming from "./cell-output-time";
import {
  CODE_BAR_BTN_STYLE,
  MINI_BUTTONS_STYLE_INNER,
  RUN_ALL_CELLS_ABOVE_ICON,
  RUN_ALL_CELLS_BELOW_ICON,
} from "./consts";
import { LLMCellTool } from "./llm";

interface Props {
  id: string;
  actions?: JupyterActions;
  cell: Map<string, any>;
  is_current: boolean;
  computeServerId?: number;
  llmTools?: LLMTools;
  haveLLMCellTools: boolean; // decides if we show the LLM Tools, depends on student project in a course, etc.
  index: number;
  is_readonly: boolean;
}

function areEqual(prev: Props, next: Props): boolean {
  return !(
    next.id !== prev.id ||
    next.index !== prev.index ||
    next.cell !== prev.cell ||
    next.is_current !== prev.is_current ||
    next.computeServerId !== prev.computeServerId ||
    (next.llmTools?.model ?? "") !== (prev.llmTools?.model ?? "") ||
    next.is_current !== prev.is_current ||
    next.is_readonly !== prev.is_readonly ||
    next.haveLLMCellTools !== prev.haveLLMCellTools
  );
}

export const CellButtonBar: React.FC<Props> = React.memo(
  ({
    id,
    actions,
    cell,
    is_current,
    computeServerId,
    llmTools,
    index,
    is_readonly,
    haveLLMCellTools,
  }: Props) => {
    const intl = useIntl();

    const { project_id, path } = useFrameContext();
    const frameActions = useNotebookFrameActions();
    const [formatting, setFormatting] = useState<boolean>(false);

    function trackButton(button: string) {
      track("jupyter_cell_buttonbar", { button, project_id, path });
    }

    function getRunStopButton(): {
      tooltip: string;
      icon: string;
      label: string;
      onClick: () => void;
    } {
      switch (cell.get("state")) {
        case "busy":
        case "run":
        case "start":
          return {
            tooltip: "Stop this cell",
            icon: "stop",
            label: "Stop",
            onClick: () => actions?.signal("SIGINT"),
          };

        default:
          return {
            tooltip: "Run this cell",
            label: "Run",
            icon: "step-forward",
            onClick: () => actions?.run_cell(id),
          };
      }
    }

    function renderCodeBarRunStop() {
      if (id == null || actions == null || actions.is_closed()) {
        return;
      }

      const { label, icon, tooltip, onClick } = getRunStopButton();

      // ATTN: this must be wrapped in a plain div, otherwise it's own flex & width 100% style disturbs the button bar
      return (
        <div>
          <Dropdown.Button
            size="small"
            type="text"
            trigger={["click"]}
            mouseLeaveDelay={1.5}
            icon={<Icon name="angle-down" />}
            onClick={onClick}
            menu={{
              items: [
                {
                  key: "all-above",
                  icon: <Icon name={RUN_ALL_CELLS_ABOVE_ICON} />,
                  label: intl.formatMessage(
                    jupyter.commands.run_all_cells_above_menu,
                  ),
                  onClick: () => actions?.run_all_above_cell(id),
                },
                {
                  key: "all-below",
                  icon: <Icon name={RUN_ALL_CELLS_BELOW_ICON} rotate={"90"} />,
                  label: intl.formatMessage(
                    jupyter.commands.run_all_cells_below_menu,
                  ),
                  onClick: () => actions?.run_all_below_cell(id),
                },
              ],
            }}
          >
            <Tooltip placement="top" title={tooltip}>
              <span style={CODE_BAR_BTN_STYLE}>
                {isIconName(icon) && <Icon name={icon} />} {label}
              </span>
            </Tooltip>
          </Dropdown.Button>
        </div>
      );
    }

    function renderCodeBarComputeServer() {
      if (!is_current || !computeServerId) return;
      return <ComputeServerPrompt id={computeServerId} />;
    }

    function renderCodeBarCellTiming() {
      return (
        <div style={{ margin: "2.5px 4px 4px 10px" }}>
          <CellTiming
            start={cell.get("start")}
            end={cell.get("end")}
            last={cell.get("last")}
            state={cell.get("state")}
            isLive={!is_readonly && actions != null}
          />
        </div>
      );
    }

    function renderCodeBarLLMButtons() {
      if (!llmTools || !haveLLMCellTools) return;
      return <LLMCellTool id={id} actions={actions} llmTools={llmTools} />;
    }

    function renderCodeBarFormatButton() {
      // Should only show formatter button if there is a way to format this code.
      if (is_readonly || actions == null) return;
      return (
        <Tooltip
          title={intl.formatMessage({
            id: "jupyter.cell-buttonbr.format-button.tooltip",
            defaultMessage: "Format this code to look nice",
            description: "Code cell in a Jupyter Notebook",
          })}
          placement="top"
        >
          <Button
            disabled={formatting}
            type="text"
            size="small"
            style={CODE_BAR_BTN_STYLE}
            onClick={async () => {
              // kind of a hack: clicking on this button makes this cell
              // the selected one
              try {
                setFormatting(true);
                await delay(1);
                await frameActions.current?.format_selected_cells();
              } finally {
                setFormatting(false);
              }
              trackButton("format");
            }}
          >
            <Icon name={formatting ? "spinner" : "sitemap"} spin={formatting} />{" "}
            <FormattedMessage
              id="jupyter.cell-buttonbr.format-button.label"
              defaultMessage={"Format"}
              description={"Code cell in a Jupyter Notebook"}
            />
          </Button>
        </Tooltip>
      );
    }

    //const input: string | undefined = cell.get("input")?.trim();

    return (
      <div className="hidden-xs" style={MINI_BUTTONS_STYLE_INNER}>
        {renderCodeBarCellTiming()}
        {renderCodeBarRunStop()}
        {renderCodeBarComputeServer()}
        {renderCodeBarLLMButtons()}
        {renderCodeBarFormatButton()}
        <CodeBarDropdownMenu
          actions={actions}
          frameActions={frameActions}
          id={id}
          cell={cell}
        />
        <CellIndexNumber index={index} />
      </div>
    );
  },
  areEqual,
);

function ComputeServerPrompt({ id }) {
  return (
    <Tooltip
      title={
        <>
          This cell will run on <ComputeServer id={id} />.
        </>
      }
    >
      <div
        style={{
          fontSize: CODE_BAR_BTN_STYLE.fontSize,
          margin: "2px 5px 0 0",
        }}
      >
        <ComputeServer
          id={id}
          titleOnly
          style={{
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
            display: "inline-block",
            maxWidth: "125px",
          }}
        />
      </div>
    </Tooltip>
  );
}
