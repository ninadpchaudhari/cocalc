/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

import { Badge, Button, Col, Popconfirm, Row, Space, Tooltip } from "antd";
import { List, Map } from "immutable";
import { CSSProperties, useEffect, useLayoutEffect } from "react";
import { useIntl } from "react-intl";
import { Avatar } from "@cocalc/frontend/account/avatar/avatar";
import {
  CSS,
  redux,
  useMemo,
  useRef,
  useState,
  useTypedRedux,
} from "@cocalc/frontend/app-framework";
import { Gap, Icon, TimeAgo, Tip } from "@cocalc/frontend/components";
import MostlyStaticMarkdown from "@cocalc/frontend/editors/slate/mostly-static-markdown";
import { IS_TOUCH } from "@cocalc/frontend/feature";
import { modelToName } from "@cocalc/frontend/frame-editors/llm/llm-selector";
import { labels } from "@cocalc/frontend/i18n";
import { CancelText } from "@cocalc/frontend/i18n/components";
import { User } from "@cocalc/frontend/users";
import { isLanguageModelService } from "@cocalc/util/db-schema/llm-utils";
import { auxFileToOriginal, plural, unreachable } from "@cocalc/util/misc";
import { COLORS } from "@cocalc/util/theme";
import { ChatActions } from "./actions";
import { getUserName } from "./chat-log";
import { History, HistoryFooter, HistoryTitle } from "./history";
import ChatInput from "./input";
import { LLMCostEstimationChat } from "./llm-cost-estimation";
import { FeedbackLLM } from "./llm-msg-feedback";
import { RegenerateLLM } from "./llm-msg-regenerate";
import { SummarizeThread } from "./llm-msg-summarize";
import { Name } from "./name";
import { Time } from "./time";
import { ChatMessageTyped, Mode, SubmitMentionsFn } from "./types";
import {
  getThreadRootDate,
  is_editing,
  message_colors,
  newest_content,
  sender_is_viewer,
} from "./utils";

const DELETE_BUTTON = false;

const BLANK_COLUMN = (xs) => <Col key={"blankcolumn"} xs={xs}></Col>;

const MARKDOWN_STYLE = undefined;

const BORDER = "2px solid #ccc";

const SHOW_EDIT_BUTTON_MS = 15000;

const TRHEAD_STYLE_SINGLE: CSS = {
  marginLeft: "15px",
  marginRight: "15px",
  paddingLeft: "15px",
} as const;

const THREAD_STYLE: CSS = {
  ...TRHEAD_STYLE_SINGLE,
  borderLeft: BORDER,
  borderRight: BORDER,
} as const;

const THREAD_STYLE_BOTTOM: CSS = {
  ...THREAD_STYLE,
  borderBottomLeftRadius: "10px",
  borderBottomRightRadius: "10px",
  borderBottom: BORDER,
  marginBottom: "10px",
} as const;

const THREAD_STYLE_TOP: CSS = {
  ...THREAD_STYLE,
  borderTop: BORDER,
  borderTopLeftRadius: "10px",
  borderTopRightRadius: "10px",
  marginTop: "10px",
} as const;

const THREAD_STYLE_FOLDED: CSS = {
  ...THREAD_STYLE_TOP,
  ...THREAD_STYLE_BOTTOM,
} as const;

const MARGIN_TOP_VIEWER = "17px";

const AVATAR_MARGIN_LEFTRIGHT = "15px";

interface Props {
  index: number;
  actions?: ChatActions;
  get_user_name: (account_id?: string) => string;
  messages;
  message: ChatMessageTyped;
  account_id: string;
  user_map?: Map<string, any>;
  project_id?: string; // improves relative links if given
  path?: string;
  font_size: number;
  is_prev_sender?: boolean;
  show_avatar?: boolean;
  mode: Mode;
  selectedHashtags?: Set<string>;

  scroll_into_view?: () => void; // call to scroll this message into view

  // if true, include a reply button - this should only be for messages
  // that don't have an existing reply to them already.
  allowReply?: boolean;

  is_thread?: boolean; // if true, there is a thread starting in a reply_to message
  is_folded?: boolean; // if true, only show the reply_to root message
  is_thread_body: boolean;

  costEstimate;

  selected?: boolean;

  // for the root of a folded thread, optionally give this number of a
  // more informative message to the user.
  numChildren?: number;

