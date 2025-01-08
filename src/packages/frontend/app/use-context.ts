/*
Just the minimal app context definitions so that this can also be imported by the nextjs app.

This should be renderable server side, e.g., no window references, etc.
*/

import { ThemeConfig } from "antd";
import type { SizeType } from "antd/es/config-provider/SizeContext";
import { createContext, ReactNode, useContext } from "react";
import type { IntlMessage } from "@cocalc/util/i18n/types";
import { COLORS } from "@cocalc/util/theme";

import {
  FONT_SIZE_ICONS_NARROW,
  FONT_SIZE_ICONS_NORMAL,
  NAV_HEIGHT_NARROW_PX,
  NAV_HEIGHT_PX,
  type PageStyle,
} from "./top-nav-consts";

export interface AppState {
  pageWidthPx: number;
  pageStyle: PageStyle;
  antdComponentSize?: SizeType;
  antdTheme?: ThemeConfig;
  formatIntl: (msg: IntlMessage | ReactNode | string) => ReactNode | string;
  timeAgoAbsolute?: boolean;
  setTimeAgoAbsolute?: (boolean) => void;
}

export const DEFAULT_CONTEXT = {
  pageWidthPx: 1000, // gets updated
  pageStyle: calcStyle(false), // gets updated
  formatIntl: () => "Loading…",
};

export const AppContext = createContext<AppState>(DEFAULT_CONTEXT);

export default function useAppContext() {
  return useContext(AppContext);
}

export function calcStyle(isNarrow: boolean): PageStyle {
  const fontSizeIcons: string = isNarrow
    ? FONT_SIZE_ICONS_NARROW
    : FONT_SIZE_ICONS_NORMAL;
  const topPaddingIcons: string = isNarrow ? "2px" : "5px";
  const sidePaddingIcons: string = isNarrow ? "7px" : "14px";

  const height = isNarrow ? NAV_HEIGHT_NARROW_PX : NAV_HEIGHT_PX;

  const topBarStyle = {
    height: `${height}px`,
  } as const;

  const fileUseStyle = {
    background: "white",
    border: `2px solid ${COLORS.GRAY_DDD}`,
    borderRadius: "5px",
    boxShadow: "0 0 15px #aaa",
    fontSize: "10pt",
    height: "90%",
    margin: 0,
    overflowX: "hidden",
    overflowY: "auto",
    padding: "4px",
    position: "fixed",
    right: "5vw",
    top: `${height}px`,
    width: isNarrow ? "90vw" : "50vw",
    zIndex: 110,
  } as const;

  const projectsNavStyle = isNarrow
    ? ({
        /* this makes it so the projects tabs are on a separate row; otherwise, there is literally no room for them at all... */
        width: "100vw",
        marginTop: "4px",
        height: `${height}px`,
        // no flex!
      } as const)
    : ({
        flex: "1 1 auto", // necessary to stretch out to the full width
      } as const);

  return {
    topBarStyle,
    fileUseStyle,
    projectsNavStyle,
    isNarrow,
    sidePaddingIcons,
    topPaddingIcons,
    fontSizeIcons,
    height,
  };
}
