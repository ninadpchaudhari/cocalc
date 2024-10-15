/*
 *  This file is part of CoCalc: Copyright © 2021 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

import { Space } from "antd";
import { cloneDeep, get, keys, set } from "lodash";
import {
  CSSProperties,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Icon, IconName } from "@cocalc/frontend/components/icon";
import { capitalize } from "@cocalc/util/misc";
import { SCHEMA } from "@cocalc/util/schema";
import { Paragraph, Title } from "components/misc";
import Checkbox from "components/misc/checkbox";
import IntegerSlider from "components/misc/integer-slider";
import SaveButton from "components/misc/save-button";
import SelectWithDefault from "components/misc/select-with-default";
import useDatabase from "lib/hooks/database";

/*
WARNING: the code below is some pretty complicated use of React hooks,
in order to make the API it exports simple and easy to use with minimal
replication of code.

For example, we have to inroduce editRef and a complicated setEdited
below so that users don't have to explicitly pass setEdited into
components like EditNumber, which would be annoying, tedious and silly.
The code is complicated due to how hooks work, when components get created
and updated, etc.  Say to yourself: "I still know closure fu."
*/

interface Options {
  onSave?: Function;
  noSave?: boolean;
}

interface HeadingProps {
  path?: string;
  title?: string;
  desc?: ReactNode;
  icon?: IconName;
}

interface EditBooleanProps {
  path: string;
  title?: string;
  desc?: ReactNode;
  label?: ReactNode;
  icon?: IconName;
}

export default function useEditTable<T extends object>(
  query: object,
  options?: Options,
) {
  const { loading, value } = useDatabase(query);
  const [original, setOriginal] = useState<T | undefined>(undefined);
  const [edited, setEdited0] = useState<T | undefined>(undefined);
  const [counter, setCounter] = useState<number>(0);
  const editedRef = useRef<T | undefined>(edited);
  editedRef.current = edited;

  function setEdited(update, path?: string) {
    if (!path) {
      // usual setEdited
      setEdited0(update);
      // force a full update
      setCounter(counter + 1);
      return;
    }
    if (editedRef.current == null) return;
    // just edit part of object.
    set(editedRef.current, path, update);
    setEdited0({ ...editedRef.current } as T);
  }

  useEffect(() => {
    if (!loading) {
      setOriginal(cloneDeep(value[keys(value)[0]]));
      setEdited(value[keys(value)[0]]);
    }
  }, [loading]);

  function Save() {
    if (edited == null || original == null || options?.noSave) return null;
    return (
      <div>
        <SaveButton
          style={{ marginBottom: "10px" }}
          edited={edited}
          original={original}
          setOriginal={setOriginal}
          table={keys(query)[0]}
          onSave={options?.onSave}
        />
      </div>
    );
  }

  function Heading(props: HeadingProps) {
    const { path, title, icon, desc } = props;
    return (
      <>
        <Title level={3}>
          {icon && <Icon name={icon} style={{ marginRight: "10px" }} />}
          {getTitle(path, title)}
        </Title>
        {desc && <Paragraph>{desc}</Paragraph>}
      </>
    );
  }

  function EditBoolean(props: EditBooleanProps) {
    const { path, title, desc, label, icon } = props;
    return (
      <Space direction="vertical" style={{ marginTop: "15px" }}>
        <Heading path={path} title={title} icon={icon} desc={desc} />
        <Checkbox
          defaultValue={get(
            SCHEMA[keys(query)[0]].user_query?.get?.fields,
            path,
          )}
          checked={get(edited, path)}
          onChange={(checked) => {
            setEdited(checked, path);
          }}
        >
          {getLabel(path, title, label)}
        </Checkbox>
      </Space>
    );
  }

  // It's very important EditNumber isn't recreated once
  // edited and original are both not null, since the text
  // field would then lose focus.  Also, it has to not be
  // a controlled component, since otherwise edited has to
  // be passed in externally, which is very awkward.
  const EditNumber = useMemo(() => {
    if (edited == null || original == null) return () => null;
    return ({
      path,
      title,
      desc,
      units,
      min,
      max,
      icon,
    }: {
      path: string;
      title?: string;
      desc?: ReactNode;
      units?: string;
      min: number;
      max: number;
      icon?: IconName;
    }) => (
      <Space direction="vertical" style={{ width: "100%" }}>
        <Heading path={path} title={title} icon={icon} desc={desc} />
        <IntegerSlider
          defaultValue={get(
            SCHEMA[keys(query)[0]].user_query?.get?.fields,
            path,
          )}
          initialValue={get(edited, path)}
          onChange={(value) => {
            setEdited(value, path);
          }}
          min={min}
          max={max}
          units={units}
        />
      </Space>
    );
  }, [edited == null, original == null, counter]);

  const EditSelect = useMemo(() => {
    if (edited == null || original == null) return () => null;
    return ({
      path,
      title,
      desc,
      icon,
      options,
      style,
      defaultValue,
    }: {
      path: string;
      title?: string;
      desc?: ReactNode;
      icon?: IconName;
      options: { [value: string]: ReactNode } | string[];
      style?: CSSProperties;
      defaultValue?: string;
    }) => (
      <Space direction="vertical">
        <Heading path={path} title={title} icon={icon} desc={desc} />
        <SelectWithDefault
          style={style}
          defaultValue={
            defaultValue ??
            get(SCHEMA[keys(query)[0]].user_query?.get?.fields, path)
          }
          initialValue={get(edited, path)}
          onChange={(value) => {
            setEdited(value, path);
          }}
          options={options}
        />
      </Space>
    );
  }, [edited == null, original == null, counter]);

  return {
    edited,
    original,
    Save,
    setEdited,
    EditBoolean,
    EditNumber,
    EditSelect,
    Heading,
  };
}

function getTitle(path?: string, title?: string): string {
  if (title) return title;
  if (!path) return "";
  const v = path.split(".");
  return v[v.length - 1].split("_").map(capitalize).join(" ");
}

function getLabel(path: string, title?: string, label?: ReactNode): ReactNode {
  return label ?? capitalize(getTitle(path, title).toLowerCase());
}
