/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

import { delay } from "awaiting";
import { isEqual } from "lodash";

import { redux } from "@cocalc/frontend/app-framework";
import { commands } from "@cocalc/frontend/editors/editor-button-bar";
import { getLocale } from "@cocalc/frontend/i18n";
import { is_array, startswith } from "@cocalc/util/misc";
import {
  BaseRange,
  Editor,
  Element,
  Location,
  Node,
  Point,
  Range,
  Text,
  Transforms,
} from "slate";
import { getMarks } from "../edit-bar/marks";
import { SlateEditor } from "../editable-markdown";
import { markdown_to_slate } from "../markdown-to-slate";
import { emptyParagraph } from "../padding";
import { ReactEditor } from "../slate-react";
import { removeBlankLines } from "../util";
import { insertAIFormula } from "./insert-ai-formula";
import { insertImage } from "./insert-image";
import { insertLink } from "./insert-link";
import { insertSpecialChar } from "./insert-special-char";

// currentWord:
//
// Expand collapsed selection to range containing exactly the
// current word, even if selection potentially spans multiple
// text nodes.  If cursor is not *inside* a word (being on edge
// is not inside) then returns undefined.  Otherwise, returns
// the Range containing the current word.
//
// NOTE: I posted this on the slate Github and there's a discussion
// with various varients based on this:
//    https://github.com/ianstormtaylor/slate/issues/4162
function currentWord(editor: SlateEditor): Range | undefined {
  const selection = getSelection(editor);
  if (selection == null || !Range.isCollapsed(selection)) {
    return; // nothing to do -- no current word.
  }
  const { focus } = selection;
  const [node, path] = Editor.node(editor, focus);
  if (!Text.isText(node)) {
    // focus must be in a text node.
    return;
  }
  const { offset } = focus;
  const siblings: any[] = Node.parent(editor, path).children as any;

  // We move to the left from the cursor until leaving the current
  // word and to the right as well in order to find the
  // start and end of the current word.
  let start = { i: path[path.length - 1], offset };
  let end = { i: path[path.length - 1], offset };
  if (offset == siblings[start.i]?.text?.length) {
    // special case when starting at the right hand edge of text node.
    moveRight(start);
    moveRight(end);
  }
  const start0 = { ...start };
  const end0 = { ...end };

  function len(node): number {
    // being careful that there could be some non-text nodes in there, which
    // we just treat as length 0.
    return node?.text?.length ?? 0;
  }

  function charAt(pos: { i: number; offset: number }): string {
    const c = siblings[pos.i]?.text?.[pos.offset] ?? "";
    return c;
  }

  function moveLeft(pos: { i: number; offset: number }): boolean {
    if (pos.offset == 0) {
      if ((pos.i = 0)) return false;
      pos.i -= 1;
      pos.offset = Math.max(0, len(siblings[pos.i]) - 1);
      return true;
    } else {
      pos.offset -= 1;
      return true;
    }
    return false;
  }

  function moveRight(pos: { i: number; offset: number }): boolean {
    if (pos.offset + 1 < len(siblings[pos.i])) {
      pos.offset += 1;
      return true;
    } else {
      if (pos.i + 1 < siblings.length) {
        pos.offset = 0;
        pos.i += 1;
        return true;
      } else {
        if (pos.offset < len(siblings[pos.i])) {
          pos.offset += 1; // end of the last block.
          return true;
        }
      }
    }
    return false;
  }

  while (charAt(start).match(/\w/) && moveLeft(start)) {}
  // move right 1.
  moveRight(start);
  while (charAt(end).match(/\w/) && moveRight(end)) {}
  if (isEqual(start, start0) || isEqual(end, end0)) {
    // if at least one endpoint doesn't change, cursor was not inside a word,
    // so we do not select.
    return;
  }

  const path0 = path.slice(0, path.length - 1);
  return {
    anchor: { path: path0.concat([start.i]), offset: start.offset },
    focus: { path: path0.concat([end.i]), offset: end.offset },
  };
}

