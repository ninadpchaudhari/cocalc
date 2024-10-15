/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  restrictToHorizontalAxis,
  restrictToParentElement,
} from "@dnd-kit/modifiers";
import {
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
} from "@dnd-kit/sortable";
import useMouse from "@react-hook/mouse-position";
import {
  createContext,
  CSSProperties,
  ReactNode,
  useContext,
  useMemo,
  useRef,
} from "react";
import useResizeObserver from "use-resize-observer";

export { useSortable };

interface Props {
  onDragStart?: ((event) => void) | undefined;
  onDragEnd?: ((event) => void) | undefined;
  items: (string | number)[];
  children?: ReactNode;
  style?: CSSProperties;
}

interface ItemContextType {
  width: number | undefined;
}

const ItemContext = createContext<ItemContextType>({
  width: undefined,
});

export function useItemContext() {
  return useContext(ItemContext);
}

export function SortableTabs(props: Props) {
  const { onDragStart, onDragEnd, items, children, style } = props;
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 2,
    },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 100,
      tolerance: 3,
    },
  });
  const sensors = useSensors(mouseSensor, touchSensor);

  const divRef = useRef<any>(null);
  const resize = useResizeObserver({ ref: divRef });
  const lastRef = useRef<{
    width: number;
    length: number;
    itemWidth: number;
  } | null>(null);
  const { isOver } = useMouse(divRef);

  const itemWidth = useMemo(() => {
    if (divRef.current == null) {
      lastRef.current = null;
      return undefined;
    }
    const last = lastRef.current;
    if (
      last != null &&
      last.width == resize.width &&
      items.length <= last.length &&
      isOver
    ) {
      // @ts-ignore
      lastRef.current.length = items.length;
      return last.itemWidth;
    }
    // resize?.width - 46 - the minus 46 is to take into account the "..." dropdown.
    const itemWidth =
      Math.max(
        80,
        Math.min(
          250 + 65,
          ((resize?.width ?? 500) - 46) / Math.max(1, items.length),
        ),
      ) - 55; // the constant accounts for the margin and x for an antd tab.
    lastRef.current = {
      width: resize.width ?? 0,
      length: items.length,
      itemWidth,
    };
    return itemWidth;
  }, [resize.width, items.length, divRef.current, isOver]);

  return (
    <div style={{ width: "100%", ...style }} ref={divRef}>
      <ItemContext.Provider value={{ width: itemWidth }}>
        <DndContext
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          modifiers={[restrictToHorizontalAxis, restrictToParentElement]}
          sensors={sensors}
        >
          <SortableContext
            items={items}
            strategy={horizontalListSortingStrategy}
          >
            {children}
          </SortableContext>
        </DndContext>
      </ItemContext.Provider>
    </div>
  );
}

export function SortableTab({ children, id }) {
  const { attributes, listeners, setNodeRef, transform, transition, active } =
    useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
        transition,
        zIndex: active?.id == id ? 1 : undefined,
      }}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}

export function renderTabBar(tabBarProps, DefaultTabBar) {
  return (
    <DefaultTabBar {...tabBarProps}>
      {(node) => (
        <SortableTab key={node.key} id={node.key}>
          {node}
        </SortableTab>
      )}
    </DefaultTabBar>
  );
}
