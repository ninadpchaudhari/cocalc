/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

/*
Render all the messages in the chat.
*/

import { Alert, Button } from "antd";
import { Set as immutableSet } from "immutable";
import { MutableRefObject, useEffect, useMemo, useRef } from "react";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { chatBotName, isChatBot } from "@cocalc/frontend/account/chatbot";
import { useRedux, useTypedRedux } from "@cocalc/frontend/app-framework";
import { Icon } from "@cocalc/frontend/components";
import useVirtuosoScrollHook from "@cocalc/frontend/components/virtuoso-scroll-hook";
import { HashtagBar } from "@cocalc/frontend/editors/task-editor/hashtag-bar";
import {
  cmp,
  hoursToTimeIntervalHuman,
  parse_hashtags,
  plural,
} from "@cocalc/util/misc";
import type { ChatActions } from "./actions";
import Composing from "./composing";
import Message from "./message";
import type { ChatMessageTyped, ChatMessages, Mode } from "./types";
import { getSelectedHashtagsSearch, newest_content } from "./utils";
import { getRootMessage, getThreadRootDate } from "./utils";
import { DivTempHeight } from "@cocalc/frontend/jupyter/cell-list";
import { filterMessages } from "./filter-messages";

interface Props {
  project_id: string; // used to render links more effectively
  path: string;
  mode: Mode;
  scrollToBottomRef?: MutableRefObject<(force?: boolean) => void>;
  setLastVisible?: (x: Date | null) => void;
  fontSize?: number;
  actions: ChatActions;
  search;
  filterRecentH?;
  selectedHashtags;
  disableFilters?: boolean;
  scrollToIndex?: null | number | undefined;
  // scrollToDate = string ms from epoch
  scrollToDate?: null | undefined | string;
  selectedDate?: string;
}

