/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

import { useEffect, useRef, useState } from "react";
import ShowError from "@cocalc/frontend/components/error";
import { delay } from "awaiting";
import { uuid, replace_all } from "@cocalc/util/misc";
import { useFileContext } from "@cocalc/frontend/lib/file-context";

interface Props {
  value: string;
  style?;
}

export default function Mermaid({ value, style }: Props) {
  const mermaidRef = useRef<any>(null);
  const [mermaidError, setMermaidError] = useState<string>("");
  const processingRef = useRef<boolean>(false);
  const [id] = useState<string>("a" + replace_all(uuid(), "-", ""));
  const { getMermaid } = useFileContext();

  if (getMermaid == null) {
    return <div style={style}>Mermaid not available</div>;
  }

  const waitUntilNotProcessing = async () => {
    let d = 1;
    while (processingRef.current) {
      // value changed *while* processing.
      await delay(d);
      d *= 1.2;
    }
  };

  useEffect(() => {
    const elt = mermaidRef.current;
    if (!elt) {
      return;
    }
    if (!value.trim()) {
      elt.innerHTML = "";
      return;
    }
    (async () => {
      try {
        await waitUntilNotProcessing();
        processingRef.current = true;
        setMermaidError("");
        const mermaid = await getMermaid();
        const { svg } = await mermaid.render(id, value);
        elt.innerHTML = svg;
      } catch (err) {
        setMermaidError(err.str ?? `${err}`);
      } finally {
        processingRef.current = false;
      }
    })();
  }, [value]);

  return (
    <div style={style}>
      <pre ref={mermaidRef}></pre>
      <ShowError error={mermaidError} setError={setMermaidError} />
    </div>
  );
}
