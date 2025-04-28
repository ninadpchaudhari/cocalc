/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

/*
Define a jQuery plugin that processes links.

 - Make all links open internally or in a new tab; etc.
 - Makes relative image, video, object and source paths work.
 - Handles anchor links
*/

import { join } from "path";
import { is_valid_uuid_string as isUUID } from "@cocalc/util/misc";
import { isCoCalcURL } from "@cocalc/frontend/lib/cocalc-urls";
import Fragment, { FragmentId } from "@cocalc/frontend/misc/fragment-id";
import { fileURL } from "@cocalc/frontend/lib/cocalc-urls";

type jQueryAPI = Function;

type LoadTargetFunction = (
  target: string,
  switchTo: boolean,
  a: boolean,
  b: boolean,
  fragmentId?: FragmentId,
) => void;

interface Options {
  $: jQueryAPI; // something with jquery api -- might be cheerio or jQuery itself.
  urlTransform?: (url: string, tag?: string) => string | undefined;
  projectId?: string;
  filePath?: string;
  projectActions?: {
    load_target: LoadTargetFunction;
  };
  doubleClick?: boolean;
}

function loadTarget(
  target: string,
  switchTo: boolean,
  fragmentId: FragmentId | undefined,
  projectActions: { load_target: LoadTargetFunction },
): void {
  // get rid of "?something" in "path/file.ext?something"
  const i = target.lastIndexOf("/");
  if (i > 0) {
    const j = target.slice(i).indexOf("?");
    if (j >= 0) target = target.slice(0, i + j);
  }
  projectActions.load_target(target, switchTo, false, true, fragmentId);
}

function processAnchorTag(y: any, opts: Options): void {
  let href = y?.attr("href");
  if (typeof href != "string") {
    return;
  }
  if (opts.urlTransform != null) {
    // special option; used, e.g., for Jupyter's attachment: url's
    href = opts.urlTransform(href, "a") ?? href;
    y.attr("href", href);
  }
  if (href.startsWith("#")) {
    // CASE: internal URI fragment pointing to something in this same document.
    href = y[0].baseURI + href; // will get handled below.
  }
  if (href.startsWith("mailto:")) {
    return; // do nothing
  }
  const { projectActions } = opts;
  let handleClick: any = null;
  if (projectActions && isCoCalcURL(href) && href.includes("/projects/")) {
    // CASE: Link inside a specific browser tab.
    // target starts with cloud URL or is absolute, and has /projects/ in it,
    // so we open the link directly inside this browser tab.
    // WARNING: there are cases that could be wrong via this heuristic, e.g.,
    // a raw link that happens to have /projects/ in it -- deal with them someday...
    handleClick = (e) => {
      let fragmentId;
      const url = href;
      const i = url.indexOf("/projects/");
      let target = url.slice(i + "/projects/".length);
      const v = target.split("#");
      if (v.length > 1) {
        let hash;
        [target, hash] = v;
        fragmentId = Fragment.decode(hash);
      } else {
        fragmentId = undefined;
      }
      loadTarget(
        decodeURI(target),
        !(e.which === 2 || e.ctrlKey || e.metaKey),
        fragmentId,
        projectActions,
      );
      return false;
    };
  } else if (
    projectActions &&
    href.indexOf("http://") !== 0 &&
    href.indexOf("https://") !== 0
  ) {
    // does not start with http
    // internal link
    handleClick = (e) => {
      let fragmentId;
      let target = href;
      const v = target.split("#");
      if (v.length > 1) {
        let hash;
        [target, hash] = v;
        fragmentId = Fragment.decode(hash);
      } else {
        fragmentId = undefined;
      }
      // if DEBUG then console.log "target", target
      if (target.indexOf("/projects/") === 0) {
        // fully absolute (but without https://...)
        target = decodeURI(target.slice("/projects/".length));
      } else if (
        target[0] === "/" &&
        target[37] === "/" &&
        isUUID(target.slice(1, 37))
      ) {
        // absolute path with /projects/ omitted -- /..projectId../files/....
        target = decodeURI(target.slice(1)); // just get rid of leading slash
      } else if (target[0] === "/" && opts.projectId) {
        // absolute inside of project -- we CANNOT use join here
        // since it is critical to **keep** the slash to get
        //   .../files//path/to/somewhere
        // Otherwise, there is now way to represent an absolute path.
        // A URL isn't just a unix path in general.
        target = opts.projectId + "/files/" + decodeURI(target);
      } else if (opts.projectId && opts.filePath != null) {
        // realtive to current path
        let x: string = decodeURI(target);
        if (x == null) x = "";
        target = join(opts.projectId, "files", opts.filePath ?? "", x);
      }
      loadTarget(
        target,
        !(e.which === 2 || e.ctrlKey || e.metaKey),
        fragmentId,
        projectActions,
      );
      return false;
    };
  } else {
    // make links open in a new tab by default
    y.attr("target", "_blank");
    y.attr("rel", "noopener");
  }
  if (handleClick != null) {
    if (opts.doubleClick) {
      y.dblclick(handleClick);
      y.click((e) => {
        e.preventDefault();
      });
    } else {
      y.click(handleClick);
    }
  }
}

function processAnchorTags(e: any, opts: Options): void {
  for (const x of e?.find?.("a") ?? []) {
    processAnchorTag(opts.$(x), opts);
  }
}

function processMediaTag(
  y: any,
  tag: string,
  attr: string,
  opts: Options,
): void {
  let newSrc: string | undefined = undefined;
  let src: string | undefined = y.attr(attr);
  if (src == null) {
    return;
  }
  if (opts.urlTransform != null) {
    src = opts.urlTransform(src, tag) ?? src;
    y.attr(attr, src);
  }
  if (src[0] === "/" || src.slice(0, 5) === "data:") {
    // absolute path or data: url
    newSrc = src;
  } else if (opts.projectId != null && opts.filePath != null) {
    let projectId: string;
    const i = src.indexOf("/projects/");
    const j = src.indexOf("/files/");
    if (isCoCalcURL(src) && i !== -1 && j !== -1 && j > i) {
      // the href is inside the app, points to the current project or another one
      // j-i should be 36, unless we ever start to have different (vanity) project_ids
      const path = src.slice(j + "/files/".length);
      projectId = src.slice(i + "/projects/".length, j);
      newSrc = fileURL({ project_id: projectId, path });
      y.attr(attr, newSrc);
      return;
    }
    if (src.indexOf("://") !== -1) {
      // link points somewhere else
      return;
    }
    // we do not have an absolute url, hence we assume it is a
    // relative URL to a file in a project
    newSrc = `${fileURL({ project_id: opts.projectId, path: opts.filePath })}/${src}`;
  }
  if (newSrc != null) {
    y.attr(attr, newSrc);
  }
}

function processMediaTags(e, opts: Options) {
  for (const [tag, attr] of [
    ["img", "src"],
    ["object", "data"],
    ["video", "src"],
    ["source", "src"],
    ["audio", "src"],
  ]) {
    for (const x of e.find(tag)) {
      processMediaTag(opts.$(x), tag, attr, opts);
    }
  }
}

export default function processLinks(elt, opts: Options) {
  elt.each((_, x) => {
    const e = opts.$(x);
    // part #1: process <a> anchor tags
    processAnchorTags(e, opts);
    // part #2: process <img>, <object> and <video>/<source> tags
    // make relative links to images use the raw server
    processMediaTags(e, opts);
  });
}
