/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

// Component that shows rendered markdown.
//
// It also:
//
//    - [x] tracks and restores scroll position
//    - [x] is scrollable
//    - [x] is zoomable
//    - [x] math is properly typeset

import { delay } from "awaiting";
import StaticMarkdown from "@cocalc/frontend/editors/slate/static-markdown";
import { is_different } from "@cocalc/util/misc";
import { debounce } from "lodash";
import { React, CSS } from "../../app-framework";
import { use_font_size_scaling } from "../frame-tree/hooks";
import { EditorState } from "../frame-tree/types";
import { Actions } from "./actions";
import { Path } from "../frame-tree/path";
import { FileContext, useFileContext } from "@cocalc/frontend/lib/file-context";

interface Props {
  actions: Actions;
  id: string;
  path: string;
  project_id: string;
  font_size: number;
  read_only: boolean;
  value?: string;
  editor_state: EditorState;
  reload_images: boolean;
  is_current: boolean;
}

function should_memoize(prev, next): boolean {
  return !is_different(prev, next, [
    "id",
    "project_id",
    "path",
    "font_size",
    "read_only",
    "value",
    "reload_images",
    "is_current",
  ]);
}

export const RenderedMarkdown: React.FC<Props> = React.memo((props: Props) => {
  const {
    actions,
    id,
    path,
    project_id,
    font_size,
    value = "",
    editor_state,
    reload_images,
    is_current,
  } = props;

  const fileContext = useFileContext();

  const scroll = React.useRef<HTMLDivElement>(null as any);

  const scaling = use_font_size_scaling(font_size);

  // once when mounted
  React.useEffect(() => {
    restore_scroll();
  }, []);

  function on_scroll(): void {
    const elt = scroll.current;
    if (elt == null) {
      return;
    }
    // @ts-ignore
    const scroll_val = $(elt).scrollTop();
    actions.save_editor_state(id, { scroll: scroll_val });
  }

  async function restore_scroll(): Promise<void> {
    const scroll_val = editor_state.get("scroll");
    const elt = $(scroll.current) as any;
    try {
      if (elt.length === 0) {
        return;
      }
      await delay(0); // wait until render happens
      elt.scrollTop(scroll_val);
      await delay(0);
      elt.css("opacity", 1);

      // do any scrolling after image loads
      elt.find("img").on("load", function () {
        elt.scrollTop(scroll_val);
      });
    } finally {
      // for sure change opacity to 1 so visible after
      // doing whatever scrolling above
      elt.css("opacity", 1);
    }
  }

  const style: CSS = {
    overflowY: "auto",
    width: "100%",
    opacity: 0, // changed to 1 after initial scroll to avoid flicker
  };
  const style_inner: CSS = {
    ...{
      padding: "40px 70px",
      backgroundColor: "white",
      overflowY: "auto",
    },
    ...{
      // transform: scale() and transformOrigin: "0 0" or "center 0"
      // doesn't work well. Changing the base font size is fine.
      fontSize: `${100 * scaling}%`,
    },
  };

  return (
    <div className="smc-vfill" style={{ backgroundColor: "#eee" }}>
      <Path is_current={is_current} path={path} project_id={project_id} />
      <div
        style={style}
        ref={scroll}
        onScroll={debounce(() => on_scroll(), 200)}
        /* this cocalc-editor-div class is needed for a safari hack only */
        className={"cocalc-editor-div smc-vfill"}
      >
        <div style={style_inner} className="smc-vfill">
          <FileContext.Provider
            value={{
              ...fileContext,
              reloadImages: reload_images,
            }}
          >
            <StaticMarkdown value={value} />
          </FileContext.Provider>
        </div>
      </div>
    </div>
  );
}, should_memoize);

RenderedMarkdown.displayName = "MarkdownEditor-RenderedMarkdown";
