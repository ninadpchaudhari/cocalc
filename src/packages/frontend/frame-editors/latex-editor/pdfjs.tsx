/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

// This is a renderer using pdf.js.

const HIGHLIGHT_TIME_S: number = 6;

import { Alert } from "antd";
import { delay } from "awaiting";
import type { Set as iSet } from "immutable";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist/webpack.mjs";
import { useCallback, useEffect, useRef, useState } from "react";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";

import {
  redux,
  useActions,
  useIsMountedRef,
  useRedux,
} from "@cocalc/frontend/app-framework";
import { Icon, Loading, Markdown } from "@cocalc/frontend/components";
import useVirtuosoScrollHook from "@cocalc/frontend/components/virtuoso-scroll-hook";
import { useFrameContext } from "@cocalc/frontend/frame-editors/frame-tree/frame-context";
import usePinchToZoom from "@cocalc/frontend/frame-editors/frame-tree/pinch-to-zoom";
import { EditorState } from "@cocalc/frontend/frame-editors/frame-tree/types";
import { list_alternatives, seconds_ago } from "@cocalc/util/misc";
import { COLORS } from "@cocalc/util/theme";
import { dblclick } from "./mouse-click";
import { SyncHighlight } from "./pdfjs-annotation";
import { getDocument, url_to_pdf } from "./pdfjs-doc-cache";
import Page, { BG_COL, PAGE_GAP } from "./pdfjs-page";

interface PDFJSProps {
  id: string;
  name: string;
  actions: any;
  editor_state: EditorState;
  is_fullscreen: boolean;
  project_id: string;
  path: string;
  reload: number;
  font_size: number;
  is_current: boolean;
  is_visible: boolean;
  status: string;
}