  // highlighted if provided (when in non-edit mode)
  searchWords?;
}

export default function Message({
  index,
  actions,
  get_user_name,
  messages,
  message,
  account_id,
  user_map,
  project_id,
  path,
  font_size,
  is_prev_sender,
  show_avatar,
  mode,
  selectedHashtags,
  scroll_into_view,
  allowReply,
  is_thread,
  is_folded,
  is_thread_body,
  costEstimate,
  selected,
  numChildren,
  searchWords,
}: Props) {
  const intl = useIntl();

  const showAISummarize = redux
    .getStore("projects")
    .hasLanguageModelEnabled(project_id, "chat-summarize");

  const hideTooltip =
    useTypedRedux("account", "other_settings").get("hide_file_popovers") ??
    false;

  const [edited_message, set_edited_message] = useState<string>(
    newest_content(message),
  );
  // We have to use a ref because of trickiness involving
  // stale closures when submitting the message.
  const edited_message_ref = useRef(edited_message);

  const [show_history, set_show_history] = useState(false);

  const new_changes = useMemo(
    () => edited_message !== newest_content(message),
    [message] /* note -- edited_message is a function of message */,
  );

  // date as ms since epoch or 0
  const date: number = useMemo(() => {
    return message?.get("date")?.valueOf() ?? 0;
  }, [message.get("date")]);

  const generating = message.get("generating");

  const history_size = useMemo(() => message.get("history").size, [message]);

  const isEditing = useMemo(
    () => is_editing(message, account_id),
    [message, account_id],
  );

  const editor_name = useMemo(() => {
    return get_user_name(message.get("history")?.first()?.get("author_id"));
  }, [message]);

  const reverseRowOrdering =
    !is_thread_body && sender_is_viewer(account_id, message);

  const submitMentionsRef = useRef<SubmitMentionsFn>();

  const [replying, setReplying] = useState<boolean>(() => {
    if (!allowReply) {
      return false;
    }
    const replyDate = -getThreadRootDate({ date, messages });
    const draft = actions?.syncdb?.get_one({
      event: "draft",
      sender_id: account_id,
      date: replyDate,
    });
    if (draft == null) {
      return false;
    }
    if (draft.get("active") <= 1720071100408) {
      // before this point in time, drafts never ever got deleted when sending replies!  So there's a massive
      // clutter of reply drafts sitting in chats, and we don't want to resurrect them.
      return false;
    }
    return true;
  });
  useEffect(() => {
    if (!allowReply) {
      setReplying(false);
    }
  }, [allowReply]);

  const [autoFocusReply, setAutoFocusReply] = useState<boolean>(false);
  const [autoFocusEdit, setAutoFocusEdit] = useState<boolean>(false);

  const replyMessageRef = useRef<string>("");
  const replyMentionsRef = useRef<SubmitMentionsFn>();

  const is_viewers_message = sender_is_viewer(account_id, message);
  const verb = show_history ? "Hide" : "Show";

  const isLLMThread = useMemo(
    () => actions?.isLanguageModelThread(message.get("date")),
    [message, actions != null],
  );

  const msgWrittenByLLM = useMemo(() => {
    const author_id = message.get("history")?.first()?.get("author_id");
    return typeof author_id === "string" && isLanguageModelService(author_id);
  }, [message]);

  useLayoutEffect(() => {
    if (replying) {
      scroll_into_view?.();
    }
  }, [replying]);

  function editing_status(is_editing: boolean) {
    let text;

    let other_editors = // @ts-ignore -- keySeq *is* a method of TypedMap
      message.get("editing")?.remove(account_id).keySeq() ?? List();
    if (is_editing) {
      if (other_editors.size === 1) {
        // This user and someone else is also editing
        text = (
          <>
            {`WARNING: ${get_user_name(
              other_editors.first(),
            )} is also editing this! `}
            <b>Simultaneous editing of messages is not supported.</b>
          </>
        );
      } else if (other_editors.size > 1) {
        // Multiple other editors
        text = `${other_editors.size} other users are also editing this!`;
      } else if (history_size !== message.get("history").size && new_changes) {
        text = `${editor_name} has updated this message. Esc to discard your changes and see theirs`;
      } else {
        if (IS_TOUCH) {
          text = "You are now editing ...";
        } else {
          text = "You are now editing ... Shift+Enter to submit changes.";
        }
      }
    } else {
      if (other_editors.size === 1) {
        // One person is editing
        text = `${get_user_name(
          other_editors.first(),
        )} is editing this message`;
      } else if (other_editors.size > 1) {
        // Multiple editors
        text = `${other_editors.size} people are editing this message`;
      } else if (newest_content(message).trim() === "") {
        text = `Deleted by ${editor_name}`;
      }
    }

    if (text == null) {
      text = `Last edit by ${editor_name}`;
    }

    if (
      !is_editing &&
      other_editors.size === 0 &&
      newest_content(message).trim() !== ""
    ) {
      const edit = "Last edit ";
      const name = ` by ${editor_name}`;
      const msg_date = message.get("history").first()?.get("date");
      return (
        <div
          style={{
            color: COLORS.GRAY_M,
            fontSize: "14px" /* matches Reply button */,
          }}
        >
          {edit}{" "}
          {msg_date != null ? (
            <TimeAgo date={new Date(msg_date)} />
          ) : (
            "unknown time"
          )}{" "}
          {name}
        </div>
      );
    }
    return (
      <div style={{ color: COLORS.GRAY_M }}>
        {text}
        {is_editing ? (
          <span style={{ margin: "10px 10px 0 10px", display: "inline-block" }}>
            <Button onClick={on_cancel}>Cancel</Button>
            <Gap />
            <Button onClick={saveEditedMessage} type="primary">
              Save (shift+enter)
            </Button>
          </span>
        ) : undefined}
      </div>
    );
  }

  function edit_message() {
    if (project_id == null || path == null || actions == null) {
      // no editing functionality or not in a project with a path.
      return;
    }
    actions.setEditing(message, true);
    setAutoFocusEdit(true);
    scroll_into_view?.();
  }

  function avatar_column() {
    const sender_id = message.get("sender_id");
    let style: CSSProperties = {};
    if (!is_prev_sender) {
      style.marginTop = "22px";
    } else {
      style.marginTop = "5px";
    }

    if (!is_thread_body) {
      if (sender_is_viewer(account_id, message)) {
        style.marginLeft = AVATAR_MARGIN_LEFTRIGHT;
      } else {
        style.marginRight = AVATAR_MARGIN_LEFTRIGHT;
      }
    }

    return (
      <Col key={0} xs={2}>
        <div style={style}>
          {sender_id != null && show_avatar ? (
            <Avatar size={40} account_id={sender_id} />
          ) : undefined}
        </div>
      </Col>
    );
  }

  function contentColumn() {
    let marginTop;
    let value = newest_content(message);

    const { background, color, lighten, message_class } = message_colors(
      account_id,
      message,
    );

    if (!is_prev_sender && is_viewers_message) {
      marginTop = MARGIN_TOP_VIEWER;
    } else {
      marginTop = "5px";
    }

    const message_style: CSSProperties = {
      color,
      background,
      wordWrap: "break-word",
      borderRadius: "5px",
      marginTop,
      fontSize: `${font_size}px`,
      // no padding on bottom, since message itself is markdown, hence
      // wrapped in <p>'s, which have a big 10px margin on their bottoms
      // already.
      padding: selected ? "6px 6px 0 6px" : "9px 9px 0 9px",
      ...(mode === "sidechat"
        ? { marginLeft: "5px", marginRight: "5px" }
        : undefined),
      ...(selected ? { border: "3px solid #66bb6a" } : undefined),
      maxHeight: is_folded ? "100px" : undefined,
      overflowY: is_folded ? "auto" : undefined,
    } as const;

    const mainXS = mode === "standalone" ? 20 : 22;
    const showEditButton = Date.now() - date < SHOW_EDIT_BUTTON_MS;
    const feedback = message.getIn(["feedback", account_id]);
    const otherFeedback =
      isLLMThread && msgWrittenByLLM ? 0 : (message.get("feedback")?.size ?? 0);
    const showOtherFeedback = otherFeedback > 0;

    const editControlRow = () => {
      if (isEditing) {
        return null;
      }
      const showDeleteButton =
        DELETE_BUTTON && newest_content(message).trim().length > 0;
      const showEditingStatus =
        (message.get("history")?.size ?? 0) > 1 ||
        (message.get("editing")?.size ?? 0) > 0;
      const showHistory = (message.get("history")?.size ?? 0) > 1;
      const showLLMFeedback = isLLMThread && msgWrittenByLLM;

      // Show the bottom line of the message -- this uses a LOT of extra
      // vertical space, so only do it if there is a good reason to.
      // Getting rid of this might be nice.
      const show =
        showEditButton ||
        showDeleteButton ||
        showEditingStatus ||
        showHistory ||
        showLLMFeedback;
      if (!show) {
        // important to explicitly check this before rendering below, since otherwise we get a big BLANK space.
        return null;
      }

      return (
        <div style={{ width: "100%", textAlign: "center" }}>
          <Space direction="horizontal" size="small" wrap>
            {showEditButton ? (
              <Tooltip
                title={
                  <>
                    Edit this message. You can edit <b>any</b> past message at
                    any time by double clicking on it. Fix other people's typos.
                    All versions are stored.
                  </>
                }
                placement="left"
              >
                <Button
                  disabled={replying}
                  style={{
                    color: is_viewers_message ? "white" : "#555",
                  }}
                  type="text"
                  size="small"
                  onClick={() => actions?.setEditing(message, true)}
                >
                  <Icon name="pencil" /> Edit
                </Button>
              </Tooltip>
            ) : undefined}
            {showDeleteButton && (
              <Tooltip
                title="Delete this message. You can delete any past message by anybody.  The deleted message can be view in history."
                placement="left"
              >
                <Popconfirm
                  title="Delete this message"
                  description="Are you sure you want to delete this message?"
                  onConfirm={() => {
                    actions?.setEditing(message, true);
                    setTimeout(() => actions?.sendEdit(message, ""), 1);
                  }}
                >
                  <Button
                    disabled={replying}
                    style={{
                      color: is_viewers_message ? "white" : "#555",
                    }}
                    type="text"
                    size="small"
                  >
                    <Icon name="trash" /> Delete
                  </Button>
                </Popconfirm>
              </Tooltip>
            )}
            {showEditingStatus && editing_status(isEditing)}
            {showHistory && (
              <Button
                style={{
                  marginLeft: "5px",
                  color: is_viewers_message ? "white" : "#555",
                }}
                type="text"
                size="small"
                icon={<Icon name="history" />}
                onClick={() => {
                  set_show_history(!show_history);
                  scroll_into_view?.();
                }}
              >
                <Tip
                  title="Message History"
                  tip={`${verb} history of editing of this message.  Any collaborator can edit any message by double clicking on it.`}
                >
                  {verb} History
                </Tip>
              </Button>
            )}
            {showLLMFeedback && (
              <>
                <RegenerateLLM
                  actions={actions}
                  date={date}
                  model={isLLMThread}
                />
                <FeedbackLLM actions={actions} message={message} />
              </>
            )}
          </Space>
        </div>
      );
    };

    return (
      <Col key={1} xs={mainXS}>
        <div
          style={{ display: "flex" }}
          onClick={() => {
            actions?.setFragment(message.get("date"));
          }}
        >
          {!is_prev_sender &&
          !is_viewers_message &&
          message.get("sender_id") ? (
            <Name sender_name={get_user_name(message.get("sender_id"))} />
          ) : undefined}
          {generating === true && actions ? (
            <Button
              style={{ color: COLORS.GRAY_M }}
              onClick={() => {
                actions?.languageModelStopGenerating(new Date(date));
              }}
            >
              <Icon name="square" /> Stop Generating
            </Button>
          ) : undefined}
        </div>
        <div
          style={message_style}
          className="smc-chat-message"
          onDoubleClick={edit_message}
        >
          {!isEditing && (
            <span style={lighten}>
              <Time message={message} edit={edit_message} />
              {!isLLMThread && (
                <Tooltip
                  title={
                    !showOtherFeedback
                      ? undefined
                      : () => {
                          return (
                            <div>
                              {Object.keys(
                                message.get("feedback")?.toJS() ?? {},
                              ).map((account_id) => (
                                <div
                                  key={account_id}
                                  style={{ marginBottom: "2px" }}
                                >
                                  <Avatar size={24} account_id={account_id} />{" "}
                                  <User account_id={account_id} />
                                </div>
                              ))}
                            </div>
                          );
                        }
                  }
                >
                  <Button
                    style={{
                      marginRight: "5px",
                      float: "right",
                      marginTop: "-4px",
                      color: !feedback && is_viewers_message ? "white" : "#888",
                      fontSize: "12px",
                    }}
                    size="small"
                    type={feedback ? "dashed" : "text"}
                    onClick={() => {
                      actions?.feedback(message, feedback ? null : "positive");
                    }}
                  >
                    {showOtherFeedback ? (
                      <Badge
                        count={otherFeedback}
                        color="darkblue"
                        size="small"
                      />
                    ) : (
                      ""
                    )}
                    <Tooltip
                      title={showOtherFeedback ? undefined : "Like this"}
                    >
                      <Icon
                        name="thumbs-up"
                        style={{
                          color: showOtherFeedback ? "darkblue" : undefined,
                        }}
                      />
                    </Tooltip>
                  </Button>
                </Tooltip>
              )}
              <Tooltip title="Select message. Copy URL to link to this message.">
                <Button
                  onClick={() => {
                    actions?.setFragment(message.get("date"));
                  }}
                  size="small"
                  type={"text"}
                  style={{
                    float: "right",
                    marginTop: "-4px",
                    color: is_viewers_message ? "white" : "#888",
                    fontSize: "12px",
                  }}
                >
                  <Icon name="link" />
                </Button>
              </Tooltip>
              {message.get("comment") != null && (
                <Tooltip title="Mark as resolved and hide discussion">
                  <Button
                    onClick={() => {
                      const id = message.getIn(["comment", "id"]);
                      if (id) {
                        const actions = getEditorActions({
                          project_id,
                          path,
                          message,
                        });
                        actions.comments.set({ id, done: true });
                      }
                    }}
                    type={"text"}
                    style={{
                      float: "right",
                      marginTop: "-8px",
                      fontSize: "15px",
                      color: is_viewers_message ? "white" : "#888",
                    }}
                  >
                    <Icon name="check" />
                  </Button>
                </Tooltip>
              )}
            </span>
          )}
          {!isEditing && (
            <MostlyStaticMarkdown
              style={MARKDOWN_STYLE}
              value={value}
              className={message_class}
              selectedHashtags={selectedHashtags}
              searchWords={searchWords}
              toggleHashtag={
                selectedHashtags != null && actions != null
                  ? (tag) =>
                      actions?.setHashtagState(
                        tag,
                        selectedHashtags?.has(tag) ? undefined : 1,
                      )
                  : undefined
              }
            />
          )}
          {isEditing && renderEditMessage()}
          {editControlRow()}
        </div>
        {show_history && (
          <div>
            <HistoryTitle />
            <History history={message.get("history")} user_map={user_map} />
            <HistoryFooter />
          </div>
        )}
        {replying ? renderComposeReply() : undefined}
      </Col>
    );
  }

  function saveEditedMessage(): void {
    if (actions == null) return;
    const mesg =
      submitMentionsRef.current?.({ chat: `${date}` }) ??
      edited_message_ref.current;
    const value = newest_content(message);
    if (mesg !== value) {
      set_edited_message(mesg);
      actions.sendEdit(message, mesg);
    } else {
      actions.setEditing(message, false);
    }
  }

  function on_cancel(): void {
    set_edited_message(newest_content(message));
    if (actions == null) return;
    actions.setEditing(message, false);
    actions.deleteDraft(date);
  }

  function renderEditMessage() {
    if (project_id == null || path == null || actions?.syncdb == null) {
      // should never get into this position
      // when null.
      return;
    }
    return (
      <div>
        <ChatInput
          fontSize={font_size}
          autoFocus={autoFocusEdit}
          cacheId={`${path}${project_id}${date}`}
          input={newest_content(message)}
          submitMentionsRef={submitMentionsRef}
          on_send={saveEditedMessage}
          height={"auto"}
          syncdb={actions.syncdb}
          date={date}
          onChange={(value) => {
            edited_message_ref.current = value;
          }}
        />
        <div style={{ marginTop: "10px", display: "flex" }}>
          <Button
            style={{ marginRight: "5px" }}
            onClick={() => {
              actions?.setEditing(message, false);
              actions?.deleteDraft(date);
            }}
          >
            {intl.formatMessage(labels.cancel)}
          </Button>
          <Button type="primary" onClick={saveEditedMessage}>
            <Icon name="save" /> Save Edited Message
          </Button>
        </div>
      </div>
    );
  }

  function sendReply(reply?: string) {
    if (actions == null) return;
    setReplying(false);
    if (!reply && !replyMentionsRef.current?.(undefined, true)) {
      reply = replyMessageRef.current;
    }
    actions.sendReply({
      message: message.toJS(),
      reply,
      submitMentionsRef: replyMentionsRef,
    });
    actions.scrollToIndex(index);
  }

  function renderComposeReply() {
    if (project_id == null || path == null || actions?.syncdb == null) {
      // should never get into this position
      // when null.
      return;
    }
    const replyDate = -getThreadRootDate({ date, messages });
    let input;
    let moveCursorToEndOfLine = false;
    if (isLLMThread) {
      input = "";
    } else {
      const replying_to = message.get("history")?.first()?.get("author_id");
      if (!replying_to || replying_to == account_id) {
        input = "";
      } else {
        input = `<span class="user-mention" account-id=${replying_to} >@${editor_name}</span> `;
        moveCursorToEndOfLine = autoFocusReply;
      }
    }
    return (
      <div style={{ marginLeft: mode === "standalone" ? "30px" : "0" }}>
        <ChatInput
          fontSize={font_size}
          autoFocus={autoFocusReply}
          moveCursorToEndOfLine={moveCursorToEndOfLine}
          style={{
            borderRadius: "8px",
            height: "auto" /* for some reason the default 100% breaks things */,
          }}
          cacheId={`${path}${project_id}${date}-reply`}
          input={input}
          submitMentionsRef={replyMentionsRef}
          on_send={sendReply}
          height={"auto"}
          syncdb={actions.syncdb}
          date={replyDate}
          onChange={(value) => {
            replyMessageRef.current = value;
            // replyMentionsRef does not submit mentions, only gives us the value
            const input = replyMentionsRef.current?.(undefined, true) ?? value;
            actions?.llmEstimateCost({
              date: replyDate,
              input,
              message: message.toJS(),
            });
          }}
          placeholder={"Reply to the above message..."}
        />
        <div style={{ margin: "5px 0", display: "flex" }}>
          <Button
            style={{ marginRight: "5px" }}
            onClick={() => {
              setReplying(false);
              actions?.deleteDraft(replyDate);
            }}
          >
            <CancelText />
          </Button>
          <Button
            onClick={() => {
              sendReply();
            }}
            type="primary"
          >
            <Icon name="reply" /> Reply (shift+enter)
          </Button>
          {costEstimate?.get("date") == replyDate && (
            <LLMCostEstimationChat
              costEstimate={costEstimate?.toJS()}
              compact={false}
              style={{ display: "inline-block", marginLeft: "10px" }}
            />
          )}
        </div>
      </div>
    );
  }

  function getStyleBase(): CSS {
    if (!is_thread_body) {
      if (is_thread) {
        if (is_folded) {
          return THREAD_STYLE_FOLDED;
        } else {
          return THREAD_STYLE_TOP;
        }
      } else {
        return TRHEAD_STYLE_SINGLE;
      }
    } else if (allowReply) {
      return THREAD_STYLE_BOTTOM;
    } else {
      return THREAD_STYLE;
    }
  }

  function getStyle(): CSS {
    switch (mode) {
      case "standalone":
        return getStyleBase();
      case "sidechat":
        return {
          ...getStyleBase(),
          marginLeft: "5px",
          marginRight: "5px",
          paddingLeft: "0",
        };
      default:
        unreachable(mode);
        return getStyleBase();
    }
  }

  function renderReplyRow() {
    if (replying || generating || !allowReply || is_folded || actions == null) {
      return;
    }

    return (
      <div style={{ textAlign: "center", width: "100%" }}>
        <Tooltip
          title={
            isLLMThread
              ? `Reply to ${modelToName(
                  isLLMThread,
                )}, sending the thread as context.`
              : "Reply to this thread."
          }
        >
          <Button
            type="text"
            onClick={() => {
              setReplying(true);
              setAutoFocusReply(true);
            }}
            style={{ color: COLORS.GRAY_M }}
          >
            <Icon name="reply" /> Reply
            {isLLMThread ? ` to ${modelToName(isLLMThread)}` : ""}
            {isLLMThread ? (
              <Avatar
                account_id={isLLMThread}
                size={16}
                style={{ top: "-5px" }}
              />
            ) : undefined}
          </Button>
        </Tooltip>
        {showAISummarize && is_thread ? (
          <SummarizeThread message={message} actions={actions} />
        ) : undefined}
      </div>
    );
  }

  function renderFoldedRow() {
    if (!is_folded || !is_thread || is_thread_body) {
      return;
    }

    let label;
    if (numChildren) {
      label = (
        <>
          {numChildren} {plural(numChildren, "Reply", "Replies")}
        </>
      );
    } else {
      label = "View Replies";
    }

    return (
      <Col xs={24}>
        <div style={{ textAlign: "center" }}>
          <Button
            onClick={() =>
              actions?.toggleFoldThread(message.get("date"), index)
            }
            type="link"
            style={{ color: "darkblue" }}
          >
            {label}
          </Button>
        </div>
      </Col>
    );
  }

  function getThreadfoldOrBlank() {
    const xs = 2;
    if (is_thread_body || (!is_thread_body && !is_thread)) {
      return BLANK_COLUMN(xs);
    } else {
      const style: CSS =
        mode === "standalone"
          ? {
              color: "#666",
              marginTop: MARGIN_TOP_VIEWER,
              marginLeft: "5px",
              marginRight: "5px",
            }
          : {
              color: "#666",
              marginTop: "5px",
              width: "100%",
              textAlign: "center",
            };
      const iconname = is_folded
        ? mode === "standalone"
          ? reverseRowOrdering
            ? "right-circle-o"
            : "left-circle-o"
          : "right-circle-o"
        : "down-circle-o";
      const button = (
        <Button
          type="text"
          style={style}
          onClick={() => actions?.toggleFoldThread(message.get("date"), index)}
          icon={
            <Icon
              name={iconname}
              style={{ fontSize: mode === "standalone" ? "22px" : "18px" }}
            />
          }
        />
      );
      return (
        <Col
          xs={xs}
          key={"blankcolumn"}
          style={{ textAlign: reverseRowOrdering ? "left" : "right" }}
        >
          {hideTooltip ? (
            button
          ) : (
            <Tooltip
              title={
                is_folded ? (
                  <>
                    Unfold this thread{" "}
                    {numChildren
                      ? ` to show ${numChildren} ${plural(
                          numChildren,
                          "reply",
                          "replies",
                        )}`
                      : ""}
                  </>
                ) : (
                  "Fold this thread to hide replies"
                )
              }
            >
              {button}
            </Tooltip>
          )}
        </Col>
      );
    }
  }

  function renderCols(): JSX.Element[] | JSX.Element {
    // these columns should be filtered in the first place, this here is just an extra check
    if (is_thread && is_folded && is_thread_body) {
      return <></>;
    }

    switch (mode) {
      case "standalone":
        const cols = [avatar_column(), contentColumn(), getThreadfoldOrBlank()];
        if (reverseRowOrdering) {
          cols.reverse();
        }
        return cols;

      case "sidechat":
        return [getThreadfoldOrBlank(), contentColumn()];

      default:
        unreachable(mode);
        return contentColumn();
    }
  }

  return (
    <Row
      style={getStyle()}
      onClick={
        message.get("comment") && path && project_id
          ? () => {
              const id = message.getIn(["comment", "id"]);
              if (id) {
                const actions = getEditorActions({ project_id, path, message });
                actions.selectComment(id);
              }
            }
          : undefined
      }
    >
      {renderCols()}
      {renderFoldedRow()}
      {renderReplyRow()}
    </Row>
  );
}

// Used for exporting chat to markdown file
export function message_to_markdown(message): string {
  let value = newest_content(message);
  const user_map = redux.getStore("users").get("user_map");
  const sender = getUserName(user_map, message.get("sender_id"));
  const date = message.get("date").toString();
  return `*From:* ${sender}  \n*Date:* ${date}  \n\n${value}`;
}

// If this is a side chat message, this gets the main editor that this
// is next to, or possibly a different file in case of comments and
// multifile editing.
function getEditorActions({ project_id, path, message }) {
  const commentPath = message.getIn(["comment", "path"]);
  const origPath = auxFileToOriginal(path);
  return redux.getEditorActions(project_id, commentPath ?? origPath);
}