function isMarkActive(editor: Editor, mark: string): boolean {
  try {
    return !!Editor.marks(editor)?.[mark];
  } catch (err) {
    // see comment in getMarks...
    console.warn("Editor.marks", err);
    return false;
  }
}

function toggleMark(editor: Editor, mark: string): void {
  if (isMarkActive(editor, mark)) {
    Editor.removeMark(editor, mark);
  } else {
    Editor.addMark(editor, mark, true);
  }
}

export function formatSelectedText(editor: SlateEditor, mark: string) {
  const selection = getSelection(editor);
  if (selection == null) return; // nothing to do.
  if (Range.isCollapsed(selection)) {
    // select current word (which may partly span multiple text nodes!)
    const at = currentWord(editor);
    if (at != null) {
      // editor.saveValue(true); // TODO: make snapshot so can undo to before format
      Transforms.setNodes(
        editor,
        { [mark]: !isAlreadyMarked(editor, mark) ? true : undefined },
        { at, split: true, match: (node) => Text.isText(node) },
      );
      return;
    }
    // No current word.
    // Set thing so if you start typing it has the given
    // mark (or doesn't).
    toggleMark(editor, mark);
    return;
  }

  // This formats exactly the current selection or node, even if
  // selection spans many nodes, etc.
  Transforms.setNodes(
    editor,
    { [mark]: !isAlreadyMarked(editor, mark) ? true : undefined },
    { at: selection, match: (node) => Text.isText(node), split: true },
  );
}

function unformatSelectedText(
  editor: SlateEditor,
  options: { prefix?: string },
): void {
  let at: BaseRange | undefined = getSelection(editor);
  if (at == null) return; // nothing to do.
  if (Range.isCollapsed(at)) {
    at = currentWord(editor);
  }
  if (at == null) return;
  if (options.prefix) {
    // Remove all formatting of the selected text
    // that begins with the given prefix.
    let i = 0;
    while (i < 100) {
      i += 1; // paranoid: just in case there is a stupid infinite loop...
      const mark = findMarkWithPrefix(editor, options.prefix);
      if (!mark) break;
      Transforms.setNodes(
        editor,
        { [mark]: false },
        { at, match: (node) => Text.isText(node), split: true },
      );
    }
  }
}

// returns true if current selection *starts* with mark.
function isAlreadyMarked(editor: Editor, mark: string): boolean {
  if (!editor.selection) return false;
  return isFragmentAlreadyMarked(
    Editor.fragment(editor, editor.selection),
    mark,
  );
}

// returns true if fragment *starts* with mark.
function isFragmentAlreadyMarked(fragment, mark: string): boolean {
  if (is_array(fragment)) {
    fragment = fragment[0];
    if (fragment == null) return false;
  }
  if (Text.isText(fragment) && fragment[mark]) return true;
  if (fragment.children) {
    return isFragmentAlreadyMarked(fragment.children, mark);
  }
  return false;
}

// returns mark if current selection *starts* with a mark with the given prefix.
function findMarkWithPrefix(
  editor: Editor,
  prefix: string,
): string | undefined {
  if (!editor.selection) return;
  return findMarkedFragmentWithPrefix(
    Editor.fragment(editor, editor.selection),
    prefix,
  );
}

// returns mark if fragment *starts* with a mark that starts with prefix
function findMarkedFragmentWithPrefix(
  fragment,
  prefix: string,
): string | undefined {
  if (is_array(fragment)) {
    fragment = fragment[0];
    if (fragment == null) return;
  }
  if (Text.isText(fragment)) {
    for (const mark in fragment) {
      if (startswith(mark, prefix) && fragment[mark]) {
        return mark;
      }
    }
  }
  if (fragment.children) {
    return findMarkedFragmentWithPrefix(fragment.children, prefix);
  }
  return;
}

