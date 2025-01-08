/*
 *  This file is part of CoCalc: Copyright © 2022 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

import React, { useContext } from "react";
import { Button, Menu, MenuProps, Flex, Spin } from "antd";
import { useRouter } from "next/router";
import { currency, round2down } from "@cocalc/util/misc";
import { COLORS } from "@cocalc/util/theme";
import { Icon } from "@cocalc/frontend/components/icon";
import { StoreBalanceContext } from "../../lib/balance";

type MenuItem = Required<MenuProps>["items"][number];

const styles: { [k: string]: React.CSSProperties } = {
  menuBookend: {
    height: "100%",
    whiteSpace: "nowrap",
    flexGrow: 1,
    textAlign: "end",
  },
  menu: {
    width: "100%",
    height: "100%",
    border: 0,
  },
  menuRoot: {
    marginBottom: "24px",
    alignItems: "center",
    border: 0,
    borderBottom: "1px solid rgba(5, 5, 5, 0.06)",
    boxShadow: "none",
  },
  menuContainer: {
    alignItems: "center",
    whiteSpace: "nowrap",
    maxWidth: "100%",
    flexGrow: 1,
  },
};

export interface ConfigMenuProps {
  main?: string;
}

export default function ConfigMenu({ main }: ConfigMenuProps) {
  const router = useRouter();
  const { balance, refreshBalance, loading } = useContext(StoreBalanceContext);

  const handleMenuItemSelect: MenuProps["onSelect"] = ({ keyPath }) => {
    router.push(`/store/${keyPath[0]}`, undefined, {
      scroll: false,
    });
    refreshBalance();
    setTimeout(() => {
      refreshBalance();
    }, 7500);
  };

  const items: MenuItem[] = [
    {
      label: "Licenses",
      key: "site-license",
      icon: <Icon name="key" />,
    },
    {
      label: "Vouchers",
      key: "vouchers",
      icon: <Icon name="gift" />,
    },
    {
      label: "Cart",
      key: "cart",
      icon: <Icon name="shopping-cart" />,
    },
    {
      label: "Checkout",
      key: "checkout",
      icon: <Icon name="list" />,
    },
    {
      label: "Processing",
      key: "processing",
      icon: <Icon name="run" />,
    },
    {
      label: "Congrats",
      key: "congrats",
      icon: <Icon name="check-circle" />,
    },
  ];

  return (
    <Flex
      gap="middle"
      justify="space-between"
      style={styles.menuRoot}
      wrap="wrap"
    >
      <Flex style={styles.menuContainer} align="center">
        <strong>
          <a
            onClick={() => {
              router.push("/store", undefined, {
                scroll: false,
              });
            }}
            style={{ color: COLORS.GRAY_D, marginRight: "12px" }}
          >
            Store
          </a>
        </strong>
        <Menu
          mode="horizontal"
          selectedKeys={main ? [main] : undefined}
          style={styles.menu}
          onSelect={handleMenuItemSelect}
          items={items}
        />
      </Flex>
      <Button
        type="text"
        style={styles.menuBookend}
        onClick={() => {
          refreshBalance();
        }}
      >
        {balance !== undefined
          ? `Balance: ${currency(round2down(balance))}`
          : null}
        {loading && (
          <Spin delay={2000} size="small" style={{ marginLeft: "15px" }} />
        )}
      </Button>
    </Flex>
  );
}
