/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

import { Alert, Button, Divider, Radio } from "antd";
import { join } from "path";
import {
  Col,
  ListGroup,
  ListGroupItem,
  Row,
} from "@cocalc/frontend/antd-bootstrap";
import {
  CSS,
  React,
  redux,
  useMemo,
  useState,
  useTypedRedux,
} from "@cocalc/frontend/app-framework";
import {
  A,
  Gap,
  Icon,
  Markdown,
  Paragraph,
  SearchInput,
} from "@cocalc/frontend/components";
import {
  CompanyName,
  HelpEmailLink,
  SiteName,
} from "@cocalc/frontend/customize";
import { appBasePath } from "@cocalc/frontend/customize/app-base-path";
import { ComputeImageSelector } from "@cocalc/frontend/project/settings/compute-image-selector";
import { KUCALC_COCALC_COM } from "@cocalc/util/db-schema/site-defaults";
import { unreachable } from "@cocalc/util/misc";
import { COLORS } from "@cocalc/util/theme";
import { ComputeImage, ComputeImageTypes, ComputeImages } from "./init";
import {
  CUSTOM_SOFTWARE_HELP_URL,
  compute_image2basename,
  custom_image_name,
  is_custom_image,
} from "./util";

const BINDER_URL = "https://mybinder.readthedocs.io/en/latest/";

const CS_LIST_STYLE: CSS = {
  height: "250px",
  overflowX: "hidden" as "hidden",
  overflowY: "scroll" as "scroll",
  border: `1px solid ${COLORS.GRAY_LL}`,
  borderRadius: "5px",
  marginBottom: "0px",
} as const;

const ENTRIES_ITEM_STYLE: CSS = {
  width: "100%",
  margin: "2px 0px",
  padding: "5px",
  border: "none",
  textAlign: "left" as "left",
} as const;

export interface SoftwareEnvironmentState {
  image_selected?: string;
  title_text?: string;
  image_type?: ComputeImageTypes;
}

// this is used in create-project and course/configuration/actions
// this derives the proper image name from the image type & image selection of SoftwareEnvironmentState
export async function derive_project_img_name(
  custom_software: SoftwareEnvironmentState,
): Promise<string> {
  const { image_type, image_selected } = custom_software;
  const dflt_software_img = await redux
    .getStore("customize")
    .getDefaultComputeImage();
  if (image_selected == null || image_type == null) {
    return dflt_software_img;
  }
  switch (image_type) {
    case "custom":
      return custom_image_name(image_selected);
    case "default":
    case "standard":
      return image_selected;
    default:
      unreachable(image_type);
      return dflt_software_img; // make TS happy
  }
}

interface Props {
  onChange: (obj: SoftwareEnvironmentState) => void;
  default_image?: string; // which one to initialize state to
  showTitle?: boolean; // default true
}

