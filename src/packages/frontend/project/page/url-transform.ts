import { join } from "path";
import { fileURL } from "@cocalc/frontend/lib/cocalc-urls";
import { containingPath } from "@cocalc/util/misc";
import { isCoCalcURL, parseCoCalcURL } from "@cocalc/frontend/lib/cocalc-urls";

interface Options {
  project_id: string;
  path: string;
}
// NOTE: there is a similar function in next/lib/share/url-transform.ts

export default function getUrlTransform({ project_id, path }: Options) {
  const dir = containingPath(path);
  return (href: string, tag: string) => {
    if (href.startsWith("data:")) return; // never change data: urls in any way.
    if (tag == "a" || href.includes("://")) {
      // Anchor tags are dealt with via AnchorTagComponent
      // We also only modify local urls and cloud urls (only on frontend -- they will fail on share server).
      if (isCoCalcURL(href)) {
        const { project_id, path } = parseCoCalcURL(href);
        if (project_id != null && path != null) {
          return fileURL({ project_id, path });
        }
      }
      return;
    }
    return fileURL({ project_id, path: join(dir, href) });
  };
}
