import { Button, Tooltip } from "antd";
import { useEffect, useRef, useState } from "react";
import { useDebouncedCallback } from "use-debounce";

import { Comment } from "@ant-design/compatible";
import { Avatar } from "@cocalc/frontend/account/avatar/avatar";
import { redux } from "@cocalc/frontend/app-framework";
import { SubmitMentionsFn } from "@cocalc/frontend/chat/types";
import { Icon, TimeAgo } from "@cocalc/frontend/components";
import MultiMarkdownInput from "@cocalc/frontend/editors/markdown-input/multimode";
import "@cocalc/frontend/editors/slate/elements/math/math-widget";
import StaticMarkdown from "@cocalc/frontend/editors/slate/static-markdown";
import { SAVE_DEBOUNCE_MS } from "@cocalc/frontend/frame-editors/code-editor/const";
import { len, trunc_middle } from "@cocalc/util/misc";
import { useFrameContext } from "../hooks";
import { Element } from "../types";
import Composing from "./chat-composing";
import { ChatLog, getChatStyle, messageStyle } from "./chat-static";
import useEditFocus from "./edit-focus";
import useWheel from "./scroll-wheel";
import { getStyle } from "./text";

const INPUT_HEIGHT = "123px";

interface Props {
  element: Element;
  focused?: boolean;
}

export default function ChatDynamic({ element, focused }: Props) {
  return (
    <>
      <Icon
        name={"comment"}
        style={getStyle(element, { fontSize: 24, background: "white" })}
      />
      <Conversation element={element} focused={focused} />
    </>
  );
}

function Conversation({ element, focused }: Props) {
  const { actions, desc } = useFrameContext();
  const [editFocus, setEditFocus] = useEditFocus(desc.get("editFocus"));
  const [mode, setMode] = useState<string>("");
  const submitMentionsRef = useRef<SubmitMentionsFn | undefined>(undefined);

  const saveChat = useDebouncedCallback((input) => {
    lastInputRef.current = input;
    actions.saveChat({ id: element.id, input });
  }, SAVE_DEBOUNCE_MS);

  const [input, setInput] = useState<string>("");
  // we ensure input is set properly to what's in the element
  // when it is focused.  When NOT focused, we don't bother,
  // to avoid wasting resources.
  // NOTE: this implementation is highly inefficient and needs to be changed.
  // The problem is that element.data[account_id] is not a string column, so
  // every change saves the entire string, rather than just diffs.  The only
  // good way to fix this is with another record type in the syncdb, I think...
  // or a separate ephemeral table (which adds its own complexity, of course).
  // Things *are* done properly and efficiently for our normal side and chatroom
  // chat (e.g., @cocalc/frontend/chat).
  const lastInputRef = useRef<string>("");
  useEffect(() => {
    if (!focused) return;
    const input1 =
      element.data?.[redux.getStore("account").get_account_id()]?.input ?? "";
    if (input1 != lastInputRef.current) {
      saveChat.cancel();
      setInput(input1);
    }
    lastInputRef.current = input1;
  }, [element, focused]);

  const clearInput = () => {
    lastInputRef.current = "";
    setInput("");
    saveChat.cancel();
  };

  // When the component is unmounted, we will fetch data if the input has changed.
  useEffect(
    () => () => {
      saveChat.flush();
    },
    [saveChat],
  );
  const divRef = useRef<any>(null);
  useWheel(divRef);

  return (
    <div style={getChatStyle(element)}>
      <ChatLog
        Message={Message}
        element={element}
        style={{
          flex: 1,
          overflowY: "auto",
          background: "white",
        }}
      />
      <Composing element={element} focused={focused} />
      {(focused || len(element.data) === 0) && (
        <div
          ref={divRef}
          style={{ height: "125px", display: "flex" }}
          className={editFocus ? "nodrag" : undefined}
          onClick={() => {
            if (focused && !editFocus) {
              setEditFocus(true);
            }
          }}
          onTouchStart={() => {
            if (focused && !editFocus) {
              setEditFocus(true);
            }
          }}
        >
          <MultiMarkdownInput
            submitMentionsRef={submitMentionsRef as any}
            saveDebounceMs={0}
            onFocus={() => {
              setEditFocus(true);
            }}
            onBlur={() => {
              setEditFocus(false);
            }}
            isFocused={focused && editFocus}
            hideHelp
            noVfill
            minimal
            placeholder="Type a message..."
            height={INPUT_HEIGHT}
            value={input}
            style={{
              width: `${
                element.w - 152
              }px` /* use exact computation for width so when there is a very wide single line with no spaces, still keeps right size.  This is a little ugly, but works fine since we know the dimensions of the element. */,
              ...(mode == "editor"
                ? {
                    border: "1px solid #ccc",

                    paddingLeft: "5px",
                  }
                : undefined),
            }}
            onChange={(input) => {
              setInput(input);
              saveChat(input);
            }}
            onShiftEnter={(input) => {
              saveChat.cancel();
              actions.sendChat({ id: element.id, input });
              submitMentionsRef.current?.({ id: element.id }); // send all the mentions, noting that they for *this* chat element.
              clearInput();
            }}
            onUndo={() => {
              saveChat.cancel();
              actions.undo();
            }}
            onRedo={() => {
              saveChat.cancel();
              actions.redo();
            }}
            editBarStyle={{
              visibility:
                !editFocus || mode == "markdown" ? "hidden" : undefined,
              bottom: "-36px",
              left: "126px",
              position: "absolute",
              boxShadow: "1px 3px 5px #ccc",
              margin: "5px",
              minWidth: "500px",
              background: "white",
              fontFamily: "sans-serif",
              paddingRight: 0, // undoing a temporary hack
            }}
            modeSwitchStyle={{
              visibility: !editFocus ? "hidden" : undefined,
              bottom: "-30px",
              left: 0,
              width: "130px",
              boxShadow: "1px 3px 5px #ccc",
            }}
            onModeChange={setMode}
            cmOptions={{
              lineNumbers: false, // implementation of line numbers in codemirror is incompatible with CSS scaling
            }}
          />
          <Tooltip title="Send message (shift+enter)">
            <Button
              disabled={!input.trim()}
              type="primary"
              style={{ height: INPUT_HEIGHT, marginLeft: "5px" }}
              onClick={() => {
                actions.sendChat({ id: element.id, input });
                submitMentionsRef.current?.({ id: element.id }); // send all the mentions
                clearInput();
              }}
            >
              Send
            </Button>
          </Tooltip>
        </div>
      )}
    </div>
  );
}

export function Message({
  element,
  messageId,
}: {
  element: Element;
  messageId: number | string;
}) {
  let { input, sender_id, sender_name, time } = element.data?.[messageId] ?? {};
  if (typeof messageId == "string") {
    sender_id = messageId;
  }
  return (
    <div style={messageStyle}>
      <Comment
        author={sender_id ? (getName(sender_id) ?? sender_name) : undefined}
        avatar={sender_id ? <Avatar account_id={sender_id} /> : undefined}
        content={
          typeof messageId == "number" ? (
            <StaticMarkdown value={input ?? ""} />
          ) : (
            <Icon name="ellipsis" style={{ fontSize: "24px" }} />
          )
        }
        datetime={<TimeAgo date={time} />}
      />
    </div>
  );
}

export function getName(account_id: string): undefined | string {
  const name = redux.getStore("users").get_name(account_id)?.trim();
  if (!name) return undefined;
  return trunc_middle(name, 20);
}