// this is a selector for the software environment of a project
export const SoftwareEnvironment: React.FC<Props> = (props: Props) => {
  const { onChange, default_image, showTitle = true } = props;
  const images: ComputeImages | undefined = useTypedRedux(
    "compute_images",
    "images",
  );

  const customize_kucalc = useTypedRedux("customize", "kucalc");
  const onCoCalcCom = customize_kucalc === KUCALC_COCALC_COM;
  const customize_software = useTypedRedux("customize", "software");
  const [dflt_software_img, software_images] = useMemo(
    () => [
      customize_software.get("default"),
      customize_software.get("environments"),
    ],
    [customize_software],
  );

  const haveSoftwareImages: boolean = useMemo(
    () => (customize_software.get("environments")?.size ?? 0) > 0,
    [customize_software],
  );

  const [search_img, set_search_img] = useState<string>("");
  const [image_selected, set_image_selected] = useState<string | undefined>(
    undefined,
  );
  const set_title_text = useState<string | undefined>(undefined)[1];
  const [image_type, set_image_type] = useState<ComputeImageTypes>("default");

  function set_state(
    image_selected: string | undefined,
    title_text: string | undefined,
    image_type: ComputeImageTypes,
  ): void {
    set_image_selected(image_selected);
    set_title_text(title_text);
    set_image_type(image_type);
    onChange({ image_selected, title_text, image_type });
  }

  // initialize selection, if there is a default image set
  React.useEffect(() => {
    if (default_image == null || default_image === dflt_software_img) {
      // do nothing, that's the initial state already!
    } else if (is_custom_image(default_image)) {
      if (images == null) return;
      const id = compute_image2basename(default_image);
      const img: ComputeImage | undefined = images.get(id);
      if (img == null) {
        // ignore, user has to select from scratch
      } else {
        set_state(id, img.get("display", ""), "custom");
      }
    } else {
      // must be standard image
      const img = software_images.get(default_image);
      const display = img != null ? (img.get("title") ?? "") : "";
      set_state(default_image, display, "standard");
    }
  }, []);

  function render_custom_image_entries() {
    if (images == null) return;

    const search_hit = (() => {
      if (search_img.length > 0) {
        return (img: ComputeImage) =>
          img.get("search_str", "").indexOf(search_img.toLowerCase()) >= 0;
      } else {
        return (_img: ComputeImage) => true;
      }
    })();

    const entries: JSX.Element[] = images
      .filter((img) => img.get("type", "") === "custom")
      .filter(search_hit)
      .sortBy((img) => img.get("display", "").toLowerCase())
      .entrySeq()
      .map((e) => {
        const [id, img] = e;
        const display = img.get("display", "");
        return (
          <ListGroupItem
            key={id}
            active={image_selected === id}
            onClick={() => set_state(id, display, image_type)}
            style={ENTRIES_ITEM_STYLE}
            bsSize={"small"}
          >
            {display}
          </ListGroupItem>
        );
      })
      .toArray();

    if (entries.length > 0) {
      return <ListGroup style={CS_LIST_STYLE}>{entries}</ListGroup>;
    } else {
      if (search_img.length > 0) {
        return <div>No search hits.</div>;
      } else {
        return <div>No custom software available</div>;
      }
    }
  }

  function search(val: string): void {
    set_search_img(val);
    set_state(undefined, undefined, image_type);
  }

  function render_custom_images() {
    if (image_type !== "custom") return;

    return (
      <>
        <div style={{ display: "flex" }}>
          <SearchInput
            placeholder={"Search…"}
            autoFocus={false}
            value={search_img}
            on_escape={() => set_search_img("")}
            on_change={search}
            style={{ flex: "1" }}
          />
        </div>
        {render_custom_image_entries()}
      </>
    );
  }

  function render_custom_images_info() {
    if (image_type !== "custom") return;

    return (
      <>
        <div style={{ color: COLORS.GRAY, margin: "15px 0" }}>
          Contact us to add more or give feedback:{" "}
          <HelpEmailLink color={COLORS.GRAY} />.
        </div>
        <Alert
          type="info"
          banner
          message={
            <>
              The selected <em>custom</em> software environment stays with the
              project. Create a new project to work in a different software
              environment. You can always{" "}
              <A
                href={
                  "https://doc.cocalc.com/project-files.html#file-actions-on-one-file"
                }
              >
                copy files between projects
              </A>{" "}
              as well.
            </>
          }
        />
      </>
    );
  }

  function render_selected_custom_image_info() {
    if (image_type !== "custom" || image_selected == null || images == null) {
      return;
    }

    const id: string = image_selected;
    const data = images.get(id);
    if (data == null) {
      // we have a serious problem
      console.warn(`compute_image data missing for '${id}'`);
      return;
    }
    // some fields are derived in the "Table" when the data comes in
    const img: ComputeImage = data;
    const disp = img.get("display");
    const desc = img.get("desc", "");
    const url = img.get("url");
    const src = img.get("src");
    const disp_tag = img.get("display_tag");

    const render_source = () => {
      if (src == null || src.length == 0) return;
      return (
        <div style={{ marginTop: "5px" }}>
          Source: <code>{src}</code>
        </div>
      );
    };

    const render_url = () => {
      if (url == null || url.length == 0) return;
      return (
        <div style={{ marginTop: "5px" }}>
          <a href={url} target={"_blank"} rel={"noopener"}>
            <Icon name="external-link" /> Website
          </a>
        </div>
      );
    };

    return (
      <>
        <h3 style={{ marginTop: "5px" }}>{disp}</h3>
        <div style={{ marginTop: "5px" }}>
          Image ID: <code>{disp_tag}</code>
        </div>
        <div
          style={{ marginTop: "10px", overflowY: "auto", maxHeight: "200px" }}
        >
          <Markdown value={desc} className={"cc-custom-image-desc"} />
        </div>
        {render_source()}
        {render_url()}
      </>
    );
  }

  function render_onprem() {
    const selected = image_selected ?? dflt_software_img;
    return (
      <>
        <Paragraph>
          Select the software enviornment. Either go with the default
          environment, or select one of the more specialized ones. Whatever you
          pick, you can change it later in Project Settings → Control → Software
          Environment at any time.
        </Paragraph>
        <Paragraph>
          <ComputeImageSelector
            size={"middle"}
            selected_image={selected}
            layout={"horizontal"}
            onSelect={(img) => {
              const display = software_images.get(img)?.get("title");
              set_state(img, display, "standard");
            }}
          />
        </Paragraph>
        <Paragraph>
          {selected !== dflt_software_img ? (
            <Alert
              type="info"
              banner
              message={
                <>
                  You've selected a non-standard image:{" "}
                  <Button
                    size="small"
                    type="link"
                    onClick={() => {
                      set_state(dflt_software_img, undefined, "standard");
                    }}
                  >
                    Reset
                  </Button>
                </>
              }
            />
          ) : undefined}
        </Paragraph>
      </>
    );
  }

  function render_default_explanation(): JSX.Element {
    if (onCoCalcCom) {
      return (
        <>
          <b>Default</b>: large repository of software, well tested – maintained
          by <CompanyName />, running <SiteName />.{" "}
          <a
            href={join(appBasePath, "doc/software.html")}
            target={"_blank"}
            rel={"noopener"}
          >
            More info...
          </a>
        </>
      );
    } else {
      const dflt_img = software_images.get(dflt_software_img);
      const descr = dflt_img?.get("descr") ?? "large repository of software";
      const t = dflt_img?.get("title");
      const title = t ? `${t}: ${descr}` : descr;
      return (
        <>
          <b>Standard</b>: {title}
        </>
      );
    }
  }

  function render_default() {
    return (
      <Radio
        checked={image_type === "default"}
        id={"default-compute-image"}
        onChange={() => {
          set_state(undefined, undefined, "default");
        }}
      >
        {render_default_explanation()}
      </Radio>
    );
  }

  function render_standard_explanation(): JSX.Element {
    if (onCoCalcCom) {
      return (
        <>
          <b>Standard</b>: upcoming and archived versions of the "Default"
          software environment.
        </>
      );
    } else {
      return (
        <>
          <b>Specialized</b>: alternative software environments for specific
          purposes.
        </>
      );
    }
  }

  function render_standard_modify_later(): JSX.Element {
    return (
      <Alert
        type="info"
        banner
        message={
          <>
            The selected <em>standard</em> software environment can be changed
            in Project Settings → Control at any time.
          </>
        }
      />
    );
  }

  function render_standard() {
    if (!haveSoftwareImages) {
      return;
    }
    return (
      <Radio
        checked={image_type === "standard"}
        id={"default-compute-image"}
        onChange={() => {
          set_state(undefined, undefined, "standard");
        }}
      >
        {render_standard_explanation()}
      </Radio>
    );
  }

  function render_custom() {
    if (customize_kucalc !== KUCALC_COCALC_COM) {
      return null;
    }

    if (images == null || images.size == 0) {
      return "There are no customized software environments available.";
    } else {
      return (
        <Radio
          checked={image_type === "custom"}
          id={"custom-compute-image"}
          onChange={() => {
            set_state(undefined, undefined, "custom");
          }}
        >
          <b>Custom</b>
          <sup>
            <em>beta</em>
          </sup>
          : 3rd party software environments, e.g.{" "}
          <a href={BINDER_URL} target={"_blank"} rel={"noopener"}>
            Binder
          </a>
          .{" "}
          <a href={CUSTOM_SOFTWARE_HELP_URL} target={"_blank"}>
            More info...
          </a>
        </Radio>
      );
    }
  }

  function render_standard_image_selector() {
    if (image_type !== "standard") return;

    return (
      <Col sm={12}>
        <ComputeImageSelector
          selected_image={image_selected ?? dflt_software_img}
          layout={"horizontal"}
          onSelect={(img) => {
            const display = software_images.get(img)?.get("title");
            set_state(img, display, "standard");
          }}
        />
        <Gap />
        {render_standard_modify_later()}
      </Col>
    );
  }

  function render_type_selection() {
    return (
      <>
        {showTitle ? <div>Software environment</div> : undefined}

        {onCoCalcCom ? (
          <div>
            <div style={{ marginBottom: "5px" }}>{render_default()}</div>
            <div style={{ marginBottom: "5px" }}>{render_standard()}</div>
            <div style={{ marginBottom: "5px" }}>{render_custom()}</div>
          </div>
        ) : (
          render_onprem()
        )}
      </>
    );
  }

  function render_divider() {
    if (image_type === "default") return;
    return (
      <Divider orientation="left" plain>
        Configuration
      </Divider>
    );
  }

  return (
    <Row>
      <Col sm={12} style={{ marginTop: "10px" }}>
        {render_type_selection()}
      </Col>

      {onCoCalcCom ? (
        <>
          {render_divider()}
          {render_standard_image_selector()}
          <Col sm={6}>{render_custom_images()}</Col>
          <Col sm={6}>{render_selected_custom_image_info()}</Col>
          <Col sm={12}>{render_custom_images_info()}</Col>
        </>
      ) : undefined}
    </Row>
  );
};