// TODO: make this part of a focus/last selection plugin.
// Is definitely a valid focus point, in that Editor.node will
// work on it.
export function getFocus(editor: SlateEditor): Point {
  const focus = editor.selection?.focus ?? editor.lastSelection?.focus;
  if (focus == null) {
    return { path: [0, 0], offset: 0 };
  }
  try {
    Editor.node(editor, focus);
  } catch (_err) {
    return { path: [0, 0], offset: 0 };
  }
  return focus;
}

// Return a definitely valid selection which is most likely
// to be the current selection (or what it would be, say if
// user recently blurred).  Valid means that Editor.node will
// work on both ends.
export function getSelection(editor: SlateEditor): Range {
  const selection = editor.selection ?? editor.lastSelection;
  if (selection == null) {
    return {
      focus: { path: [0, 0], offset: 0 },
      anchor: { path: [0, 0], offset: 0 },
    };
  }
  try {
    Editor.node(editor, selection.focus);
    if (!Range.isCollapsed(selection)) {
      Editor.node(editor, selection.anchor);
    }
  } catch (_err) {
    return {
      focus: { path: [0, 0], offset: 0 },
      anchor: { path: [0, 0], offset: 0 },
    };
  }
  return selection;
}

// get range that's the selection collapsed to the focus point.
export function getCollapsedSelection(editor: SlateEditor): Range {
  const focus = getSelection(editor)?.focus;
  return { focus, anchor: focus };
}

export function setSelectionAndFocus(editor: ReactEditor, selection): void {
  ReactEditor.focus(editor);
  Transforms.setSelection(editor, selection);
}

export function restoreSelectionAndFocus(editor: SlateEditor): void {
  const { selection, lastSelection } = editor;
  if (selection != null) return;
  if (lastSelection == null) return;
  setSelectionAndFocus(editor, lastSelection);
}

export async function formatAction(
  editor: SlateEditor,
  cmd: string,
  args,
  project_id?: string,
) {
  const isFocused = ReactEditor.isFocused(editor);
  const { selection, lastSelection } = editor;
  try {
    if (
      cmd === "bold" ||
      cmd === "italic" ||
      cmd === "underline" ||
      cmd === "strikethrough" ||
      cmd === "code" ||
      cmd === "sup" ||
      cmd === "sub"
    ) {
      formatSelectedText(editor, cmd);
      return;
    }

    if (cmd === "color") {
      // args = #aa00bc (the hex color)
      unformatSelectedText(editor, { prefix: "color:" });
      if (args) {
        formatSelectedText(editor, `color:${args.toLowerCase()}`);
      } else {
        for (const mark in getMarks(editor)) {
          if (mark.startsWith("color:")) {
            Editor.removeMark(editor, mark);
          }
        }
      }
      return;
    }

    if (cmd === "font_family") {
      unformatSelectedText(editor, { prefix: "font-family:" });
      formatSelectedText(editor, `font-family:${args}`);
      return;
    }

    if (startswith(cmd, "font_size")) {
      unformatSelectedText(editor, { prefix: "font-size:" });
      formatSelectedText(editor, `font-size:${args}`);
      return;
    }

    if (cmd === "equation") {
      transformToEquation(editor, false);
      return;
    }

    if (cmd === "comment") {
      transformToComment(editor);
      return;
    }

    if (cmd === "display_equation") {
      transformToEquation(editor, true);
      return;
    }

    if (cmd === "quote") {
      formatQuote(editor);
      return;
    }

    if (
      cmd === "insertunorderedlist" ||
      cmd === "insertorderedlist" ||
      cmd === "table" ||
      cmd === "horizontalRule" ||
      cmd === "linebreak"
    ) {
      insertSnippet(editor, cmd);
      return;
    }

    if (cmd === "link") {
      insertLink(editor);
      return;
    }

    if (cmd === "image") {
      insertImage(editor);
      return;
    }

    if (cmd === "SpecialChar") {
      insertSpecialChar(editor);
      return;
    }

    if (cmd === "format_code") {
      insertMarkdown(
        editor,
        "\n```\n" + selectionToText(editor).trim() + "\n```\n",
      );
      return;
    }

    if (cmd === "ai_formula") {
      if (project_id == null) throw new Error("ai_formula requires project_id");
      const account_store = redux.getStore("account")
      const locale = getLocale(account_store.get("other_settings"))
      const formula = await insertAIFormula(project_id, locale);
      const value = removeDollars(removeBlankLines(formula.trim()));
      const node: Node = {
        type: "math_inline",
        value,
        isVoid: true,
        isInline: true,
        children: [{ text: "" }],
      };
      Transforms.insertFragment(editor, [node]);
      return;
    }

    if (startswith(cmd, "format_heading_")) {
      // single digit is fine, since headings only go up to level 6.
      const level = parseInt(cmd[cmd.length - 1]);
      formatHeading(editor, level);
      return;
    }
  } finally {
    if (!isFocused) {
      ReactEditor.focus(editor);
      setSelectionAndFocus(editor, selection ?? lastSelection);
      await delay(1);
      ReactEditor.focus(editor);
      setSelectionAndFocus(editor, selection ?? lastSelection);
    }
  }

  console.warn("WARNING -- slate.format_action not implemented", {
    cmd,
    args,
    editor,
  });
}

