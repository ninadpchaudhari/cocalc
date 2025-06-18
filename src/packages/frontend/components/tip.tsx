/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

import { Popover, Tooltip } from "antd";
import { TooltipPlacement } from "antd/lib/tooltip";
import React, { CSSProperties as CSS } from "react";

import * as misc from "@cocalc/util/misc";
import * as feature from "../feature";
import { Icon, IconName } from "./icon";

const TIP_STYLE: CSS = {
  wordWrap: "break-word",
  maxWidth: "250px",
} as const;

type Size = "xsmall" | "small" | "medium" | "large";

type Trigger = "hover" | "focus" | "click" | "contextMenu";

interface Props {
  title?: string | JSX.Element | JSX.Element[] | (() => JSX.Element); // not checked for update
  placement?: TooltipPlacement;
  tip?: string | JSX.Element | JSX.Element[]; // not checked for update
  size?: Size; // IMPORTANT: this is currently ignored -- see https://github.com/sagemathinc/cocalc/pull/4155
  delayShow?: number;
  delayHide?: number;
  rootClose?: boolean;
  icon?: IconName;
  id?: string; // can be used for screen readers
  style?: CSS; // changing not checked when updating if stable is true
  popover_style?: CSS; // changing not checked ever (default={zIndex:1000})
  stable?: boolean; // if true, children assumed to never change
  allow_touch?: boolean;
  trigger?: Trigger | Trigger[];
  children?: React.ReactNode;
  tip_style?: CSS;
}

function is_equal(prev, next) {
  if (prev.stable) {
    return true;
  } else {
    return misc.is_different(prev, next, [
      "placement",
      "size",
      "delayShow",
      "delayHide",
      "rootClose",
      "icon",
      "id",
    ]);
  }
}

export const Tip: React.FC<Props> = React.memo((props: Props) => {
  const {
    placement = "right",
    delayShow = 500, // [ms]
    delayHide = 50, // [ms] this was 0 before switching to Antd – which has 100ms as its default, though.
    // rootClose = false,
    popover_style = { zIndex: 1000 },
    allow_touch = false,
    // id = "tip",
    title,
    tip,
    // size,
    icon,
    style,
    trigger,
    children,
    tip_style,
  } = props;

  function render_title() {
    const renderedTitle = typeof title === "function" ? title() : title;
    if (!renderedTitle) return null;
    if (!icon) return renderedTitle;
    return (
      <span>
        <Icon name={icon} /> {renderedTitle}
      </span>
    );
  }

  // a tip is rendered in a description box below the title
  function render_tip(): JSX.Element {
    const style = { ...TIP_STYLE, ...tip_style };
    return <div style={style}>{tip}</div>;
  }

  // this is the visible element, which gets some information
  function render_wrapped() {
    return <span style={style}>{children}</span>;
  }

  function render_tooltip() {
    if (delayShow == null || delayHide == null) return null;

    const props: { [key: string]: any } = {
      arrow: { pointAtCenter: true },
      placement: placement,
      trigger: trigger ?? "hover",
      mouseEnterDelay: delayShow / 1000,
      mouseLeaveDelay: delayHide / 1000,
    };

    props.styles = { root: Object.assign({}, popover_style) };

    if (tip) {
      return (
        <Popover title={render_title()} content={render_tip()} {...props}>
          {render_wrapped()}
        </Popover>
      );
    } else {
      return (
        <Tooltip title={render_title()} {...props}>
          {render_wrapped()}
        </Tooltip>
      );
    }
  }

  // Tooltips are very frustrating and pointless on mobile or tablets, and cause a lot of trouble; also,
  // our assumption is that mobile users will also use the desktop version at some point, where
  // they can learn what the tooltips say.  We do optionally allow a way to use them.
  if (feature.IS_TOUCH && !allow_touch) {
    return render_wrapped();
  } else {
    return render_tooltip();
  }
}, is_equal);
