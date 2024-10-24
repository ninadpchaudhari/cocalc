/*
 *  This file is part of CoCalc: Copyright © 2024 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

const console = `
<div id="webapp-console-templates" class="hide">
    <div class="webapp-console smc-vfill webapp-console-blur">

        <!-- The bar across the top -->
        <!-- increase font, decrease font, refresh, paste spot, then title ... font indicator-->
        <div class="webapp-console-topbar">
            <div class="smc-users-viewing-document webapp-editor-chat-title">
            <!--to be filled with react component for users viewing the document-->
            </div>

            &nbsp;&nbsp;

            <div class="pull-left">
                <span class="btn-group visible-xs">
                    <a href="#decrease-font" class="btn btn-default"><i class="fa fa-font" style="font-size:8pt"> </i> </a>
                    <a href="#increase-font" class="btn btn-default"><i class="fa fa-font" style="font-size:13pt"> </i></a>
                    <a href="#refresh" class='btn btn-default'><i class="fa fa-repeat" style="font-size:14pt"> </i></a>
                </span>

                <span class="hidden-xs">
                    <span class="btn-group">
                        <a href="#decrease-font" class="btn btn-default btn-sm" data-toggle="tooltip" data-placement="right" title="Smaller"><i class="fa fa-font" style="font-size:7pt"> </i> </a>
                        <a href="#increase-font" class="btn btn-default btn-sm" data-toggle="tooltip" data-placement="right" title="Bigger"><i class="fa fa-font" style="font-size:10pt"> </i> </a>
                        <a href="#refresh" class="btn btn-default btn-sm" data-toggle="tooltip" data-placement="right" title="Reconnect"><i class="fa fa-repeat"> </i> </a>
                       <a href="#pause" class="btn btn-default btn-sm" data-toggle="tooltip" data-placement="right" title="Pause"><i class="fa fa-pause"> </i> </a>
                       <a href="#paste" class="btn btn-default btn-sm"  data-toggle="tooltip" data-placement="right" title="History"><i class="fa fa-paste"> </i> </a>
                        <a href="#initfile" class="btn btn-default btn-sm"  data-toggle="tooltip" data-placement="right" title="Init file"><i class="fa fa-rocket"> </i> </a>
                        <a href="#boot" class="btn btn-default btn-sm"  data-toggle="tooltip" data-placement="right" title="Boot others"><i class="fa fa-sign-out-alt"> </i> </a>

                    </span>
                    &nbsp;&nbsp;
                    <span>
                        <span class="webapp-console-font-indicator hide"><i class="fa fa-font"> </i>
                            <span class="webapp-console-font-indicator-size"></span>pt
                            <a class="btn btn-success btn-sm" href="#font-make-default">make default</a>
                        </span>
                    </span>
                </span>
            </div>

            <div class="webapp-console-title pull-left"></div>
            &nbsp;&nbsp;
            <div class="pull-right webapp-burst-indicator hide" style="background: red;color: white; padding: 5px 15px;
    font-weight: bold;">
                WARNING: Large burst of output! (May try to interrupt.)
            </div>

            <div class="webapp-console-mobile-input">

                <input class="webapp-console-input-line form-control" type="text" style="width:98%" placeholder="Type input or paste here...">
                <span class="btn-group">
                    <a class="btn webapp-console-submit-esc btn-default">esc</a>
                    <a class="btn webapp-console-submit-line btn-default">return</a>
                    <a class="btn webapp-console-submit-submit btn-default">submit</a>
                    <a class="btn webapp-console-submit-ctrl-b btn-default">ctrl-b</a>
                    <a class="btn webapp-console-submit-ctrl-c btn-default">ctrl-c</a>
                    <a class="btn webapp-console-submit-tab btn-default">tab</a>
                    <a class="btn webapp-console-submit-up btn-default"><i class="fa fa-arrow-up"></i></a>
                    <a class="btn webapp-console-submit-down btn-default"><i class="fa fa-arrow-down"></i></a>
                    <a class="btn webapp-console-submit-left btn-default"><i class="fa fa-arrow-left"></i></a>
                    <a class="btn webapp-console-submit-right btn-default"><i class="fa fa-arrow-right"></i></a>
                </span>
            </div>

            <textarea class="webapp-console-textarea"></textarea>
        <!--
            <a class="btn btn-info webapp-console-esc hide">esc</a>
            <a class="btn btn-info webapp-console-tab hide">tab</a>
            <a class="btn btn-info webapp-console-control hide">control</a>
            <a class="btn webapp-console-up"><i class="fa fa-arrow-up"></i></a>
            <a class="btn webapp-console-down"><i class="fa fa-arrow-down"></i></a>
-->
        </div>

        <!-- The actual terminal -->
        <!-- I tried  autocomplete="false" in the textarea, but this is not valid HTML, and I think didn't work anyways.
              Jason Grout suggests: autocapitalize="off" autocorrect="off" autocomplete="off"
        -->
        <div class="smc-vfill" style="position:relative">
            <textarea class="webapp-console-for-mobile hide"></textarea>
            <div style="flex:1; display:flex; overflow:hidden" class="webapp-console-terminal-container">
                <div style="flex:1; position:relative">
                    <div class="smc-vfill webapp-console-terminal"></div>
                </div>
                <div class="webapp-console-scrollbar"></div>
            </div>
        </div>
    </div>
</div>

`;

const editor = `
<div id="webapp-editor-templates" class="hide">
  <!-- Template for the entire editor, both tabs and the actual content -->
  <div class="webapp-editor">
    <div class="row">
      <div class="col-xs-12">
        <!-- The editor content gets displayed here -->
        <div class="webapp-editor-content"></div>
      </div>
    </div>
  </div>

  <!-- Template for the tab at the top of the editor with filename and an x -->
  <ul>
    <!-- ul so is valid html -->
    <li class="super-menu webapp-editor-filename-pill">
      <div class="webapp-editor-close-button-x pull-right lighten">
        <i class="fa fa-times"></i>
      </div>
      <a>
        <span class="webapp-editor-tab-filename"></span>
      </a>
    </li>
  </ul>

  <!-- Template for the codemirror text editor -->
  <div class="webapp-editor-codemirror smc-vfill">
    <textarea class="webapp-editor-textarea-0 hide"></textarea>
    <textarea class="webapp-editor-textarea-1 hide"></textarea>
    <div class="webapp-editor-codemirror-content smc-vfill">
      <div class="webapp-editor-codemirror-button-row">
        <div class="webapp-editor-codemirror-button-container">
          <div
            class="hidden-xs webapp-editor-chat-title webapp-editor-write-only pull-right"
          >
            <div class="smc-users-viewing-document">
              <!--to be filled with react component for users viewing the document-->
            </div>
          </div>

          <div class="smc-editor-file-info-dropdown" style="float: left; margin-top:7px"></div>

          <span class="visible-xs">
            <span class="btn-group">
              <!-- <a href="#close" class="btn btn-default btn-lg"><i class="fa fa-toggle-up"></i> <span>Files...</span></a>-->
              <a href="#save" class="btn btn-success btn-lg"
                ><i class="fa fa-save"></i> Save</a
              >
              <a href="#goto-line" class="btn btn-default btn-lg"
                ><i class="fa fa-bolt"> </i
              ></a>
            </span>

            <span
              class="btn-group webapp-editor-codemirror-worksheet-buttons hide"
            >
              <a href="#execute" class="btn btn-success btn-lg">
                <i class="fa fa-play"></i> Run</a
              >
              <a href="#interrupt" class="btn btn-warning btn-lg">
                <i class="fa fa-stop"></i
              ></a>
              <a href="#kill" class="btn btn-warning btn-lg"
                ><i class="fa fa-refresh"></i
              ></a>
              <a href="#tab" class="btn btn-info btn-lg">
                <i class="fa fa-step-forward"></i
              ></a>
            </span>

            <span class="btn-group">
              <a href="#decrease-font" class="btn btn-default btn-lg"
                ><i class="fa fa-font" style="font-size: 8pt"> </i>
              </a>
              <a href="#increase-font" class="btn btn-default btn-lg"
                ><i class="fa fa-font" style="font-size: 13pt"> </i>
              </a>
            </span>

            <a
              class="btn btn-primary btn-lg hide"
              href="#copy-to-another-project"
              ><i class="fa fa-paper-plane"> </i>
              <span>Copy To Your Project...</span></a
            >
          </span>

          <span class="btn-group webapp-editor-write-only">
            <a
              href="#save"
              class="hidden-xs btn btn-success webapp-editor-save-group"
              data-toggle="tooltip"
              data-placement="bottom"
              title="Save file to disk."
            >
              <i class="fa fa-save primary-icon"></i>
              <i class="fa fa-cocalc-ring hide"></i>
              Save
              <span
                class="smc-uncommitted hide"
                data-toggle="tooltip"
                data-placement="bottom"
                title="DANGER: File NOT sent to server and not saved to disk.  You will lose work if you close this file."
              >
                NOT saved!</span
              >
            </a>
            <a
              href="#history"
              class="hidden-xs btn btn-info webapp-editor-history-button hide"
              data-toggle="tooltip"
              data-placement="bottom"
              title="View the history of this file."
            >
              <i class="fa fa-history"></i>
              <span class="hidden-sm">TimeTravel</span>
            </a>
<!--             <a
              href="#chatgpt"
              style="background:#10a37f;color:white"
              class="hidden-xs btn btn-default hide"
              data-toggle="tooltip"
              data-placement="bottom"
              title="Get assistance from ChatGPT."
            >
              <i class="fa fa-robot"></i>
              <span class="hidden-sm hidden-md">ChatGPT</span>
            </a> -->
          </span>

          <span class="hidden-xs">
            <span class="webapp-editor-codemirror-worksheet-buttons hide">
              <span class="btn-group webapp-editor-write-only">
                <a
                  href="#execute"
                  class="btn btn-default"
                  data-toggle="tooltip"
                  data-placement="bottom"
                  title="Execute current or selected cells (unless input hidden)."
                  ><i class="fa fa-play"></i> &nbsp;Run</a
                >
                <a
                  href="#tab"
                  class="btn btn-default"
                  data-toggle="tooltip"
                  data-placement="bottom"
                  title="Tab completion."
                >
                  <i class="fa fa-step-forward"></i>
                  <span class="hidden-sm hidden-md">Tab</span></a
                >
                <a
                  href="#interrupt"
                  class="btn btn-default"
                  data-toggle="tooltip"
                  data-placement="bottom"
                  title="Stop the running calculation."
                  ><i class="fa fa-stop"></i>
                  <span class="hidden-sm hidden-md">Stop</span></a
                >
                <a
                  href="#kill"
                  class="btn btn-default"
                  data-toggle="tooltip"
                  data-placement="bottom"
                  title="Restart the running Sage process (all variables reset)."
                  ><i class="fa fa-refresh"></i>
                  <span class="hidden-sm hidden-md">Restart</span></a
                >
              </span>
              <span class="btn-group webapp-editor-write-only hidden-sm">
                <a
                  href="#toggle-input"
                  class="btn btn-default"
                  data-toggle="tooltip"
                  data-placement="bottom"
                  title="Toggle display of input of selected cells."
                  ><i class="fa fa-toggle-on"></i>
                  <span class="hidden-sm hidden-md">in</span></a
                >
                <a
                  href="#toggle-output"
                  class="btn btn-default"
                  data-toggle="tooltip"
                  data-placement="bottom"
                  title="Toggle display of output of selected cells."
                  ><i class="fa fa-toggle-on"></i>
                  <span class="hidden-sm hidden-md">out</span></a
                >
                <a
                  href="#delete-output"
                  class="btn btn-default"
                  data-toggle="tooltip"
                  data-placement="bottom"
                  title="Delete output of selected cells (unless input hidden)."
                  ><i class="fa fa-times-circle"></i
                ></a>
              </span>
            </span>
          </span>
          <span class="hidden-xs btn-group editor-btn-group">
            <a
              href="#vim-mode-toggle"
              class="btn btn-default webapp-editor-write-only"
              data-toggle="tooltip"
              data-placement="bottom"
              title="Toggle VIM mode"
              style="width: 4em"
              >esc</a
            >
            <a
              href="#autoindent"
              class="btn btn-default webapp-editor-write-only"
              data-toggle="tooltip"
              data-placement="bottom"
              title="Autoindent selected text"
              ><i class="fa fa-indent"></i
            ></a>
            <a
              href="#undo"
              class="btn btn-default webapp-editor-write-only"
              data-toggle="tooltip"
              data-placement="bottom"
              title="Undo"
              ><i class="fa fa-undo"></i
            ></a>
            <a
              href="#redo"
              class="btn btn-default webapp-editor-write-only"
              data-toggle="tooltip"
              data-placement="bottom"
              title="Redo"
              ><i class="fa fa-repeat"></i
            ></a>
            <a
              href="#search"
              class="btn btn-default btn-history"
              data-toggle="tooltip"
              data-placement="bottom"
              title="Search"
              ><i class="fa fa-search"></i
            ></a>
            <!-- <a href="#prev" class="btn btn-default btn-history" data-toggle="tooltip" data-placement="bottom" title="Previous"><i class="fa fa-chevron-up"></i></a>
                        <a href="#next" class="btn btn-default btn-history" data-toggle="tooltip" data-placement="bottom" title="Next"><i class="fa fa-chevron-down"></i></a>-->
            <a
              href="#replace"
              class="btn btn-default webapp-editor-write-only"
              data-toggle="tooltip"
              data-placement="bottom"
              title="Replace"
              ><i class="fa fa-exchange"></i
            ></a>
            <a
              href="#split-view"
              class="btn btn-default"
              data-toggle="tooltip"
              data-placement="bottom"
              title="Split view of document"
            >
              <i class="fa fa-horizontal-split webapp-editor-layout-0 hide"></i>
              <i class="fa fa-vertical-split webapp-editor-layout-1 hide"></i>
              <i
                class="fa fa-window-maximize webapp-editor-layout-2 hide"
                style="font-size: 12pt"
              ></i>
            </a>
            <a
              href="#decrease-font"
              class="btn btn-default btn-history"
              data-toggle="tooltip"
              data-placement="bottom"
              title="Decrease text size"
              ><i class="fa fa-font" style="font-size: 7pt"> </i>
            </a>
            <a
              href="#increase-font"
              class="btn btn-default btn-history"
              data-toggle="tooltip"
              data-placement="bottom"
              title="Increase text size"
              ><i class="fa fa-font" style="font-size: 11pt"> </i>
            </a>
            <a
              href="#goto-line"
              class="btn btn-default btn-history"
              data-toggle="tooltip"
              data-placement="bottom"
              title="Go to line"
              ><i class="fa fa-bolt"> </i>
            </a>
            <a
              href="#copy"
              class="btn btn-default btn-history webapp-editor-write-only"
              data-toggle="tooltip"
              data-placement="bottom"
              title="Copy"
              ><i class="fa fa-copy"> </i>
            </a>
            <a
              href="#paste"
              class="btn btn-default btn-history webapp-editor-write-only"
              data-toggle="tooltip"
              data-placement="bottom"
              title="Paste"
              ><i class="fa fa-paste"> </i>
            </a>
            <a
              href="#sagews2pdf"
              class="hidden-sm btn btn-default webapp-editor-write-only hide"
              data-toggle="tooltip"
              data-placement="bottom"
              title="Convert to PDF"
              ><i class="fa fa-file-pdf-o"> </i>
            </a>
            <a
              href="#print"
              class="hidden-sm btn btn-default webapp-editor-write-only hide"
              data-toggle="tooltip"
              data-placement="bottom"
              title="Print"
              ><i class="fa fa-print"> </i>
              <i class="fa fa-cocalc-ring hide"></i
            ></a>
            <a
              href="#sagews2ipynb"
              class="hidden-sm btn btn-default webapp-editor-write-only hide"
              data-toggle="tooltip"
              data-placement="bottom"
              title="Convert to ipynb"
              ><i class="fa fa-ipynb"> </i>
              <span class="hidden-sm hidden-md">Jupyter</span></a
            >
          </span>

          <span class="btn-group webapp-editor-read-only hide">
            <a
              href="#readonly"
              class="hidden-xs btn btn-success webapp-editor-save-group disabled"
              data-toggle="tooltip"
              data-placement="bottom"
              title="File is read only."
            >
              <i class="fa fa-save"></i>
              <span class="hidden-sm">Readonly</span>
            </a>
            <a
              href="#history"
              class="hidden-xs btn btn-info webapp-editor-history-button hide"
              data-toggle="tooltip"
              data-placement="bottom"
              title="View the history of this file."
            >
              <i class="fa fa-history"></i>
              <span class="hidden-sm hidden-md">TimeTravel</span>
            </a>
          </span>

          <span class="hidden-xs">
            <a class="btn btn-primary hide" href="#copy-to-another-project"
              ><i class="fa fa-paper-plane"> </i>
              <span>Copy To Your Project...</span></a
            >
            <!--<a class="btn btn-success" href="#download-file"><i class="fa fa-cloud-download"> </i> <span class="hidden-sm">Download</span></a>-->
          </span>

          <span class="webapp-editor-codemirror-loading hide">
            <i class="fa fa-cocalc-ring"></i> load…
          </span>

          <span class="webapp-editor-codemirror-sync">
            <span class="webapp-editor-codemirror-not-synced hide"
              ><i class="fa fa-cocalc-ring"></i> sync…</span
            >
            <span class="webapp-editor-codemirror-synced hide"
              ><i class="fa fa-check"></i
            ></span>
          </span>

          <span class="webapp-editor-codemirror-message"></span>
          <span class="webapp-editor-codemirror-filename pull-right"></span>
        </div>

        <div class="webapp-editor-buttonbars webapp-editor-write-only">
          <div class="webapp-editor-latex-buttonbar hide"></div>
          <div
            class="webapp-editor-codemirror-textedit-buttons hide visible-sm-block visible-md-block visible-lg-block"
          >
            <code
              class="webapp-editor-codeedit-buttonbar-mode pull-right hide"
            ></code>
            <span class="react-target"></span>
            <span
              class="webapp-editor-codeedit-buttonbar-assistant pull-right hide"
            >
              <a
                href="#assistant"
                class="btn btn-default"
                data-toggle="tooltip"
                data-placement="bottom"
                title="Insert examples"
              >
                <i class="fa fa-magic"></i>
                <span class="hidden-sm">Snippets</span>
              </a>
            </span>
          </div>
          <div class="webapp-editor-codemirror-worksheet-editable-buttons hide">
            <span class="btn-group">
              <a
                href="#bold"
                class="btn btn-default"
                data-toggle="tooltip"
                data-placement="top"
                title="Bold"
                ><i class="fa fa-bold"></i
              ></a>
              <a
                href="#italic"
                class="btn btn-default"
                data-toggle="tooltip"
                data-placement="top"
                title="Italic"
                ><i class="fa fa-italic"></i
              ></a>
              <a
                href="#underline"
                class="btn btn-default"
                data-toggle="tooltip"
                data-placement="top"
                title="Underline"
                ><i class="fa fa-underline"></i
              ></a>
              <a
                href="#strikethrough"
                class="btn btn-default"
                data-toggle="tooltip"
                data-placement="top"
                title="Strike through"
                ><i class="fa fa-strikethrough"></i
              ></a>
              <a
                href="#subscript"
                class="btn btn-default"
                data-toggle="tooltip"
                data-placement="top"
                title="Subscript (use LaTeX for serious equations)"
                ><i class="fa fa-subscript"></i
              ></a>
              <a
                href="#superscript"
                class="btn btn-default"
                data-toggle="tooltip"
                data-placement="top"
                title="Superscript"
                ><i class="fa fa-superscript"></i
              ></a>
            </span>
            <span class="btn-group">
              <a
                href="#equation"
                data-args="special"
                class="btn btn-default"
                data-toggle="tooltip"
                data-placement="top"
                title="Inline equation..."
              >
                $
              </a>
              <a
                href="#display_equation"
                data-args="special"
                class="btn btn-default"
                data-toggle="tooltip"
                data-placement="top"
                title="Displayed equation..."
              >
                $$
              </a>
              <a
                href="#insertunorderedlist"
                class="btn btn-default"
                data-toggle="tooltip"
                data-placement="top"
                title="Insert unordered list"
                ><i class="fa fa-list"></i
              ></a>
              <a
                href="#insertorderedlist"
                class="btn btn-default"
                data-toggle="tooltip"
                data-placement="top"
                title="Insert ordered list"
                ><i class="fa fa-list-ol"></i
              ></a>
              <a
                href="#link"
                data-args="special"
                class="btn btn-default"
                data-toggle="tooltip"
                data-placement="top"
                title="Insert link..."
                ><i class="fa fa-link"></i
              ></a>
              <a
                href="#image"
                data-args="special"
                class="btn btn-default"
                data-toggle="tooltip"
                data-placement="top"
                title="Insert image..."
                ><i class="fa fa-image"></i
              ></a>
              <!-- <a href="#insertHorizontalRule" class="btn btn-default">&lt;hr&gt;</a> -->
            </span>
            <span class="btn-group">
              <a
                href="#justifyleft"
                class="btn btn-default"
                data-toggle="tooltip"
                data-placement="top"
                title="Left justify"
                ><i class="fa fa-align-left"></i
              ></a>
              <a
                href="#justifycenter"
                class="btn btn-default"
                data-toggle="tooltip"
                data-placement="top"
                title="Justify center"
                ><i class="fa fa-align-center"></i
              ></a>
              <a
                href="#justifyright"
                class="btn btn-default"
                data-toggle="tooltip"
                data-placement="top"
                title="Right justify"
                ><i class="fa fa-align-right"></i
              ></a>
              <a
                href="#justifyfull"
                class="btn btn-default"
                data-toggle="tooltip"
                data-placement="top"
                title="Justify full"
                ><i class="fa fa-align-justify"></i
              ></a>
              <a
                href="#outdent"
                class="btn btn-default"
                data-toggle="tooltip"
                data-placement="top"
                title="Outdent"
                ><i class="fa fa-outdent"></i
              ></a>
              <a
                href="#indent"
                class="btn btn-default"
                data-toggle="tooltip"
                data-placement="top"
                title="Indent"
                ><i class="fa fa-indent"></i
              ></a>
            </span>
            <span class="btn-group">
              <a
                href="#undo"
                class="btn btn-default"
                data-toggle="tooltip"
                data-placement="top"
                title="Undo"
                ><i class="fa fa-undo"></i
              ></a>
              <a
                href="#redo"
                class="btn btn-default"
                data-toggle="tooltip"
                data-placement="top"
                title="Redo"
                ><i class="fa fa-repeat"></i
              ></a>
            </span>
            <span class="btn-group">
              <span
                class="btn-group sagews-output-editor-font smc-tooltip"
                data-toggle="tooltip"
                data-placement="top"
                title="Fonts"
              >
                <span
                  class="btn btn-default dropdown-toggle"
                  data-toggle="dropdown"
                  title="Font"
                >
                  <i class="fa fa-font"></i> <b class="caret"></b>
                </span>
                <ul class="dropdown-menu"></ul>
              </span>
              <span
                class="btn-group sagews-output-editor-font-size smc-tooltip"
                data-toggle="tooltip"
                data-placement="top"
                title="Font size"
              >
                <span
                  class="btn btn-default dropdown-toggle"
                  data-toggle="dropdown"
                  title="Text height"
                >
                  <i class="fa fa-text-height"></i> <b class="caret"></b>
                </span>
                <ul class="dropdown-menu"></ul>
              </span>
              <span
                class="btn-group sagews-output-editor-block-type smc-tooltip"
                data-toggle="tooltip"
                data-placement="top"
                title="Format type"
              >
                <span
                  class="btn btn-default dropdown-toggle"
                  data-toggle="dropdown"
                  title="Header"
                >
                  <i class="fa fa-header"></i> <b class="caret"></b>
                </span>
                <ul class="dropdown-menu"></ul>
              </span>
            </span>
            <span class="btn-group">
              <!-- not implemented yet -->
              <span
                class="sagews-output-editor-foreground-color-selector input-group color smc-tooltip"
                data-color-format="rgb"
                data-toggle="tooltip"
                data-placement="top"
                title="Text color"
              >
                <input
                  type="text"
                  style="cursor: pointer"
                  class="form-control"
                />
                <span class="input-group-addon" style="padding: 3px"
                  ><i class="fa fa-font" style="height: 16px; width: 16px"></i
                  ><b class="caret"></b
                ></span>
              </span>
            </span>
            <span class="btn-group">
              <!-- not implemented yet -->
              <span
                class="sagews-output-editor-background-color-selector input-group color smc-tooltip"
                data-color-format="rgb"
                data-toggle="tooltip"
                data-placement="top"
                title="Text background highlight color"
              >
                <input
                  type="text"
                  style="cursor: pointer"
                  class="form-control"
                />
                <span class="input-group-addon" style="padding: 3px"
                  ><i class="fa fa-font" style="height: 16px; width: 16px"></i
                  ><b class="caret"></b
                ></span>
              </span>
            </span>
          </div>
        </div>
      </div>

      <div
        class="webapp-editor-codemirror-input-container-layout-0 hide"
        style="flex: 1; display: flex; flex-direction: column"
      >
        <!-- See https://github.com/codemirror/CodeMirror/issues/3679 for why we do this nesting
                       (to work around a chrome bug, and/or avoid major slowdown doing layout?) -->
        <div
          class="webapp-editor-codemirror-input-box"
          style="display: flex; flex-direction: column; position: relative"
        >
          <div style="position: absolute; height: 100%; width: 100%"></div>
        </div>
        <div class="webapp-editor-codemirror-input-box-1 hide">
          <div></div>
        </div>
      </div>

      <div
        class="webapp-editor-codemirror-input-container-layout-1 hide"
        style="flex: 1; display: flex; flex-direction: column"
      >
        <!-- See https://github.com/codemirror/CodeMirror/issues/3679 for why we do this nesting
                       (to work around a chrome bug, and/or avoid major slowdown doing layout?) -->
        <div
          class="webapp-editor-codemirror-input-box"
          style="display: flex; flex-direction: column; position: relative"
        >
          <div style="position: absolute; height: 100%; width: 100%"></div>
        </div>
        <div class="webapp-editor-resize-bar-layout-1"></div>
        <!-- flex: 1 so expands to what is left after editor above is placed. -->
        <div
          class="webapp-editor-codemirror-input-box-1"
          style="
            flex: 1;
            display: flex;
            flex-direction: column;
            position: relative;
          "
        >
          <div style="position: absolute; height: 100%; width: 100%"></div>
        </div>
      </div>

      <div
        class="webapp-editor-codemirror-input-container-layout-2 hide"
        style="flex: 1; display: flex; flex-direction: row"
      >
        <!-- See https://github.com/codemirror/CodeMirror/issues/3679 for why we do this nesting
                       (to work around a chrome bug, and/or avoid major slowdown doing layout?) -->
        <div
          class="webapp-editor-codemirror-input-box"
          style="display: flex; flex-direction: column; position: relative"
        >
          <div style="position: absolute; height: 100%; width: 100%"></div>
        </div>
        <div class="webapp-editor-resize-bar-layout-2"></div>
        <!-- flex: 1 so expands to what is left after editor above is placed. -->
        <div
          class="webapp-editor-codemirror-input-box-1"
          style="
            flex: 1;
            display: flex;
            flex-direction: column;
            position: relative;
          "
        >
          <div style="position: absolute; height: 100%; width: 100%"></div>
        </div>
      </div>
    </div>
    <div
      class="webapp-editor-codemirror-startup-message alert alert-warning hide"
      role="alert"
    ></div>
  </div>

  <!-- Template for the codemirror text editor other user cursors -->
  <div class="webapp-editor-codemirror-cursor">
    <span class="webapp-editor-codemirror-cursor-label"></span>
    <div class="webapp-editor-codemirror-cursor-inside">&nbsp;&nbsp;&nbsp;</div>
  </div>

  <div class="smc-editor-codemirror-cursor">
    <span class="smc-editor-codemirror-cursor-label"></span>
    <div class="smc-editor-codemirror-cursor-inside">&nbsp;&nbsp;&nbsp;</div>
  </div>

  <!-- Static HTML viewer -->
  <div class="webapp-editor-static-html">
    <div class="webapp-editor-static-html-content">
      <iframe style="width: 100%; border: 0px"> </iframe>
    </div>
  </div>

  <!-- Templates for the png-based PDF previewer; this is designed for the pdf changes in little ways locally.  -->
  <div class="webapp-editor-pdf-preview smc-vfill">
    <div class="webapp-editor-pdf-preview-spinner hide"></div>
    <div class="webapp-editor-pdf-preview-highlight hide"></div>
    <div class="webapp-editor-pdf-preview-buttons">
      <span class="btn-group">
        <a
          href="#zoom-preview-out"
          class="btn btn-sm btn-default"
          data-toggle="tooltip"
          data-placement="bottom"
          title="Zoom out some"
          ><i class="fa fa-search-minus"></i
        ></a>
        <a
          href="#zoom-preview-in"
          class="btn btn-sm btn-default"
          data-toggle="tooltip"
          data-placement="bottom"
          title="Zoom in some"
          ><i class="fa fa-search-plus"></i
        ></a>
        <a
          href="#zoom-preview-fullpage"
          class="btn btn-sm btn-default"
          data-toggle="tooltip"
          data-placement="bottom"
          title="Zoom so page width matches viewport"
          ><i class="fa fa-file-o"></i
        ></a>
        <a
          href="#zoom-preview-width"
          class="btn btn-sm btn-default"
          data-toggle="tooltip"
          data-placement="bottom"
          title="Zoom in close"
          ><i class="fa fa-arrows-alt"></i
        ></a>
        <a
          href="#preview-resolution"
          class="btn btn-sm btn-default"
          data-toggle="tooltip"
          data-placement="bottom"
          title="Change the preview resolution"
          ><i class="fa fa-th"></i
        ></a>
        <a
          href="#pdf-download"
          class="btn btn-sm btn-default"
          data-toggle="tooltip"
          data-placement="bottom"
          title="Download the PDF file"
          ><i class="fa fa-download"></i
        ></a>
      </span>
      <span class="btn-group pull-right">
        <a
          href="#toggle-preview"
          class="btn btn-sm btn-default"
          data-toggle="tooltip"
          data-placement="bottom"
          title="If enabled, the LaTeX file is compiled and a preview is rendered."
        >
          <i class="fa fa-check-square-o"></i> Build preview
        </a>
      </span>
    </div>
    <div
      style="flex: 1; overflow-y: auto; overflow-x: auto"
      class="webapp-editor-pdf-preview-output"
    >
      <div class="webapp-editor-pdf-preview-page"></div>
      <div class="webapp-editor-pdf-preview-message hide"></div>
    </div>
  </div>

  <!-- Templates for the embedded PDF previewer: just uses the built-in renderer; can't cope with file updates, inverse search, etc. -->
  <div class="webapp-editor-pdf-preview-embed smc-vfill">
    <div class="webapp-editor-codemirror-button-row">
      <span class="webapp-editor-pdf-preview-embed-spinner hide"></span>
      <span class="btn-group">
        <a class="btn btn-default btn-lg visible-xs" href="#close"
          ><i class="fa fa-toggle-up"></i>
          <span class="hidden-xs">Files...</span></a
        >
        <a class="btn btn-default btn-lg visible-xs" href="#refresh"
          ><i class="fa fa-refresh"></i>
          <span class="hidden-xs"> Refresh</span></a
        >
        <a class="btn btn-default hidden-xs" href="#refresh"
          ><i class="fa fa-refresh"></i>
          <span class="hidden-xs"> Refresh</span></a
        >
      </span>
      <span class="btn-group pull-right">
        <a class="btn btn-default webapp-editor-pdf-title hidden-xs">
          <i class="fa fa-external-link"></i>
          <span></span>
        </a>
      </span>
    </div>
    <div class="webapp-editor-pdf-preview-embed-page smc-vfill">
      <iframe frameborder="0" scrolling="no" style="width: 100%; height: 100%">
        <br />
        <br />
        &nbsp;&nbsp;&nbsp;Your browser doesn't support embedded PDF's, but you
        can <a target="_blank">download <span></span></a>...
      </iframe>
    </div>
  </div>

  <div class="webapp-editor-history smc-vfill">
    <div
      class="webapp-editor-history-controls"
      style="
        display: flex;
        padding-left: 10px;
        padding-right: 10px;
        border-bottom: 1px solid lightgrey;
        background-color: #efefef;
      "
    >
      <span
        style="
          color: #666;
          font-size: 14pt;
          font-weight: bold;
          margin-right: 1em;
        "
      >
        <i class="fa fa-history"></i>
        TimeTravel
      </span>
      <span>
        <a
          href="#show-diff"
          class="btn btn-default"
          data-toggle="tooltip"
          data-placement="bottom"
          title="Show changes"
          ><i class="fa fa-square-o"></i> Changes</a
        >
        <a
          href="#hide-diff"
          class="btn btn-default hide"
          data-toggle="tooltip"
          data-placement="bottom"
          title="Show what changed"
          ><i class="fa fa-check-square-o"></i> Changes</a
        >
      </span>
      <span
        class="webapp-editor-history-control-button-container btn-group smc-btn-group-nobreak"
        style="margin-left: 1em"
      >
        <a
          href="#back"
          class="btn btn-default"
          data-toggle="tooltip"
          data-placement="bottom"
          title="Back"
          ><i class="fa fa-step-backward"></i
        ></a>
        <a
          href="#forward"
          class="btn btn-default disabled"
          data-toggle="tooltip"
          data-placement="bottom"
          title="Forward"
          ><i class="fa fa-step-forward"></i
        ></a>
      </span>
      <span class="btn-group smc-btn-group-nobreak">
        <a
          href="#file"
          class="btn btn-info"
          style="margin-left: 1em"
          data-toggle="tooltip"
          data-placement="bottom"
          title="Show full file"
          ><i class="fa fa-file-code-o"></i> Open File</a
        >
        <a
          href="#revert"
          class="btn btn-warning hide"
          data-toggle="tooltip"
          data-placement="bottom"
          title="Revert the live file to the displayed revision"
          ><i class="fa fa-undo"></i> Revert live version to this &nbsp;</a
        >
        <a href="#snapshots" class="btn btn-default">
          <i class="fa fa-life-saver"></i>
          <span class="hidden-sm" style="font-size: 12px">Backups</span>
        </a>
        <a
          href="#all"
          class="btn btn-default hide"
          data-toggle="tooltip"
          data-placement="bottom"
          title="Load complete history"
          ><i class="fa fa-floppy-o"></i> Load All History
        </a>
        <a
          href="#export"
          class="btn btn-default"
          data-toggle="tooltip"
          data-placement="bottom"
          title="Export to file"
          ><i class="fa fa-file-export"></i> Export</a
        >
      </span>
      <div style="color: #666; margin-left: 1em">
        <span
          class="webapp-editor-history-revision-time"
          style="font-weight: bold; font-size: 12pt"
        ></span
        ><span class="webapp-editor-history-diff-mode hide"
          >&nbsp;&nbsp; to&nbsp;&nbsp; </span
        ><span
          class="hide webapp-editor-history-diff-mode webapp-editor-history-revision-time2"
          style="font-weight: bold; font-size: 12pt"
        ></span
        ><span class="webapp-editor-history-revision-number"> </span>
      </div>
    </div>
    <div style="margin-top: 7px; margin-right: 15px">
      &nbsp;
      <span
        class="webapp-editor-history-revision-user lighten pull-right"
      ></span>
    </div>
    <div
      class="webapp-editor-history-sliders"
      style="border-bottom: 1px solid lightgrey"
    >
      <div
        class="webapp-editor-history-slider webapp-editor-history-slider-style"
      ></div>
      <div
        class="webapp-editor-history-diff-slider hide webapp-editor-history-slider-style"
      ></div>
    </div>

    <div class="webapp-editor-history-no-viewer hide" style="margin-left: 15px">
      <b>WARNING: </b> History viewer for this file type not implemented, so
      showing underlying raw file instead.
    </div>

    <div class="webapp-editor-history-history_editor smc-vfill"></div>
  </div>

  <span class="sagews-input">
    <span class="sagews-input-hr sagews-input-eval-state"></span>
    <span class="sagews-input-hr sagews-input-run-state"></span>
    <span class="sagews-input-hr sagews-input-newcell"></span>
  </span>

  <span class="sagews-output">
    <span class="sagews-output-container">
      <span class="sagews-output-messages"></span>
    </span>
  </span>

  <div class="webapp-ipython-notebook">
    <!--<h3 style="margin-left:1em">IPython Notebook: <span class="webapp-ipython-filename"></span></h3>-->
    <div class="webapp-ipython-notebook-buttons hidden-xs">
      <span class="webapp-ipython-notebook-status-messages lighten"> </span>
      <span class="hide webapp-ipython-notebook-danger"
        >DANGER: Users on this VM could connect unless you stop your
        ipython-notebook server (they would have to know secret internal
        project-id).</span
      >
      <span class="btn-group">
        <a
          href="#save"
          class="btn btn-sm btn-success"
          data-toggle="tooltip"
          data-placement="bottom"
          title="Save .ipynb file to disk (file is constantly sync'd with server)."
        >
          <i class="fa fa-save primary-icon"></i
          ><i class="fa fa-cocalc-ring hide"></i> Save
        </a>
        <a
          href="#history"
          class="btn btn-sm btn-info webapp-editor-history-button hide"
          data-toggle="tooltip"
          data-placement="bottom"
          title="View the history of this file."
        >
          <i class="fa fa-history"></i>
          <span class="hidden-sm">TimeTravel</span>
        </a>
        <a
          href="#reload"
          class="btn btn-sm btn-warning"
          data-toggle="tooltip"
          data-placement="bottom"
          title="Reload this Notebook; use if the IPython server is killed or restarted on another port"
        >
          <i class="fa fa-refresh"></i> Reload</a
        >
        <a
          href="#publish"
          class="btn btn-primary btn-sm"
          data-toggle="tooltip"
          data-placement="bottom"
          title="Publish this notebook for anybody to see"
        >
          <i class="fa fa-refresh fa-spin hide"> </i>
          <i class="fa fa-share-square"></i> Publish</a
        >
        <a
          href="#info"
          class="btn btn-sm btn-info"
          data-toggle="tooltip"
          data-placement="bottom"
          title="Extra information about the IPython notebook"
        >
          <i class="fa fa-info-circle"></i> About
        </a>
      </span>
    </div>
    <div class="visible-xs">
      <span class="btn-group">
        <a href="#save" class="btn btn-success btn-lg">
          <i class="fa fa-save"></i> Save</a
        >
      </span>
      <span class="btn-group webapp-editor-codemirror-worksheet-buttons hide">
        <a href="#execute" class="btn btn-default btn-lg">
          <i class="fa fa-play"></i>
          <span>Run</span>
        </a>
        <a href="#interrupt" class="btn btn-default btn-lg">
          <i class="fa fa-stop"></i>
          <span>Stop</span>
        </a>
        <a href="#tab" class="btn btn-default btn-lg">
          <i class="fa fa-info-circle"></i>
          <span>Tab</span>
        </a>
      </span>
      <span class="btn-group">
        <a href="#reload" class="btn btn-warning btn-lg">
          <i class="fa fa-refresh"></i> Reload</a
        >
        <a href="#info" class="btn btn-info btn-lg">
          <i class="fa fa-info-circle"></i>
        </a>
      </span>
    </div>
    <h3
      class="webapp-ipython-notebook-connecting hide"
      style="margin-left: 2em"
    >
      Opening...
    </h3>
    <div class="webapp-ipython-notebook-notebook"></div>
  </div>

  <div
    class="modal webapp-file-print-dialog"
    data-backdrop="static"
    tabindex="-1"
    role="dialog"
    aria-hidden="true"
  >
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <button type="button" class="close btn-close" aria-hidden="true">
            <span style="font-size: 20pt">×</span>
          </button>
          <h3>
            <i class="fa fa-print"> </i> Printable PDF version of
            <span class="webapp-file-print-filename"></span>
          </h3>
        </div>
        <div class="well">
          <h4>Heading <span class="lighten">(click to edit)</span></h4>
          <div class="well" style="background-color: white; text-align: center">
            <h4 class="webapp-file-print-title" contenteditable="true"></h4>
            <h5 class="webapp-file-print-author" contenteditable="true"></h5>
            <h5 class="webapp-file-print-date" contenteditable="true"></h5>
          </div>
          <div class="webapp-file-options-sagews hide">
            <h4>Worksheet Options</h4>
            <div class="well" style="background-color: white">
              <div class="checkbox">
                <label class="" rel="tooltip" title="Table of contents">
                  <input
                    type="checkbox"
                    class="webapp-file-print-contents"
                    rel="tooltip"
                  />Table of contents
                </label>
              </div>
              <div class="checkbox">
                <label class="" rel="tooltip" title="Keep generated files">
                  <input
                    type="checkbox"
                    class="webapp-file-print-keepfiles"
                    rel="tooltip"
                  />Keep generated files in a sub-directory. This is useful for
                  debugging printing issues or additional editing.
                  <div class="smc-file-printing-tempdir hide"></div>
                </label>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-close pull-left btn-default btn-lg">
            Close
          </button>
          <button class="btn btn-primary btn-submit pull-left btn-lg">
            <i class="fa fa-bolt primary-icon"> </i>
            <i class="fa fa-cocalc-ring hide"></i> Generate PDF
          </button>
          <span class="webapp-file-printing-progress hide"
            >Preparing PDF version...</span
          >
          <a class="webapp-file-printing-link hide" target="_blank"
            >link to PDF version</a
          >
        </div>
      </div>
    </div>
  </div>
  <div
    class="modal webapp-goto-line-dialog"
    data-backdrop="static"
    tabindex="-1"
    role="dialog"
    aria-hidden="true"
  >
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <button type="button" class="close btn-close" aria-hidden="true">
            <span style="font-size: 20pt">×</span>
          </button>
          <h3><i class="fa fa-bolt"> </i> Goto Line</h3>
        </div>
        <div class="well" style="margin: 1em">
          <div class="lighten">
            Enter <span class="webapp-goto-line-range"></span>
          </div>
          <input
            class="webapp-goto-line-input form-control"
            style="width: 95%; margin-top: 1ex"
            type="text"
            placeholder=""
          />
        </div>
        <div class="modal-footer">
          <button class="btn btn-close btn-default">Cancel</button>
          <button class="btn btn-primary btn-submit">OK</button>
        </div>
      </div>
    </div>
  </div>

  <div class="webapp-editor-textedit-buttonbar">
    <span class="btn-group">
      <a
        href="#bold"
        class="btn btn-default"
        data-toggle="tooltip"
        data-placement="bottom"
        title="Bold"
        ><i class="fa fa-bold"></i
      ></a>
      <a
        href="#italic"
        class="btn btn-default"
        data-toggle="tooltip"
        data-placement="bottom"
        title="Italic"
        ><i class="fa fa-italic"></i
      ></a>
      <a
        href="#underline"
        class="btn btn-default"
        data-toggle="tooltip"
        data-placement="bottom"
        title="Underline"
        ><i class="fa fa-underline"></i
      ></a>
      <a
        href="#strikethrough"
        class="btn btn-default"
        data-toggle="tooltip"
        data-placement="bottom"
        title="Strike through"
        ><i class="fa fa-strikethrough"></i
      ></a>
      <a
        href="#subscript"
        class="btn btn-default"
        data-toggle="tooltip"
        data-placement="bottom"
        title="Subscript (use LaTeX for serious equations)"
        ><i class="fa fa-subscript"></i
      ></a>
      <a
        href="#superscript"
        class="btn btn-default"
        data-toggle="tooltip"
        data-placement="bottom"
        title="Superscript"
        ><i class="fa fa-superscript"></i
      ></a>
      <a
        href="#comment"
        class="btn btn-default"
        data-toggle="tooltip"
        data-placement="bottom"
        title="Comment out selection"
        ><i class="fa fa-comment-o"></i
      ></a>
    </span>
    <span class="btn-group">
      <a
        href="#equation"
        class="btn btn-default"
        data-toggle="tooltip"
        data-placement="bottom"
        title="Inline equation..."
      >
        $
      </a>
      <a
        href="#display_equation"
        class="btn btn-default"
        data-toggle="tooltip"
        data-placement="bottom"
        title="Displayed equation..."
      >
        $$
      </a>
      <a
        href="#insertunorderedlist"
        class="btn btn-default"
        data-toggle="tooltip"
        data-placement="bottom"
        title="Insert unordered list"
        ><i class="fa fa-list"></i
      ></a>
      <a
        href="#insertorderedlist"
        class="btn btn-default"
        data-toggle="tooltip"
        data-placement="bottom"
        title="Insert ordered list"
        ><i class="fa fa-list-ol"></i
      ></a>
      <a
        href="#link"
        data-args="special"
        class="btn btn-default"
        data-toggle="tooltip"
        data-placement="bottom"
        title="Insert link..."
        ><i class="fa fa-link"></i
      ></a>
      <a
        href="#image"
        data-args="special"
        class="btn btn-default"
        data-toggle="tooltip"
        data-placement="bottom"
        title="Insert image..."
        ><i class="fa fa-image"></i
      ></a>
      <a
        href="#table"
        data-args="special"
        class="btn btn-default"
        data-toggle="tooltip"
        data-placement="bottom"
        title="Insert table"
        ><i class="fa fa-table"></i
      ></a>
      <a
        href="#horizontalRule"
        data-args="special"
        class="btn btn-default"
        data-toggle="tooltip"
        data-placement="bottom"
        title="Insert horizontal line"
        >&mdash;</a
      >
      <a
        href="#SpecialChar"
        data-args="special"
        class="btn btn-default"
        data-toggle="tooltip"
        data-placement="bottom"
        title="Insert Special Character ..."
        >&Omega;</a
      >
    </span>
    <span class="btn-group">
      <a
        href="#justifyleft"
        class="btn btn-default"
        data-toggle="tooltip"
        data-placement="bottom"
        title="Left justify"
        ><i class="fa fa-align-left"></i
      ></a>
      <a
        href="#justifycenter"
        class="btn btn-default"
        data-toggle="tooltip"
        data-placement="bottom"
        title="Justify center"
        ><i class="fa fa-align-center"></i
      ></a>
      <a
        href="#justifyright"
        class="btn btn-default"
        data-toggle="tooltip"
        data-placement="bottom"
        title="Right justify"
        ><i class="fa fa-align-right"></i
      ></a>
      <a
        href="#justifyfull"
        class="btn btn-default"
        data-toggle="tooltip"
        data-placement="bottom"
        title="Justify full"
        ><i class="fa fa-align-justify"></i
      ></a>
      <a
        href="#indent"
        class="btn btn-default"
        data-toggle="tooltip"
        data-placement="bottom"
        title="Indent/quote selected text"
        ><i class="fa fa-indent"></i
      ></a>
      <a
        href="#unformat"
        class="btn btn-default"
        data-toggle="tooltip"
        data-placement="bottom"
        title="Remove formatting"
        ><i class="fa fa-remove"></i
      ></a>
      <a
        href="#clean"
        class="btn btn-default"
        data-toggle="tooltip"
        data-placement="bottom"
        title="Make selected HTML valid"
        ><i class="fa fa-code"></i
      ></a>
    </span>
    <span class="btn-group">
      <span
        class="btn-group sagews-output-editor-font-face smc-tooltip"
        data-toggle="tooltip"
        data-placement="bottom"
        title="Fonts"
      >
        <span
          class="btn btn-default dropdown-toggle"
          data-toggle="dropdown"
          title="Font"
        >
          <i class="fa fa-font"></i> <b class="caret"></b>
        </span>
        <ul class="dropdown-menu"></ul>
      </span>
      <span
        class="btn-group sagews-output-editor-font-size smc-tooltip"
        data-toggle="tooltip"
        data-placement="bottom"
        title="Font size"
      >
        <span
          class="btn btn-default dropdown-toggle"
          data-toggle="dropdown"
          title="Text height"
        >
          <i class="fa fa-text-height"></i> <b class="caret"></b>
        </span>
        <ul class="dropdown-menu"></ul>
      </span>
      <span
        class="btn-group sagews-output-editor-block-type smc-tooltip"
        data-toggle="tooltip"
        data-placement="bottom"
        title="Format type"
      >
        <span
          class="btn btn-default dropdown-toggle"
          data-toggle="dropdown"
          title="Header"
        >
          <i class="fa fa-header"></i> <b class="caret"></b>
        </span>
        <ul class="dropdown-menu"></ul>
      </span>
    </span>
    <!-- color menus disabled/broken: see https://github.com/sagemathinc/cocalc/issues/1167 for re-implementing them -->
    <span class="btn-group">
      <span
        class="hide sagews-output-editor-foreground-color-selector input-group color smc-tooltip"
        data-color-format="rgb"
        data-toggle="tooltip"
        data-placement="bottom"
        title="Text color"
      >
        <input type="text" style="cursor: pointer" class="form-control" />
        <span class="input-group-addon" style="padding: 3px"
          ><i class="fa fa-font" style="height: 16px; width: 16px"></i
          ><b class="caret"></b
        ></span>
      </span>
    </span>
    <span class="btn-group">
      <span
        class="hide sagews-output-editor-background-color-selector input-group color smc-tooltip"
        data-color-format="rgb"
        data-toggle="tooltip"
        data-placement="bottom"
        title="Text background highlight color"
      >
        <input type="text" style="cursor: pointer" class="form-control" />
        <span class="input-group-addon" style="padding: 3px"
          ><i class="fa fa-font" style="height: 16px; width: 16px"></i
          ><b class="caret"></b
        ></span>
      </span>
    </span>
  </div>

  <div class="webapp-editor-codeedit-buttonbar hide" style="margin: 2px">
    <!-- buttonbar.coffee populates all entries -->
  </div>

  <div class="webapp-editor-redit-buttonbar hide" style="margin: 2px">
    <!-- buttonbar.coffee populates the entries -->
  </div>
  <div class="webapp-editor-julia-edit-buttonbar hide" style="margin: 2px">
    <!-- buttonbar.coffee populates the entries -->
  </div>
  <div class="webapp-editor-sh-edit-buttonbar hide" style="margin: 2px">
    <!-- buttonbar.coffee populates the entries -->
  </div>
  <div class="webapp-editor-fricas-edit-buttonbar hide" style="margin: 2px">
    <!-- buttonbar.coffee populates the entries -->
  </div>
  <div class="webapp-editor-fallback-edit-buttonbar hide" style="margin: 2px">
    <a class="btn btn-default" href="#todo">&hellip;</a>
  </div>

  <div class="sagews-output-raw_input">
    <div class="form-inline">
      <div class="form-group">
        <label
          class="sagews-output-raw_input-prompt"
          style="margin-right: 10px"
        >
        </label>
        <div class="input-group">
          <input class="sagews-output-raw_input-value form-control" />
          <span class="input-group-btn">
            <button
              class="btn btn-success sagews-output-raw_input-submit"
              type="button"
            >
              <i class="fa fa-check"></i>
            </button>
          </span>
        </div>
      </div>
    </div>
  </div>
</div>

`;

const sagews_interact = `
<div class="webapp-interact-templates hide">

    <!-- Interact -->
    <div class="webapp-interact-container container-fluid">
    </div>

    <!-- Interact: input-box -->
    <div class="webapp-interact-control-input-box">
        <div class="row">
            <div class="col-sm-4">
                <span class="webapp-interact-label pull-right"></span>
            </div>
            <div class="col-sm-8">
                <input type="text" class="hide webapp-interact-input-box-font form-control">
                <textarea class="hide webapp-interact-input-box-font" spellcheck="false"></textarea>
                <span class="webapp-interact-control-input-box-submit-button hide">
                    <a class="btn btn-default">Submit</a>
                    <br><br>
                </span>
            </div>
        </div>
    </div>


    <!-- Interact: checkbox -->
    <div class="webapp-interact-control-checkbox">
        <div class="row">
            <div class="col-sm-4">
                <span class="webapp-interact-label pull-right" style="  padding-top: 2px;"></span>
            </div>
            <div class="col-sm-8">
                <input type="checkbox">
            </div>
        </div>
    </div>

    <!-- Interact: selector -->
    <div class="webapp-interact-control-selector">
        <div class="row">
            <div class="col-sm-4">
                <span class="webapp-interact-label pull-right"></span>
            </div>
            <div class="col-sm-8">
                <div class="webapp-interact-control-content"></div>
            </div>
        </div>
    </div>

    <!-- Interact: button -->
    <div class="webapp-interact-control-button">
        <div class="row">
            <div class="col-sm-4">
                <span class="webapp-interact-label pull-right"></span>
            </div>
            <div class="col-sm-8">
                <a class="btn btn-default"><i class="fa">&nbsp;&nbsp;</i> <span></span></a>
            </div>
        </div>
    </div>

    <!-- Interact: text -->
    <div class="webapp-interact-control-text">
        <div class="row">
            <div class="col-sm-4">
                <span class="webapp-interact-label pull-right"></span>
            </div>
            <div class="col-sm-8">
                <span class="webapp-interact-control-content"></span>
            </div>
        </div>
    </div>

    <!-- Interact: color-selector -->
    <div class="webapp-interact-control-color-selector">
        <div class="row">
            <div class="col-sm-4">
                <span class="webapp-interact-label pull-right"></span>
            </div>
            <div class="col-sm-8">
                <div class="input-group color" data-color-format="rgb">
                    <input type="text" value="" style="font-family:monospace" class="form-control">
                    <span class="input-group-addon"><i class="fa" style="height: 16px; width: 16px"></i></span>
                </div>
            </div>
        </div>
    </div>

    <!-- Interact: slider -->
    <div class="webapp-interact-control-slider">
        <div class=" webapp-interact-control-content">
            <div class="row">
                <div class="col-sm-4">
                    <div class="webapp-interact-label pull-right"></div>
                </div>
                <div class="pull-left col-sm-6">
                    <div class="webapp-interact-control-slider"></div>
                </div>
                <div class="col-sm-2">
                    <div class="webapp-interact-control-value"></div>
                </div>
            </div>
        </div>
    </div>


    <!-- Interact: range-slider -->
    <div class="webapp-interact-control-range-slider">
        <div class="webapp-interact-control-content">
            <div class="row">
                <div class="col-sm-4">
                    <div class="webapp-interact-label pull-right"></div>
                </div>
                <div class="pull-left col-sm-6">
                    <div class="webapp-interact-control-slider"></div>
                </div>
                <div class="col-sm-2">
                    <div class="webapp-interact-control-value"></div>
                </div>
            </div>
        </div>
    </div>

    <!-- Interact: input_grid -->
    <div class="webapp-interact-control-input-grid">
        <div class="row">
            <div class="col-sm-4">
                <span class="webapp-interact-label pull-right"></span>
            </div>
            <div class="col-sm-8">
                <span class="webapp-interact-control-grid well"></span>
                <a class="btn btn-success btn-sm"><i class="fa fa-check"> </i><span></span></a>
            </div>
        </div>
    </div>

</div>
`;

const sagews_3d = `
<div class="webapp-3d-templates hide">
    <span class="webapp-3d-loading">
        <i class="fa fa-cube fa-spin" style="font-size:16pt"></i>
        Loading 3D scene...
    </span>
    <span class="webapp-3d-viewer">
        <span class="webapp-3d-note hide">
            Evaluate to see 3d plot.
        </span>
        <span class="webapp-3d-canvas">
        </span>
        <span class="webapp-3d-canvas-warning lighten hide" style="margin-top: -1em"   data-toggle="tooltip" data-placement="top" title="WARNING: using slow non-WebGL canvas renderer">canvas</span>
    </span>
</div>
`;

const sagews_d3 = `
<div class="webapp-d3-templates hide">
    <span class="webapp-d3-graph-viewer">
    </span>
</div>
`;

export const TEMPLATES_HTML =
  console + editor + sagews_interact + sagews_3d + sagews_d3;