function insertSnippet(editor: ReactEditor, name: string): boolean {
  let markdown = commands.md[name]?.wrap?.left;
  if (name == "insertunorderedlist") {
    // better for a wysiwyg editor...
    markdown = "-";
  } else if (name == "insertorderedlist") {
    markdown = "1.";
  } else if (name == "linebreak") {
    markdown = "<br/>";
  }
  if (markdown == null) return false;
  insertMarkdown(editor, markdown.trim());
  return true;
}

function insertMarkdown(editor: ReactEditor, markdown: string) {
  const doc = markdown_to_slate(markdown, true);
  Transforms.insertNodes(editor, [...doc, emptyParagraph()]);
}

function transformToEquation(editor: Editor, display: boolean): void {
  let value = selectionToText(editor).trim();
  if (!value) {
    value = "x^2"; // placeholder math
  } else {
    // eliminate blank lines which break math apart
    value = removeBlankLines(value);
  }
  let node: Node;
  if (display) {
    node = {
      type: "math_block",
      value,
      isVoid: true,
      children: [{ text: "" }],
    };
  } else {
    node = {
      type: "math_inline",
      value,
      isVoid: true,
      isInline: true,
      children: [{ text: "" }],
    };
  }
  Transforms.insertFragment(editor, [node]);
}

function transformToComment(editor: Editor): void {
  const html = "<!--" + selectionToText(editor).trim() + "-->\n\n";
  const fragment: Node[] = [
    {
      type: "html_block",
      html,
      isVoid: true,
      isInline: false,
      children: [{ text: "" }],
    },
  ];
  Transforms.insertFragment(editor, fragment);
}

// TODO: This is very buggy and can't work in general, e.g., because
// of virtualization.  we use it here usually for small snippets of
// visible text, so it tends to be OK. Just temper your expectations!
export function selectionToText(editor: Editor): string {
  if (!editor.selection) {
    // no selection so nothing to do.
    return "";
  }
  // This is just directly using DOM API, not slatejs, so
  // could run into a subtle problem e.g., due to windowing.
  // However, that's very unlikely given our application.
  return window.getSelection()?.toString() ?? "";
}