export function ChatLog({
  project_id,
  path,
  scrollToBottomRef,
  mode,
  setLastVisible,
  fontSize,
  actions,
  search: search0,
  filterRecentH,
  selectedHashtags: selectedHashtags0,
  disableFilters,
  scrollToIndex,
  scrollToDate,
  selectedDate,
}: Props) {
  const messages = useRedux(["messages"], project_id, path) as ChatMessages;
  const llm_cost_reply: [number, number] = useRedux(
    ["llm_cost_reply"],
    project_id,
    path,
  );

  // see similar code in task list:
  const { selectedHashtags, selectedHashtagsSearch } = useMemo(() => {
    return getSelectedHashtagsSearch(selectedHashtags0);
  }, [selectedHashtags0]);
  const search = (search0 + " " + selectedHashtagsSearch).trim();

  const user_map = useTypedRedux("users", "user_map");
  const account_id = useTypedRedux("account", "account_id");
  const { dates: sortedDates, numFolded } = useMemo<{
    dates: string[];
    numFolded: number;
  }>(() => {
    const { dates, numFolded } = getSortedDates(
      messages,
      search,
      account_id!,
      filterRecentH,
    );
    // TODO: This is an ugly hack because I'm tired and need to finish this.
    // The right solution would be to move this filtering to the store.
    // The timeout is because you can't update a component while rendering another one.
    setTimeout(() => {
      setLastVisible?.(
        dates.length == 0
          ? null
          : new Date(parseFloat(dates[dates.length - 1])),
      );
    }, 1);
    return { dates, numFolded };
  }, [messages, search, project_id, path, filterRecentH]);

  useEffect(() => {
    scrollToBottomRef?.current?.(true);
  }, [search]);

  useEffect(() => {
    if (scrollToIndex == null) {
      return;
    }
    if (scrollToIndex == -1) {
      scrollToBottomRef?.current?.(true);
    } else {
      virtuosoRef.current?.scrollToIndex({ index: scrollToIndex });
    }
    actions.clearScrollRequest();
  }, [scrollToIndex]);

  useEffect(() => {
    if (scrollToDate == null) {
      return;
    }
    // linear search, which should be fine given that this is not a tight inner loop
    const index = sortedDates.indexOf(scrollToDate);
    if (index == -1) {
      // didn't find it?
      const message = messages.get(scrollToDate);
      if (message == null) {
        // the message really doesn't exist.  Weird.  Give up.
        actions.clearScrollRequest();
        return;
      }
      let tryAgain = false;
      // we clear all filters and ALSO make sure
      // if message is in a folded thread, then that thread is not folded.
      if (account_id && isFolded(messages, message, account_id)) {
        // this actually unfolds it, since it was folded.
        const date = new Date(
          getThreadRootDate({ date: parseFloat(scrollToDate), messages }),
        );
        actions.toggleFoldThread(date);
        tryAgain = true;
      }
      if (messages.size > sortedDates.length && (search || filterRecentH)) {
        // there was a search, so clear it just to be sure -- it could still hide
        // the folded threaded
        actions.clearAllFilters();
        tryAgain = true;
      }
      if (tryAgain) {
        // we have to wait a while for full re-render to happen
        setTimeout(() => {
          actions.scrollToDate(parseFloat(scrollToDate));
        }, 10);
      } else {
        // totally give up
        actions.clearScrollRequest();
      }
      return;
    }
    virtuosoRef.current?.scrollToIndex({ index });
    actions.clearScrollRequest();
  }, [scrollToDate]);

  const visibleHashtags = useMemo(() => {
    let X = immutableSet<string>([]);
    if (disableFilters) {
      return X;
    }
    for (const date of sortedDates) {
      const message = messages.get(date);
      const value = newest_content(message);
      for (const x of parse_hashtags(value)) {
        const tag = value.slice(x[0] + 1, x[1]).toLowerCase();
        X = X.add(tag);
      }
    }
    return X;
  }, [messages, sortedDates]);

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const manualScrollRef = useRef<boolean>(false);

  useEffect(() => {
    if (scrollToBottomRef == null) return;
    scrollToBottomRef.current = (force?: boolean) => {
      if (manualScrollRef.current && !force) return;
      manualScrollRef.current = false;
      const doScroll = () =>
        virtuosoRef.current?.scrollToIndex({ index: Number.MAX_SAFE_INTEGER });

      doScroll();
      // sometimes scrolling to bottom is requested before last entry added,
      // so we do it again in the next render loop.  This seems needed mainly
      // for side chat when there is little vertical space.
      setTimeout(doScroll, 1);
    };
  }, [scrollToBottomRef != null]);

  return (
    <>
      {visibleHashtags.size > 0 && (
        <HashtagBar
          style={{ margin: "3px 0" }}
          actions={{
            set_hashtag_state: (tag, state) => {
              actions.setHashtagState(tag, state);
            },
          }}
          selected_hashtags={selectedHashtags0}
          hashtags={visibleHashtags}
        />
      )}
      {messages != null && (
        <NotShowing
          num={messages.size - numFolded - sortedDates.length}
          showing={sortedDates.length}
          search={search}
          filterRecentH={filterRecentH}
          actions={actions}
        />
      )}
      <MessageList
        {...{
          virtuosoRef,
          sortedDates,
          messages,
          search,
          account_id,
          user_map,
          project_id,
          path,
          fontSize,
          selectedHashtags,
          actions,
          llm_cost_reply,
          manualScrollRef,
          mode,
          selectedDate,
        }}
      />
      <Composing
        projectId={project_id}
        path={path}
        accountId={account_id}
        userMap={user_map}
      />
    </>
  );
}

function isNextMessageSender(
  index: number,
  dates: string[],
  messages: ChatMessages,
): boolean {
  if (index + 1 === dates.length) {
    return false;
  }
  const currentMessage = messages.get(dates[index]);
  const nextMessage = messages.get(dates[index + 1]);
  return (
    currentMessage != null &&
    nextMessage != null &&
    currentMessage.get("sender_id") === nextMessage.get("sender_id")
  );
}

function isPrevMessageSender(
  index: number,
  dates: string[],
  messages: ChatMessages,
): boolean {
  if (index === 0) {
    return false;
  }
  const currentMessage = messages.get(dates[index]);
  const prevMessage = messages.get(dates[index - 1]);
  return (
    currentMessage != null &&
    prevMessage != null &&
    currentMessage.get("sender_id") === prevMessage.get("sender_id")
  );
}

