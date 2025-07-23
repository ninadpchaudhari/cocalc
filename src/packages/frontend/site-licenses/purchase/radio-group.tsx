/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

// Convenience function, mainly to make it easier to make vertical radio components,
// since that's sligthtly awkward with antd.

import { CSS } from "../../app-framework";
import { Radio } from "antd";
import { Icon, IconName } from "../../components";

interface Props {
  disabled?: boolean;
  options: {
    label: string;
    value: any;
    disabled?: boolean;
    desc?: string | React.JSX.Element;
    cost?: string;
    icon?: IconName;
  }[];
  onChange: (e) => void;
  value?: any;
  radioStyle?: CSS;
}

export const RadioGroup: React.FC<Props> = ({
  disabled,
  options,
  onChange,
  value,
  radioStyle,
}) => {
  const v: React.JSX.Element[] = [];
  for (const x of options) {
    v.push(
      <Radio
        style={radioStyle}
        value={x.value}
        disabled={x.disabled}
        key={x.value}
      >
        <span style={{ fontSize: "12pt" }}>
          {x.icon && (
            <span style={{ display: "inline-block", width: "25px" }}>
              <Icon name={x.icon} />{" "}
            </span>
          )}
          <b>{x.label}</b>
          {x.cost ? ` (${x.cost})` : undefined}
          {x.desc && <> - {x.desc}</>}
        </span>
      </Radio>
    );
  }

  return (
    <div style={{ marginLeft: "30px" }}>
      <Radio.Group onChange={onChange} value={value} disabled={disabled}>
        {v}
      </Radio.Group>
    </div>
  );
};