export function PDFJS({
  id,
  name,
  actions,
  editor_state,
  project_id,
  path,
  reload,
  font_size,
  is_current,
  is_visible,
  status,
}: PDFJSProps) {
  const { desc } = useFrameContext();
  const isMounted = useIsMountedRef();
  const pageActions = useActions("page");

  const zoom_page_width = useRedux(name, "zoom_page_width");
  const zoom_page_height = useRedux(name, "zoom_page_height");
  const sync = useRedux(name, "sync");
  const scroll_pdf_into_view = useRedux(name, "scroll_pdf_into_view")?.toJS();
  const mode: undefined | "rmd" = useRedux(name, "mode");
  const derived_file_types: iSet<string> = useRedux(name, "derived_file_types");
  const custom_pdf_error_message = useRedux(name, "custom_pdf_error_message");

  const [loaded, setLoaded] = useState<boolean>(false);
  const [pages, setPages] = useState<PDFPageProxy[]>([]);
  const [missing, setMissing] = useState<boolean>(false);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [cursor, setCursor] = useState<"grabbing" | "grab">("grab");

  const divRef = useRef<HTMLDivElement>(null);
  usePinchToZoom({ target: divRef });

  useEffect(() => {
    loadDoc(reload);
  }, [reload]);

  useEffect(() => {
    if (zoom_page_height == id) doZoomPageHeight();
    if (zoom_page_width == id) doZoomPageWidth();
    if (sync == id) doSync();
  }, [zoom_page_height, zoom_page_width, sync]);

  useEffect(() => {
    if (scroll_pdf_into_view) {
      const { page, y, id } = scroll_pdf_into_view;
      doScrollIntoView(page, y, id);
    }
  }, [scroll_pdf_into_view]);

  const keyHandler = useCallback((evt) => {
    // console.log("keyHandler", evt);
    // TODO: this same sort navigation *should* be used elsewhere, e.g.
    // in jupyter/cell-list.tsx.  We should refactor it out into a hook somehow.
    // Also, it's done even more badly in jupyter/cell-list.tsx.
    if ((evt.key == " " && !evt.shiftKey) || evt.key == "PageDown") {
      // space = move a visible page down
      virtuosoRef.current?.scrollBy({
        top: divRef.current?.getBoundingClientRect()?.height ?? 200,
      });
      return;
    }
    if ((evt.key == " " && evt.shiftKey) || evt.key == "PageUp") {
      // left = move a visible page up
      virtuosoRef.current?.scrollBy({
        top: -(divRef.current?.getBoundingClientRect()?.height ?? 200),
      });
      return;
    }
    if (evt.key == "ArrowRight") {
      // next page
      virtuosoRef.current?.scrollBy({
        top:
          curPageHeightRef.current ??
          divRef.current?.getBoundingClientRect()?.height ??
          200,
      });
      return;
    }
    if (evt.key == "ArrowLeft") {
      // previous page
      virtuosoRef.current?.scrollBy({
        top: -(
          curPageHeightRef.current ??
          divRef.current?.getBoundingClientRect()?.height ??
          200
        ),
      });
      return;
    }

    if (evt.key == "ArrowDown") {
      if (evt.ctrlKey || evt.metaKey) {
        // end of document
        virtuosoRef.current?.scrollTo({ top: 9999999999999999 });
      } else {
        virtuosoRef.current?.scrollBy({
          top: (divRef.current?.getBoundingClientRect()?.height ?? 300) / 20,
        });
      }
      return;
    }
    if (evt.key == "ArrowUp") {
      if (evt.ctrlKey || evt.metaKey) {
        // begining of document
        virtuosoRef.current?.scrollTo({ top: 0 });
      } else {
        virtuosoRef.current?.scrollBy({
          top: -(divRef.current?.getBoundingClientRect()?.height ?? 300) / 20,
        });
      }
      return;
    }
    if (evt.key == "Home") {
      // beginning
      virtuosoRef.current?.scrollTo({ top: 0 });
      return;
    }
    if (evt.key == "End") {
      // end
      virtuosoRef.current?.scrollTo({ top: 9999999999999999 });
      return;
    }
    if (evt.key == "-" || (evt.key == "," && evt.ctrlKey && evt.shiftKey)) {
      actions.decrease_font_size(id);
      return;
    }
    if (evt.key == "=" || (evt.key == "." && evt.ctrlKey && evt.shiftKey)) {
      actions.increase_font_size(id);
      return;
    }
    if (evt.key == "0" && (evt.metaKey || evt.ctrlKey)) {
      actions.set_font_size(
        id,
        redux.getStore("account").get("font_size") ?? 14,
      );
      return;
    }
  }, []); // important -- don't change it because it gets removed based on the function

  useEffect(() => {
    if (actions == null) {
      return;
    }
    if (is_current && is_visible) {
      actions.set_active_key_handler(keyHandler);
    } else {
      actions.erase_active_key_handler(keyHandler);
    }
  }, [is_current, is_visible, pageActions != null]);

  function renderStatus(): JSX.Element {
    if (status) {
      return <Loading text="Building..." />;
    } else {
      return (
        <>
          <Icon name="play-circle" /> Build or fix
        </>
      );
    }
  }

  function renderMissing(): JSX.Element {
    return (
      <div
        style={{
          fontSize: "20pt",
          color: COLORS.GRAY,
        }}
      >
        Missing PDF -- {renderStatus()}
      </div>
    );
  }

  function renderLoading(): JSX.Element {
    return <Loading theme="medium" />;
  }

  async function loadDoc(reload: number): Promise<void> {
    try {
      const doc: PDFDocumentProxy = await getDocument(
        url_to_pdf(project_id, path, reload),
      );
      if (!isMounted.current) return;
      setMissing(false);
      const v: Promise<PDFPageProxy>[] = [];
      for (let n = 1; n <= doc.numPages; n++) {
        // their promises are slightly different now...
        const page = doc.getPage(n) as unknown as Promise<PDFPageProxy>;
        v.push(page);
      }
      const pages: PDFPageProxy[] = await Promise.all(v);
      if (!isMounted.current) return;
      setDoc(doc);
      setLoaded(true);
      setPages(pages);
      setMissing(false);

      // documents often don't have pageLabels, but when they do, they are
      // good to show (e.g., in a book the content at the beginning might
      // be in roman numerals).
      const pages0 = await doc.getPageLabels();
      if (pages0 != null) {
        // These must be unique, but there are some weird pdf files where they are
        // not and there is nothing we can do about that.  So we just make them unique.
        const X = new Set<string>([]);
        for (let i = 0; i < pages0.length; i++) {
          while (X.has(pages0[i])) {
            pages0[i] = `${pages0[i]}.${i}`;
          }
          X.add(pages0[i]);
        }
      }
      actions.setPages(id, pages0 ?? doc.numPages);
      actions.setPage(id, desc.get("page") ?? (pages0 == null ? 1 : "1"));
    } catch (err) {
      // This is normal if the PDF is being modified *as* it is being loaded...
      console.log(`WARNING: error loading PDF -- ${err}`);
      if (
        isMounted.current &&
        err != null && // err can be null!!
        err.toString()?.indexOf("Missing") != -1
      ) {
        setMissing(true);
        await delay(3000);
        if (isMounted.current && missing && actions.update_pdf != null) {
          // try again, since there is function
          actions.update_pdf(Date.now(), true);
        }
      }
    }
  }

  async function doScrollIntoView(
    page: number,
    y: number,
    id2: string,
  ): Promise<void> {
    if (id != id2) {
      // not set to *this* viewer, so ignore.
      return;
    }
    if (divRef.current == null) return;
    const is_ready = () => {
      return doc != null && doc.getPage != null;
    };
    let i = 0;
    while (i < 50 && !is_ready()) {
      // doc can be defined but not doc.getPage.
      // can't scroll document into position if we haven't even loaded it yet.  Just do nothing in this case.
      await delay(100);
      if (!isMounted.current) return;
      i += 1;
    }
    if (!is_ready()) {
      // give up.
      return;
    }
    if (doc == null) return;
    const height = divRef.current?.getBoundingClientRect()?.height;
    if (!height) return;

    virtuosoRef.current?.scrollToIndex({
      index: page - 1,
      offset: y * getScale() + PAGE_GAP - height / 2,
    });

    // Wait a little before clearing the scroll_pdf_into_view field,
    // so the yellow highlight bar gets rendered as the page is rendered.
    await delay(100);
    actions.setState({ scroll_pdf_into_view: undefined });
  }

  async function doZoomPageWidth(): Promise<void> {
    if (divRef.current == null) return;
    actions.setState({ zoom_page_width: undefined }); // we got the message.
    if (doc == null) return;
    let page;
    try {
      page = await doc.getPage(1);
      if (!isMounted.current) return;
    } catch (err) {
      return; // Can't load, maybe there is no page 1, etc...
    }
    const width = $(divRef.current).width();
    if (width === undefined) return;
    const scale = (width - 10) / page.view[2];
    actions.set_font_size(id, getFontSize(scale));
  }

  async function doZoomPageHeight(): Promise<void> {
    if (divRef.current == null) return;
    actions.setState({ zoom_page_height: undefined });
    let page;
    if (doc == null) return;
    try {
      page = await doc.getPage(1);
      if (!isMounted.current) return;
    } catch (err) {
      return;
    }
    const height = $(divRef.current).height();
    if (height === undefined) return;
    const scale = (height - 10) / page.view[3];
    actions.set_font_size(id, getFontSize(scale));
  }

  function doSync(): void {
    if (divRef.current == null) return;
    actions.setState({ sync: undefined });
    const e = $(divRef.current);
    const offset = e.offset();
    const height = e.height();
    if (!offset || !height) return;
    dblclick(offset.left, offset.top + height / 2);
  }

  function syncHighlight({ n, id }): SyncHighlight | undefined {
    if (
      scroll_pdf_into_view != null &&
      scroll_pdf_into_view.page === n &&
      scroll_pdf_into_view.id === id
    ) {
      return {
        y: scroll_pdf_into_view.y,
        until: seconds_ago(-HIGHLIGHT_TIME_S),
      };
    }
  }

  const [curPageIndex, setCurPageIndex] = useState<number | string>(
    desc.get("page") ?? 0,
  );
  // This can be handy:
  const curPageHeightRef = useRef<number | undefined>(undefined);
  const curPagePosRef = useRef<
    { topOfPage: number; bottomOfPage: number; middle: number } | undefined
  >(undefined);
  const updateCurrentPage = useCallback(
    ({ index, offset }) => {
      // We *define* the current page to be whatever page intersects
      // the exact middle of divRef.  This might not be perfect, but
      // at least it is a definition.
      // We figure this out since we know the page heights
      // and the padding between pages.
      const scale = getScale();
      const divHeight = divRef.current?.getBoundingClientRect()?.height;
      if (divHeight == null) return;
      const middle = divHeight / 2;
      let topOfPage = -offset;
      const heightOfPage = pages[index]?.getViewport({ scale })?.height;
      if (heightOfPage == null) return;
      let bottomOfPage = topOfPage + heightOfPage + PAGE_GAP;
      curPageHeightRef.current = heightOfPage + PAGE_GAP;
      while (
        index + 1 < pages.length &&
        !(topOfPage <= middle && bottomOfPage >= middle)
      ) {
        index += 1;
        topOfPage = bottomOfPage;
        const heightOfPage = pages[index]?.getViewport({ scale })?.height;
        if (heightOfPage == null) return;
        bottomOfPage = topOfPage + heightOfPage + PAGE_GAP;
        // so when done this is correct:
        curPageHeightRef.current = heightOfPage + PAGE_GAP;
      }
      setCurPageIndex(index);
      curPagePosRef.current = { topOfPage, bottomOfPage, middle };
      actions.setPage(id, index + 1);
    },
    [id, pages, font_size],
  );

  const getPageIndex = useCallback(() => {
    const page = desc.get("page");
    if (page == null) return;
    let index;
    if (typeof page == "string") {
      // a little complicated in case of string page labels
      index = desc.get("pages")?.indexOf?.(page);
      if (index == -1 || index == null) return;
    } else {
      index = page - 1;
    }
    return index;
  }, [desc.get("page"), desc.get("pages")]);

  useEffect(() => {
    const index = getPageIndex();
    if (index == null || curPageIndex == index) return;
    virtuosoRef.current?.scrollToIndex({ index, align: "center" });
  }, [desc.get("page")]);

  // When we change anything about the font_size zoom, we preserve
  // the scroll position of the current page. More precisely, imagine
  // a horizontal line through the middle of the current viewport.  By
  // definition, the page it intersects with is the current page.  The
  // invariant we preserve is that this intersection point intersects
  // the current page in the same place after the font size change.
  useEffect(() => {
    const index = getPageIndex();
    if (index == null) return;
    const height = divRef.current?.getBoundingClientRect()?.height;
    if (!height) return;
    const pos = curPagePosRef.current;
    if (pos == null) return;
    const { topOfPage, bottomOfPage, middle } = pos;
    const percent = (middle - topOfPage) / (bottomOfPage - topOfPage);
    const scale = getScale();
    const heightOfPage = pages[index]?.getViewport({ scale })?.height;
    if (heightOfPage == null) return;
    const offset = -height / 2 + heightOfPage * percent;
    const x = { index, offset };
    virtuosoRef.current?.scrollToIndex(x);
  }, [font_size]);

  const virtuosoScroll = useVirtuosoScrollHook({
    cacheId: name + id,
    onScroll: (scrollState) => {
      actions.save_editor_state(id, { scrollState });
      updateCurrentPage(scrollState);
    },
    initialState: editor_state.get("scrollState")?.toJS(),
  });
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  function renderPagesUsingVirtuoso() {
    if (pages == null || pages.length == 0) return [];
    const scale = getScale();
    const viewport = pages[0]?.getViewport({ scale });
    const height = (viewport?.height ?? 500) + PAGE_GAP;
    return (
      <Virtuoso
        increaseViewportBy={2000}
        ref={virtuosoRef}
        defaultItemHeight={height}
        totalCount={doc.numPages}
        itemContent={(index) => {
          const page = pages[index];
          if (page == null) {
            // should not happen
            return <div style={{ height: "1px" }}></div>;
          }
          const n = index + 1;
          return (
            <Page
              id={id}
              actions={actions}
              doc={doc}
              page={page}
              n={n}
              key={n}
              scale={scale}
              syncHighlight={syncHighlight({ n, id })}
            />
          );
        }}
        {...virtuosoScroll}
      />
    );
  }

  function renderContent(): JSX.Element | JSX.Element[] {
    if (!loaded) {
      if (missing) {
        return renderMissing();
      } else {
        return renderLoading();
      }
    } else {
      return <div className="smc-vfill">{renderPagesUsingVirtuoso()}</div>;
    }
  }

  const getScale = useCallback(() => {
    return font_size / (redux.getStore("account").get("font_size") ?? 14);
  }, [font_size]);

  function getFontSize(scale: number): number {
    return (redux.getStore("account").get("font_size") ?? 14) * scale;
  }

  function renderOtherViewers() {
    if (derived_file_types.size == 0) return;
    return (
      <>
        Instead, you might want to switch to the{" "}
        {list_alternatives(derived_file_types)} view by selecting it via the
        dropdown selector above.
      </>
    );
  }

  function renderCustomErrorMessage() {
    if (custom_pdf_error_message == null) return;
    return (
      <Alert
        message={<Markdown value={custom_pdf_error_message} />}
        type="info"
      />
    );
  }

  function renderNoPdf(): JSX.Element {
    return (
      <div
        style={{
          backgroundColor: "white",
          margin: "15px",
          overflowY: "auto",
        }}
      >
        There is no rendered PDF file available. {renderOtherViewers()}
        <hr />
        {renderCustomErrorMessage()}
      </div>
    );
  }

  if (mode == "rmd" && derived_file_types != undefined) {
    if (!derived_file_types.contains("pdf")) {
      return renderNoPdf();
    }
  }

  // Note: we don't have to do anything for touch, since it "just works" for some reason --
  // probably the scroller just supports it.
  // For the "hand tool", which is what we're implementing by default now (select will be soon),
  // click and drag should move the scroll position.
  const lastMousePosRef = useRef<null | { x: number; y: number }>(null);

  const onMouseDown = useCallback((e) => {
    if (e.target?.nodeName == "SPAN") {
      // selection layer text -- allows for selecting instead of dragging around
      return;
    }
    lastMousePosRef.current = getClientPos(e);
    setCursor("grabbing");
  }, []);

  const onMouseMove = useCallback((e) => {
    if (
      !e.buttons ||
      lastMousePosRef.current == null ||
      !window.getSelection()?.isCollapsed
    ) {
      return;
    }
    const { x, y } = getClientPos(e);
    const deltaX = lastMousePosRef.current.x - x;
    const deltaY = lastMousePosRef.current.y - y;
    virtuosoRef.current?.scrollBy({ top: deltaY, left: deltaX });
    lastMousePosRef.current = { x, y };
  }, []);

  const onMouseUp = useCallback(() => {
    lastMousePosRef.current = null;
    setCursor("grab");
  }, []);

  return (
    <div
      className="smc-vfill"
      style={{
        overflow: "auto",
        width: "100%",
        cursor,
        textAlign: "center",
        backgroundColor: !loaded ? "white" : BG_COL,
      }}
      ref={divRef}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
    >
      {renderContent()}
    </div>
  );
}

function getClientPos(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
  return { x: e.clientX, y: e.clientY };
}