function isThread(messages: ChatMessages, message: ChatMessageTyped) {
  if (message.get("reply_to") != null) {
    return true;
  }

  // TODO/WARNING!!! This is a linear search
  // through all messages to decide if a message is the root of a thread.
  // This is VERY BAD and must to be redone at some point, since we call isThread
  // on all messages (in getSortedDates), making that algorithm O(n^2),
  // which is hideous as the number of messages scales.  Instead one must
  // use a proper data structure (or even a cache) to track this once
  // and for all.  It's more complicated but everything needs to be at
  // most O(n).
  const s = message.get("date").toISOString();
  return messages.some((m) => m.get("reply_to") === s);
}

function isFolded(
  messages: ChatMessages,
  message: ChatMessageTyped,
  account_id: string,
) {
  if (account_id == null) {
    return false;
  }
  const rootMsg = getRootMessage({ message: message.toJS(), messages });
  return rootMsg?.get("folding")?.includes(account_id) ?? false;
}

// messages is an immutablejs map from
//   - timestamps (ms since epoch as string)
// to
//   - message objects {date: , event:, history, sender_id, reply_to}
//
// It was very easy to sort these before reply_to, which complicates things.
export function getSortedDates(
  messages: ChatMessages,
  search: string | undefined,
  account_id: string,
  filterRecentH?: number,
): { dates: string[]; numFolded: number } {
  let numFolded = 0;
  let m = messages;
  if (m == null) {
    return { dates: [], numFolded: 0 };
  }

  m = filterMessages({ messages: m, filter: search, filterRecentH });

  const v: [date: number, reply_to: number | undefined][] = [];
  for (const [date, message] of m) {
    if (message == null) continue;

    // If we search for a message, we treat all threads as unfolded
    if (!search) {
      const is_thread = isThread(messages, message);
      const is_folded = isFolded(messages, message, account_id);
      const is_thread_body = message.get("reply_to") != null;
      const folded = is_thread && is_folded && is_thread_body;
      if (folded) {
        numFolded++;
        continue;
      }
    }

    const reply_to = message.get("reply_to");
    v.push([
      typeof date === "string" ? parseInt(date) : date,
      reply_to != null ? new Date(reply_to).valueOf() : undefined,
    ]);
  }
  v.sort(cmpMessages);
  const dates = v.map((z) => `${z[0]}`);
  return { dates, numFolded };
}

/*
Compare messages as follows:
 - if message has a parent it is a reply, so we use the parent instead for the
   compare
 - except in special cases:
    - one of them is the parent and other is a child of that parent
    - both have same parent
*/
function cmpMessages([a_time, a_parent], [b_time, b_parent]): number {
  // special case:
  // same parent:
  if (a_parent !== undefined && a_parent == b_parent) {
    return cmp(a_time, b_time);
  }
  // one of them is the parent and other is a child of that parent
  if (a_parent == b_time) {
    // b is the parent of a, so b is first.
    return 1;
  }
  if (b_parent == a_time) {
    // a is the parent of b, so a is first.
    return -1;
  }
  // general case.
  return cmp(a_parent ?? a_time, b_parent ?? b_time);
}

export function getUserName(userMap, accountId: string): string {
  if (isChatBot(accountId)) {
    return chatBotName(accountId);
  }
  if (userMap == null) return "Unknown";
  const account = userMap.get(accountId);
  if (account == null) return "Unknown";
  return account.get("first_name", "") + " " + account.get("last_name", "");
}

interface NotShowingProps {
  num: number;
  search: string;
  filterRecentH: number;
  actions;
  showing;
}

function NotShowing({
  num,
  search,
  filterRecentH,
  actions,
  showing,
}: NotShowingProps) {
  if (num <= 0) return null;

  const timespan =
    filterRecentH > 0 ? hoursToTimeIntervalHuman(filterRecentH) : null;

  return (
    <Alert
      style={{ margin: "5px" }}
      showIcon
      type="warning"
      message={
        <div style={{ display: "flex", alignItems: "center" }}>
          <b style={{ flex: 1 }}>
            WARNING: Hiding {num} {plural(num, "message")} in threads
            {search.trim()
              ? ` that ${
                  num != 1 ? "do" : "does"
                } not match search for '${search.trim()}'`
              : ""}
            {timespan
              ? ` ${
                  search.trim() ? "and" : "that"
                } were not sent in the past ${timespan}`
              : ""}
            . Showing {showing} {plural(showing, "message")}.
          </b>
          <Button
            onClick={() => {
              actions.clearAllFilters();
            }}
          >
            <Icon name="close-circle-filled" style={{ color: "#888" }} /> Clear
          </Button>
        </div>
      }
    />
  );
}