// Setting heading at a given point to a certain level.
// level = 0 -- not a heading
// levels = 1 to 6 -- normal headings.
// The code below is complicated, because there are numerous subtle
// cases that can arise and we have to both create and remove
// being a heading.
export function formatHeading(editor, level: number): void {
  const at = getCollapsedSelection(editor);
  const options = {
    match: (node) => Element.isElement(node) && Editor.isBlock(editor, node),
    mode: "highest" as "highest",
    at,
  };
  const fragment = Editor.fragment(editor, at);
  const type = fragment[0]?.["type"];
  if (type != "heading" && type != "paragraph") {
    // Markdown doesn't let most things be in headers.
    // Technically markdown allows for headers as entries in other
    // things like lists, but we're not supporting this here, since
    // that just seems really annoying.
    return;
  }
  try {
    if (type == "heading") {
      // mutate the type to what's request
      if (level == 0) {
        if (Editor.isBlock(editor, fragment[0]["children"]?.[0])) {
          // descendant of heading is a block, so we can just unwrap,
          // which we *can't* do if it were an inline node (e.g., text).
          Transforms.unwrapNodes(editor, {
            match: (node) => node["type"] == "heading",
            mode: "highest",
            at,
          });
          return;
        }
        // change header to paragraph
        Transforms.setNodes(
          editor,
          { type: "paragraph", level: undefined } as Partial<Element>,
          options,
        );
      } else {
        // change header level
        Transforms.setNodes(editor, { level } as Partial<Element>, options);
      }
      return;
    }
    if (level == 0) return; // paragraph mode -- no heading.
    Transforms.setNodes(
      editor,
      { type: "heading", level } as Partial<Element>,
      options,
    );
  } finally {
    setSelectionAndFocus(editor, at);
  }
}

function matchingNodes(editor, options): Element[] {
  const v: Element[] = [];
  for (const x of Editor.nodes(editor, options)) {
    const elt = x[0];
    if (Element.isElement(elt)) {
      // **this specifically excludes including the entire editor
      // as a matching node**
      v.push(elt);
    }
  }
  return v;
}

function containingBlocks(editor: Editor, at: Location): Element[] {
  return matchingNodes(editor, {
    at,
    mode: "lowest",
    match: (node) => Element.isElement(node) && Editor.isBlock(editor, node),
  });
}

function isExactlyInBlocksOfType(
  editor: Editor,
  at: Location,
  type: string,
): boolean {
  // Get the blocks of the given type containing at:
  const blocksOfType = matchingNodes(editor, {
    at,
    mode: "lowest",
    match: (node) => node["type"] == type,
  });
  if (blocksOfType.length == 0) {
    return false;
  }
  // The content in at *might* be exactly contained
  // in blocks of the given type.  To decide, first
  // get the blocks containing at:
  let blocks: Element[] = containingBlocks(editor, at);

  // This is complicated, of course mainly due
  // to multiple blocks.
  for (const blockOfType of blocksOfType) {
    const { children } = blockOfType;
    if (!isEqual(children, blocks.slice(0, children.length))) {
      return false;
    } else {
      blocks = blocks.slice(children.length);
    }
  }
  return true;
}

// Toggle whether or not the selection is quoted.
function formatQuote(editor): void {
  const at = getSelection(editor);

  // The selected text *might* be exactly contained
  // in a blockquote (or multiple of them).  If so, we remove it.
  // If not we wrap everything in a new block quote.
  if (isExactlyInBlocksOfType(editor, at, "blockquote")) {
    // Unquote the selected text (just removes ones level of quoting).
    Transforms.unwrapNodes(editor, {
      match: (node) => node["type"] == "blockquote",
      mode: "lowest",
      at,
    });
  } else {
    // Quote the blocks containing the selection.
    Transforms.wrapNodes(editor, { type: "blockquote" } as Element, {
      at,
      match: (node) => Element.isElement(node) && Editor.isBlock(editor, node),
      mode: "lowest",
    });
  }
}

// Get rid of starting and ending $..$ or $$..$$ dollar signs
function removeDollars(formula: string): string {
  if (formula.startsWith("$") && formula.endsWith("$")) {
    return formula.substring(1, formula.length - 1);
  }

  if (formula.startsWith("$$") && formula.endsWith("$$")) {
    return formula.substring(2, formula.length - 2);
  }

  return formula;
}
