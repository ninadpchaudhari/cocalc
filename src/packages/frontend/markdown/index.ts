/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

/*
Conversion from Markdown *to* HTML, trying not to horribly mangle math.

We also define and configure our Markdown parsers below, which are used
in other code directly, e.g, in supporting use of the slate editor.
```
*/

export * from "./types";
export * from "./table-of-contents";

import * as cheerio from "cheerio";
import MarkdownIt from "markdown-it";
import emojiPlugin from "markdown-it-emoji";
import { checkboxPlugin } from "./checkbox-plugin";
import { hashtagPlugin } from "./hashtag-plugin";
import { mentionPlugin } from "./mentions-plugin";
import mathPlugin from "./math-plugin";
export { parseHeader } from "./header";
import Markdown from "./component";
export { Markdown };

const MarkdownItFrontMatter = require("markdown-it-front-matter");

export const OPTIONS: MarkdownIt.Options = {
  html: true,
  typographer: false,
  linkify: true,
  breaks: false, // breaks=true is NOT liked by many devs.
};

const PLUGINS = [
  [
    mathPlugin,
    {
      delimiters: "cocalc",
      engine: {
        renderToString: (tex, options) => {
          // We **used to** need to continue to support rendering to MathJax as an option,
          // but texmath only supports katex.  Thus we output by default to
          // html using script tags, which are then parsed later using our
          // katex/mathjax plugin.
          // We no longer support MathJax, so maybe this can be simplified?
          return `<script type="math/tex${
            options.displayMode ? "; mode=display" : ""
          }">${tex}</script>`;
        },
      },
    },
  ],
  [emojiPlugin],
  [checkboxPlugin],
  [hashtagPlugin],
  [mentionPlugin],
];

function usePlugins(m, plugins) {
  for (const [plugin, options] of plugins) {
    m.use(plugin, options);
  }
}

export const markdown_it = new MarkdownIt(OPTIONS);
usePlugins(markdown_it, PLUGINS);

/*
export function markdownParser() {
  const m = new MarkdownIt(OPTIONS);
  usePlugins(m, PLUGINS);
  return m;
}*/

/*
Inject line numbers for sync.
 - We track only headings and paragraphs, at any level.
 - TODO Footnotes content causes jumps. Level limit filters it automatically.

See https://github.com/digitalmoksha/markdown-it-inject-linenumbers/blob/master/index.js
*/
function inject_linenumbers_plugin(md) {
  function injectLineNumbers(tokens, idx, options, env, slf) {
    if (tokens[idx].map) {
      const line = tokens[idx].map[0];
      tokens[idx].attrJoin("class", "source-line");
      tokens[idx].attrSet("data-source-line", String(line));
    }
    return slf.renderToken(tokens, idx, options, env, slf);
  }

  md.renderer.rules.paragraph_open = injectLineNumbers;
  md.renderer.rules.heading_open = injectLineNumbers;
  md.renderer.rules.list_item_open = injectLineNumbers;
  md.renderer.rules.table_open = injectLineNumbers;
}
const markdown_it_line_numbers = new MarkdownIt(OPTIONS);
markdown_it_line_numbers.use(inject_linenumbers_plugin);
usePlugins(markdown_it_line_numbers, PLUGINS);

/*
Turn the given markdown *string* into an HTML *string*.
We heuristically try to remove and put back the math via
remove_math, so that markdown itself doesn't
mangle it too much before Mathjax/Katex finally see it.
Note that remove_math is NOT perfect, e.g., it messes up

<a href="http://abc" class="foo-$">test $</a>

However, at least it is based on code in Jupyter classical,
so agrees with them, so people are used it it as a "standard".

See https://github.com/sagemathinc/cocalc/issues/2863
for another example where remove_math is annoying.
*/

export interface MD2html {
  html: string;
  frontmatter: string;
}

interface Options {
  line_numbers?: boolean; // if given, embed extra line number info useful for inverse/forward search.
  processMath?: (string) => string; // if given, apply this function to all the math
}

function process(
  markdown_string: string,
  mode: "default" | "frontmatter",
  options?: Options,
): MD2html {
  let text = markdown_string;
  if (typeof text != "string") {
    console.warn(
      "WARNING: called markdown process with non-string input",
      text,
    );
    // this function can get used for rendering markdown errors, and it's better
    // to show something then blow up in our face.
    text = JSON.stringify(text);
  }

  let html: string;
  let frontmatter = "";

  // avoid instantiating a new markdown object for normal md processing
  if (mode == "frontmatter") {
    const md_frontmatter = new MarkdownIt(OPTIONS).use(
      MarkdownItFrontMatter,
      (fm) => {
        frontmatter = fm;
      },
    );
    html = md_frontmatter.render(text);
  } else {
    if (options?.line_numbers) {
      html = markdown_it_line_numbers.render(text);
    } else {
      html = markdown_it.render(text);
    }
  }
  return { html, frontmatter };
}

export function markdown_to_html_frontmatter(s: string): MD2html {
  return process(s, "frontmatter");
}

export function markdown_to_html(s: string, options?: Options): string {
  return process(s, "default", options).html;
}

export function markdown_to_cheerio(s: string, options?: Options) {
  return cheerio.load(`<div>${markdown_to_html(s, options)}</div>`);
}