export function MessageList({
  messages,
  account_id,
  virtuosoRef,
  sortedDates,
  user_map,
  project_id,
  path,
  fontSize,
  selectedHashtags,
  actions,
  llm_cost_reply,
  manualScrollRef,
  mode,
  selectedDate,
}: {
  messages;
  account_id;
  user_map;
  mode;
  sortedDates;
  virtuosoRef?;
  search?;
  project_id?;
  path?;
  fontSize?;
  selectedHashtags?;
  actions?;
  llm_cost_reply?;
  manualScrollRef?;
  selectedDate?: string;
}) {
  const virtuosoHeightsRef = useRef<{ [index: number]: number }>({});
  const virtuosoScroll = useVirtuosoScrollHook({
    cacheId: `${project_id}${path}`,
    initialState: { index: messages.size - 1, offset: 0 }, // starts scrolled to the newest message.
  });

  return (
    <Virtuoso
      ref={virtuosoRef}
      totalCount={sortedDates.length}
      itemSize={(el) => {
        // see comment in jupyter/cell-list.tsx
        const h = el.getBoundingClientRect().height;
        const data = el.getAttribute("data-item-index");
        if (data != null) {
          const index = parseInt(data);
          virtuosoHeightsRef.current[index] = h;
        }
        return h;
      }}
      itemContent={(index) => {
        const date = sortedDates[index];
        const message: ChatMessageTyped | undefined = messages.get(date);
        if (message == null) {
          // shouldn't happen.  But we should be robust to such a possibility.
          return <div style={{ height: "1px" }} />;
        }

        const is_thread = isThread(messages, message);
        const is_folded = isFolded(messages, message, account_id);
        const is_thread_body = message.get("reply_to") != null;
        const h = virtuosoHeightsRef.current[index];

        return (
          <div
            style={{
              overflow: "hidden",
              paddingTop: index == 0 ? "20px" : undefined,
            }}
          >
            <DivTempHeight height={h ? `${h}px` : undefined}>
              <Message
                messages={messages}
                key={date}
                index={index}
                account_id={account_id}
                user_map={user_map}
                message={message}
                selected={date == selectedDate}
                project_id={project_id}
                path={path}
                font_size={fontSize}
                selectedHashtags={selectedHashtags}
                actions={actions}
                is_thread={is_thread}
                is_folded={is_folded}
                is_thread_body={is_thread_body}
                is_prev_sender={isPrevMessageSender(
                  index,
                  sortedDates,
                  messages,
                )}
                is_next_sender={isNextMessageSender(
                  index,
                  sortedDates,
                  messages,
                )}
                show_avatar={!isNextMessageSender(index, sortedDates, messages)}
                mode={mode}
                get_user_name={(account_id: string | undefined) =>
                  // ATTN: this also works for LLM chat bot IDs, not just account UUIDs
                  typeof account_id === "string"
                    ? getUserName(user_map, account_id)
                    : "Unknown name"
                }
                scroll_into_view={
                  virtuosoRef
                    ? () => virtuosoRef.current?.scrollIntoView({ index })
                    : undefined
                }
                allowReply={
                  messages.getIn([sortedDates[index + 1], "reply_to"]) == null
                }
                llm_cost_reply={llm_cost_reply}
              />
            </DivTempHeight>
          </div>
        );
      }}
      rangeChanged={
        manualScrollRef
          ? ({ endIndex }) => {
              // manually scrolling if NOT at the bottom.
              manualScrollRef.current = endIndex < sortedDates.length - 1;
            }
          : undefined
      }
      {...virtuosoScroll}
    />
  );
}
