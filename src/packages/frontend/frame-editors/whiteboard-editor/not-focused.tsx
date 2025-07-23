import { CSSProperties, ReactNode, useCallback, useRef } from "react";
import { getElement } from "./tools/tool-panel";
import Draggable from "react-draggable";
import { delay } from "awaiting";

interface Props {
  children: ReactNode;
  element;
  selectable?: boolean;
  edgeCreate?: boolean;
  edgeStart?: boolean;
  frame;
  canvasScale: number;
  readOnly?: boolean;
  onDrag?: () => void;
}

export default function NotFocused({
  children,
  element,
  selectable,
  edgeCreate,
  edgeStart,
  frame,
  canvasScale,
  readOnly,
  onDrag,
}: Props) {
  const { id } = element;
  const nodeRef = useRef<any>({});

  // Right after dragging, we ignore the onClick so the object doesn't get selected:
  const ignoreNextClickRef = useRef<boolean>(false);

  const onClick = useCallback(
    (e?) => {
      if (ignoreNextClickRef.current) {
        ignoreNextClickRef.current = false;
        return;
      }
      if (e?.target.className == "ant-checkbox-input") {
        // special case -- clicking on a checkbox doesn't focus this element.
        // we CANNOT handle this via e.stopPropagation() in editors/slate/elements/checkbox/index.tsx
        // because Draggable fires this onStop before that onClick even happens.
        return;
      }
      if (!isFinite(element.z)) {
        frame.actions.clearSelection(frame.id);
        return;
      }
      if (readOnly || selectable) {
        select(id, e, frame);
      } else if (edgeCreate) {
        edge(id, frame);
      }
    },
    [selectable, edgeCreate, id, frame, readOnly],
  );

  const disableDrag =
    readOnly || !(selectable && !element.locked) || !isFinite(element.z);

  const body = (
    <div
      ref={nodeRef}
      className={
        edgeCreate
          ? `cocalc-whiteboard-edge-select${edgeStart ? "ed" : ""}`
          : undefined
      }
      style={{
        width: "100%",
        height: "100%",
        cursor: selectable && isFinite(element.z) ? "pointer" : undefined,
      }}
      onClick={disableDrag ? onClick : undefined}
    >
      {children}
      {edgeStart && <div style={HINT}>Select target of edge</div>}
    </div>
  );
  if (disableDrag) {
    // VERY IMPORTANT: do *NOT* wrap this in Draggable with disabled set
    // since Draggable with disabled=true still sets a css style and
    // does things to the children, which *totally breaks virtuoso grids*
    // which messed up the "pages overview".
    return body;
  }

  return (
    <Draggable
      nodeRef={nodeRef}
      position={{ x: 0, y: 0 }}
      cancel={".nodrag"}
      scale={canvasScale}
      disabled={disableDrag}
      onStop={(e, data) => {
        if (data.x || data.y) {
          frame.actions.moveElements([element], data);
          ignoreNextClickRef.current = true;
        } else {
          // Didn't move, so select it for edit. This is particular important on tablets, where
          // without this it would be really hard to select and edit anything.
          onClick(e);
        }
      }}
      onDrag={onDrag}
    >
      {body}
    </Draggable>
  );
}

const HINT = {
  position: "absolute",
  bottom: "-38px",
  overflow: "visible",
  width: "150px",
  background: "white",
  border: "1px solid #ccc",
  padding: "5px",
  borderRadius: "3px",
  boxShadow: "3px 3px 3px #ccc",
} as CSSProperties;

async function select(id, e, frame) {
  // select
  e?.stopPropagation();
  // The below must happen in next render loop, or react complains
  // about state change on unmounted component, since the action
  // causes an unmount.
  await delay(0);
  frame.actions.setSelection(
    frame.id,
    id,
    e && (e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) ? "toggle" : "only",
  );
}

function edge(id, frame) {
  const from = frame.desc.getIn(["edgeStart", "id"]);
  if (from != null) {
    const elt = getElement("edge", frame.desc.get("edgeId"));
    if (from != id) {
      frame.actions.createEdge(frame.id, from, id, elt.data);
    }
    frame.actions.clearEdgeCreateStart(frame.id);
  } else {
    frame.actions.setEdgeCreateStart(frame.id, id);
  }
}
