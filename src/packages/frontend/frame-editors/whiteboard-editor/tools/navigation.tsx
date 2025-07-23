/*
Map navigation panel.

This reproduces some of the functionality in the top button bar,
but in a way that is always present and with an additional
high level map view.
*/

import {
  CSSProperties,
  MutableRefObject,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Icon, IconName } from "@cocalc/frontend/components/icon";
import { Button, Slider, Tooltip } from "antd";
import { useFrameContext } from "../hooks";
import { Actions } from "../actions";
import { getPageSpan, fontSizeToZoom, MAX_ELEMENTS } from "../math";
import { DEFAULT_FONT_SIZE, MIN_ZOOM, MAX_ZOOM } from "./defaults";
import { PANEL_STYLE } from "./panel";
import Canvas from "../canvas";
import { Element, ElementsMap, MainFrameType } from "../types";
import Draggable from "react-draggable";
import {
  SELECTED_BORDER_COLOR,
  SELECTED_BORDER_TYPE,
  SELECTED_BORDER_WIDTH,
} from "../elements/style";
import { Key } from "./panel";
import { throttle } from "lodash";
import useResizeObserver from "use-resize-observer";
import { IS_TOUCH } from "@cocalc/frontend/feature";

// nav panel can take at most this close to edge of full whiteboard.
// We have to constrain this, because if you change your screen size, then things
// could get annoyingly stuck, since you can't even grab the nav panel to resize it.
const MAX_NAV_PANEL = 50;

const TOOLS = {
  map: {
    width: "35px",
    icon: ({ navMap }) => (
      <Icon name={navMap == "preview" ? "sitemap" : "map"} />
    ),
    tip: (
      <>
        {"Full --> Outline --> Hide"} <Key keys="m" />
      </>
    ),
    key: "m",
    click: (actions, id) => {
      actions.toggleMapType(id);
    },
  },
  fit: {
    width: "35px",
    icon: "ColumnWidthOutlined",
    tip: (
      <>
        Fit to screen <Key keys={["Ctrl+0", "⌘+0"]} />
      </>
    ),
    click: (actions, id) => {
      actions.fitToScreen(id);
    },
  },
  zoomOut: {
    width: "35px",
    icon: "search-minus",
    tip: (
      <>
        Zoom out <Key keys="-" />
      </>
    ),
    click: (actions, id) => {
      actions.decrease_font_size(id);
    },
  },
  zoomIn: {
    width: "35px",
    icon: "search-plus",
    tip: (
      <>
        Zoom in <Key keys="+" />
      </>
    ),
    click: (actions, id) => {
      actions.increase_font_size(id);
    },
  },
  zoom100: {
    width: "60px",
    icon: ({ zoomSlider }) => <>{zoomSlider}%</>,
    tip: (
      <>
        Zoom to 100% <Key keys="0" />
      </>
    ),
    click: (actions, id) => {
      actions.set_font_size(id, DEFAULT_FONT_SIZE);
    },
  },
} as {
  [tool: string]: {
    icon: Function | IconName;
    tip: ReactNode;
    click: (Actions, id) => void;
    width: string;
  };
};

const MAP_WIDTH = 275;
const MAP_HEIGHT = 175;
const BAR_HEIGHT = 33;

interface Props {
  fontSize?: number;
  elements: Element[];
  elementsMap?: ElementsMap;
  whiteboardDivRef: MutableRefObject<HTMLDivElement>;
  mainFrameType?: MainFrameType;
}

export default function Navigation({
  fontSize,
  elements,
  elementsMap,
  whiteboardDivRef,
  mainFrameType,
}: Props) {
  const [resize, setResize] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const { actions, desc, id } = useFrameContext();
  const width = desc.get("navWidth") ?? MAP_WIDTH;
  const height = desc.get("navHeight") ?? MAP_HEIGHT;

  const whiteboardResize = useResizeObserver({ ref: whiteboardDivRef });
  useEffect(() => {
    const rect = whiteboardDivRef.current?.getBoundingClientRect();
    if (!rect) return;
    // note -- we don't cap the height width too strongly in case window is tiny,
    // hence the Math.max below, where the first inputs match the bounds inputs
    // to the Draggable component below.  In particular, note that these
    // should match what is a prop to bounds for Draggable.
    const maxWidth = Math.max(MAP_WIDTH, rect.width - MAX_NAV_PANEL);
    const maxHeight = Math.max(MAP_HEIGHT / 2, rect.height - MAX_NAV_PANEL);
    if (width > maxWidth || height > maxHeight) {
      // nav panel is too big, e.g., due to resizing containing window, changing
      // screen resolution, splitting frame, etc., so we fix it.
      actions.set_frame_tree({
        id,
        navWidth: Math.min(width, maxWidth),
        navHeight: Math.min(height, maxHeight),
      });
    }
  }, [width, height, whiteboardResize]);

  const [zoomSlider, setZoomSlider] = useState<number>(
    Math.round(100 * fontSizeToZoom(fontSize)),
  );
  useEffect(() => {
    setZoomSlider(Math.round(100 * fontSizeToZoom(fontSize)));
  }, [fontSize]);

  const navMap = desc.get("navMap", mainFrameType == "slides" ? "hide" : "map");

  const v: ReactNode[] = [];
  for (const tool in TOOLS) {
    v.push(
      <Tool key={tool} tool={tool} zoomSlider={zoomSlider} navMap={navMap} />,
    );
  }
  const setFontSize = useCallback(
    throttle((value) => {
      actions.set_font_size(id, Math.round((DEFAULT_FONT_SIZE * value) / 100));
    }, 50),
    [id],
  );

  v.push(
    <Slider
      key="slider"
      style={{ flex: 1 }}
      value={zoomSlider}
      min={Math.floor(MIN_ZOOM * 100)}
      max={Math.ceil(MAX_ZOOM * 100)}
      onChange={(value) => {
        setZoomSlider(value);
        setFontSize(value);
      }}
    />,
  );
  const showMap = navMap != "hide" && elements != null;
  return (
    <>
      <div
        className="smc-vfill"
        style={{
          ...PANEL_STYLE,
          display: "flex",
          flexDirection: "column",
          right: 0,
          bottom: 0,
          width: `${width}px`,
          height: `${BAR_HEIGHT + (showMap ? height : 0)}px`,
        }}
      >
        {showMap && (
          <Overview
            margin={5}
            elements={elements}
            width={width}
            height={height}
            resize={resize}
            setResize={setResize}
            navMap={navMap}
            elementsMap={elementsMap}
            maxScale={2}
          />
        )}
        <div style={{ display: "flex", borderTop: "1px solid #ddd" }}>{v}</div>
      </div>
      {resize.x || resize.y ? (
        <div
          style={{
            position: "absolute",
            right: 0,
            bottom: 0,
            width: `${width + resize.x}px`,
            height: `${BAR_HEIGHT + height + resize.y}px`,
            opacity: "0.5",
            background: "lightblue",
            border: `${SELECTED_BORDER_WIDTH}px ${SELECTED_BORDER_TYPE} ${SELECTED_BORDER_COLOR}`,
            zIndex: MAX_ELEMENTS + 5,
          }}
        ></div>
      ) : undefined}
    </>
  );
}

