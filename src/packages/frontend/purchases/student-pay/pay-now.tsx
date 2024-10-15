import { Alert, Button, Divider, Modal, Space, Spin } from "antd";
import { useEffect, useState } from "react";
import type { PurchaseInfo } from "@cocalc/util/licenses/purchase/types";
import dayjs from "dayjs";
import { Icon, TimeAgo } from "@cocalc/frontend/components";
import { zIndexPayAsGo } from "../zindex";
import Cost, { getCost } from "./cost";
import { isPurchaseAllowed, studentPay } from "../api";
import { webapp_client } from "@cocalc/frontend/webapp-client";
import { redux } from "@cocalc/frontend/app-framework";
import PayLink from "./pay-link";
import Transfer from "./transfer";
import { currency } from "@cocalc/util/misc";

interface Props {
  when: dayjs.Dayjs;
  purchaseInfo: PurchaseInfo;
  project_id: string;
  open: boolean;
  setOpen?: (open: boolean) => void;
}

export default function PayNow({
  when,
  purchaseInfo,
  project_id,
  open,
  setOpen,
}: Props) {
  const [purchasing, setPurchasing] = useState<boolean>(false);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [reason, setReason] = useState<string | undefined | null>(null);
  const [chargeAmount, setChargeAmount] = useState<number | undefined>(
    undefined,
  );
  const [error, setError] = useState<string>("");
  const update = async (addBalance = false) => {
    const cost = getCost(purchaseInfo);
    try {
      let { allowed, reason, chargeAmount } = await isPurchaseAllowed(
        "license",
        cost,
      );
      if (open && addBalance) {
        if (!allowed) {
          await webapp_client.purchases_client.quotaModal({
            service: "license",
            reason,
            allowed,
            cost,
          });
        }
        ({ allowed, reason, chargeAmount } = await isPurchaseAllowed(
          "license",
          cost,
        ));
      }
      setAllowed(allowed);
      setReason(reason);
      setChargeAmount(chargeAmount);
    } catch (err) {
      setError(`${err}`);
    }
  };
  useEffect(() => {
    update();
  }, [purchaseInfo]);
  const completePurchase = async () => {
    try {
      setPurchasing(true);
      await studentPay(project_id);
    } catch (err) {
      setError(`${err}`);
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <Modal
      closable={setOpen != null}
      open={open}
      zIndex={zIndexPayAsGo - 1}
      destroyOnClose
      footer={null}
      onOk={() => setOpen?.(false)}
      onCancel={() => setOpen?.(false)}
      title={
        <>
          <Icon name="credit-card" style={{ marginRight: "10px" }} /> Pay the
          course fee to upgrade this project
        </>
      }
    >
      {error && (
        <Alert
          closable
          type="error"
          message={error}
          onClose={() => setError("")}
        />
      )}
      Due: <TimeAgo date={when} />
      <div style={{ textAlign: "center", fontSize: "15pt" }}>
        <Cost purchaseInfo={purchaseInfo} />
      </div>
      <Divider />
      {allowed == null && <Spin />}
      {allowed != null && (
        <>
          <div style={{ textAlign: "center" }}>
            {allowed && (
              <div>
                <Button
                  disabled={purchasing}
                  size="large"
                  type="primary"
                  onClick={completePurchase}
                >
                  Complete Purchase...{" "}
                  {purchasing && <Spin style={{ marginLeft: "15px" }} />}
                </Button>
                <Alert
                  showIcon
                  style={{ marginTop: "15px " }}
                  type="success"
                  message="You have enough credits to complete this purchase."
                />
              </div>
            )}
            {!allowed && (
              <Button size="large" onClick={() => update(true)} type="primary">
                <Icon name="credit-card" /> Add{" "}
                {chargeAmount ? currency(chargeAmount) : ""} Credit to Your
                Account...
              </Button>
            )}
          </div>
          {!allowed && reason && (
            <Alert
              style={{ marginTop: "15px" }}
              type="warning"
              showIcon
              message="Add Credit"
              description={reason}
            />
          )}
        </>
      )}
      <Divider>Other Options</Divider>
      <Space direction="vertical">
        <PayLink project_id={project_id} />
        <Transfer project_id={project_id} />
        <Button
          onClick={() => {
            const actions = redux.getActions("page");
            if (actions != null) {
              actions.close_project_tab(project_id);
            }
          }}
        >
          Close Project
        </Button>
      </Space>
    </Modal>
  );
}
//      <pre>{JSON.stringify({ allowed, reason }, undefined, 2)}</pre>
//      <pre>{JSON.stringify(purchaseInfo, undefined, 2)}</pre>
