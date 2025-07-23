import { CSSProperties, FC, ReactNode, useEffect, useRef } from "react";
import { getStyle } from "./text-static";
import { Icon } from "@cocalc/frontend/components/icon";
import { Comment } from "@ant-design/compatible";
import { Element } from "../types";
import { cmp } from "@cocalc/util/misc";
import StaticMarkdown from "@cocalc/frontend/editors/slate/static-markdown";
import useWheel from "./scroll-wheel";
import { is_valid_uuid_string as isUUID } from "@cocalc/util/misc";

export default function ChatStatic({ element }: { element: Element }) {
  return (
    <>
      <Icon
        name={"comment"}
        style={getStyle(element, { fontSize: 24, background: "white" })}
      />
      <div style={getChatStyle(element)}>
        <ChatLog
          Message={Message}
          element={element}
          style={{ flex: 1, overflowY: "auto", background: "white" }}
        />
      </div>
    </>
  );
}

export function getChatStyle(element: Element): CSSProperties {
  return {
    padding: "5px",
    margin: "0 30px 30px 30px",
    background: "white",
    height: `${element.h - 60}px`,
    display: "flex",
    flexDirection: "column",
    border: `3px solid ${element.data?.color ?? "#ccc"}`,
    borderRadius: "5px",
    boxShadow: "1px 5px 7px rgb(33 33 33 / 70%)",
  };
}

export function ChatLog({
  element,
  style,
  Message,
}: {
  element: Element;
  style: CSSProperties;
  Message: FC<{ element: Element; messageId: number | string }>;
}) {
  const divRef = useRef<any>(null);
  useWheel(divRef);

  useEffect(() => {
    const elt = divRef.current as any;
    if (elt) {
      elt.scrollTop = elt.scrollHeight;
    }
  }, [element.data]);
  const v: ReactNode[] = [];
  for (const n of messageNumbers(element)) {
    v.push(<Message key={n} element={element} messageId={n} />);
  }
  return (
    <div ref={divRef} style={style}>
      {v}
    </div>
  );
}

export function lastMessageNumber(element: Element): number {
  let n = -1;
  for (const field in element.data ?? {}) {
    const k = parseInt(field);
    if (!isNaN(k)) {
      n = Math.max(n, k);
    }
  }
  return n;
}

function messageNumbers(element: Element): number[] {
  const v: number[] = [];
  for (const field in element.data ?? {}) {
    if (isUUID(field)) continue;
    const k = parseInt(field);
    if (!isNaN(k)) {
      v.push(k);
    }
  }
  v.sort(cmp);
  return v;
}

// Mutates element removing all messages and drafts:
// delete all the chat messages, e.g., everything in element.data
// with key a number.
export function clearChat(element: Element): void {
  if (element.data == null || element.type != "chat") return;
  for (const field in element.data) {
    if (isUUID(field)) {
      delete element.data[field];
    }
    const k = parseInt(field);
    if (!isNaN(k)) {
      delete element.data[k];
    }
  }
}

export const messageStyle = {
  border: "1px solid #ccc",
  borderRadius: "5px",
  margin: "5px 0",
  padding: "5px 15px",
} as CSSProperties;

export function Message({
  element,
  messageId,
}: {
  element: Element;
  messageId: number | string;
}) {
  const { input, sender_name, time } = element.data?.[messageId] ?? {};
  return (
    <div style={messageStyle}>
      <Comment
        author={sender_name}
        content={
          typeof messageId == "number" ? (
            <StaticMarkdown value={input ?? ""} />
          ) : (
            "..."
          )
        }
        datetime={new Date(time).toLocaleString()}
      />
    </div>
  );
}
