/*
URI fragments identifier management

The different types are inspired by https://en.wikipedia.org/wiki/URI_fragment
*/

import { debounce } from "lodash";
import { IS_EMBEDDED } from "@cocalc/frontend/client/handle-target";

export interface FragmentId {
  chat?: string; // fragment refers to ms since epoch of chat message
  anchor?: string;
  // a specific line in a document
  line?: number;
  // an id of an element or cell, e.g., in a whiteboard or Jupyter notebook.
  // These ids are assumed globally unique, so no page is specified.
  id?: string;
  // a specific page in a document, but where no line or element in that page is specified.
  page?: string;
}

export function isPageFragment(x: any): x is FragmentId {
  return !!x?.page;
}

namespace Fragment {
  // set is debounced so you can call it as frequently as you want...
  export const set = debounce((fragmentId: FragmentId | undefined) => {
    if (IS_EMBEDDED) return; // no op in embed mode.
    const url = new URL(location.href);
    url.hash = encode(fragmentId);
    history.replaceState({}, "", url.href);
  }, 100);

  export function get(): FragmentId | undefined {
    return decode(location.hash.slice(1));
  }

  export function clear() {
    set(undefined);
  }

  export function encode(fragmentId: FragmentId | undefined): string {
    if (fragmentId == null) return "";
    if (typeof fragmentId != "object") {
      console.warn("encode -- invalid fragmentId object: ", fragmentId);
      throw Error(`attempt to encode invalid fragmentId -- "${fragmentId}"`);
    }
    if (fragmentId.anchor != null) {
      return fragmentId.anchor;
    }
    const v: string[] = [];
    for (const key in fragmentId) {
      v.push(`${key}=${fragmentId[key]}`);
    }
    return v.join("&");
  }

  export function decode(hash?: string): FragmentId | undefined {
    if (hash?.[0] == "#") {
      hash = hash.slice(1);
    }
    if (!hash) return undefined;
    if (!hash.includes("=")) {
      return { anchor: hash };
    }
    const fragmentId: any = {};
    for (const x of hash.split("&")) {
      const v = x.split("=");
      if (v.length == 2) {
        fragmentId[v[0]] = v[1];
      }
    }
    return fragmentId as FragmentId;
  }
}

export default Fragment;