function Tool({ tool, zoomSlider, navMap }) {
  const { actions, id } = useFrameContext();
  const { icon, tip, click, width } = TOOLS[tool];
  return (
    <Tooltip placement="top" title={tip}>
      <Button
        type="text"
        onClick={() => click(actions as Actions, id)}
        style={{
          width,
          fontSize: "16px",
          color: tool == "map" && navMap != "hide" ? "blue" : undefined,
        }}
      >
        {typeof icon == "string" ? (
          <Icon name={icon} />
        ) : (
          icon({ zoomSlider, navMap })
        )}
      </Button>
    </Tooltip>
  );
}

interface MapProps {
  elements: Element[];
  elementsMap?: ElementsMap;
  width?: number;
  height?: number;
  resize?: { x: number; y: number };
  setResize?: (resize: { x: number; y: number }) => void;
  navMap?: "preview" | "map" | "page";
  style?: CSSProperties;
  margin?: number;
  minScale?: number;
  maxScale?: number;
  presentation?: boolean;
}

export function Overview({
  elements,
  elementsMap,
  width,
  height,
  resize,
  setResize,
  navMap = "map",
  style,
  margin = 15,
  minScale,
  maxScale,
  presentation,
}: MapProps) {
  const nodeRef = useRef<any>({});
  const { id, actions } = useFrameContext();
  const { xMin, yMin, xMax, yMax } = getPageSpan(elements, 1, presentation);
  const xDiff = xMax - xMin + 2 * margin;
  const yDiff = yMax - yMin + 2 * margin;
  let scale;
  if (height == null) {
    if (width == null) {
      width = 100;
    }
    scale = width / xDiff;
    height = yDiff * scale;
  } else if (width == null) {
    if (height == null) {
      height = 100;
    }
    scale = height / yDiff;
    width = xDiff * scale;
  } else {
    scale = Math.min(width / xDiff, height / yDiff);
  }
  if (minScale && scale < minScale) {
    scale = minScale;
  }
  if (maxScale && scale > maxScale) {
    scale = maxScale;
  }
  // We force previewMode on touch devices as well, since
  // complicated whiteboards crash ipad/ios.  IS_TOUCH is
  // same as tablet or phone (doesn't include touchscreen laptops).
  // See https://github.com/sagemathinc/cocalc/issues/6130
  return (
    <div
      style={{
        width: `${width}px`,
        height: `${height}px`,
        ...style,
      }}
      className="smc-vfill"
    >
      <Canvas
        isNavigator
        mainFrameType={actions.mainFrameType}
        previewMode={IS_TOUCH || navMap == "preview"}
        margin={margin * scale}
        elements={elements}
        elementsMap={elementsMap}
        scale={scale}
        presentation={presentation}
      />
      {setResize != null && (
        <Draggable
          nodeRef={nodeRef}
          disabled={resize == null}
          position={{ x: 0, y: 0 }}
          bounds={{
            right: Math.max(0, width - MAP_WIDTH),
            bottom: Math.max(0, height - MAP_HEIGHT / 2),
          }}
          onDrag={(_, data) => {
            setResize?.({ x: -data.x, y: -data.y });
          }}
          onStop={(_, data) => {
            setTimeout(() => {
              setResize?.({ x: 0, y: 0 });
              actions.set_frame_tree({
                id,
                navWidth: (width ?? 100) - data.x,
                navHeight: (height ?? 100) - data.y,
              });
            }, 0);
          }}
        >
          <span ref={nodeRef}>
            <Icon
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                zIndex: 1011,
                cursor: "nwse-resize",
                background: "white",
                color: "#888",
                visibility:
                  resize == null || resize.x || resize.y ? "hidden" : undefined,
              }}
              name="square"
            />
          </span>
        </Draggable>
      )}
    </div>
  );
}
