/*

The subscriptions look like this in the database:

[
  {
    id: 1,
    account_id: "8e138678-9264-431c-8dc6-5c4f6efe66d8",
    created: "2023-07-03T03:40:51.798Z",
    cost: 5.4288,
    interval: "month",
    current_period_start: "2023-07-02T07:00:00.000Z",
    current_period_end: "2023-08-03T06:59:59.999Z",
    latest_purchase_id: 220,
    status: "active",
    metadata: {
      type: "license",
      license_id: "a3e17422-8f09-48d4-bc34-32f0bdc77f73",
    },
  },
];
*/

import {
  Alert,
  Button,
  Collapse,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Table,
  Tag,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";

import { Icon } from "@cocalc/frontend/components/icon";
import { SettingBox } from "@cocalc/frontend/components/setting-box";
import { TimeAgo } from "@cocalc/frontend/components/time-ago";
import { labels } from "@cocalc/frontend/i18n";
import { SiteLicensePublicInfo } from "@cocalc/frontend/site-licenses/site-license-public-info-component";
import { webapp_client } from "@cocalc/frontend/webapp-client";
import type { License } from "@cocalc/util/db-schema/site-licenses";
import type { Subscription } from "@cocalc/util/db-schema/subscriptions";
import { STATUS_TO_COLOR } from "@cocalc/util/db-schema/subscriptions";
import { capitalize, currency, round2up } from "@cocalc/util/misc";
import {
  cancelSubscription,
  costToResumeSubscription,
  creditToCancelSubscription,
  getLicense,
  getSubscriptions as getSubscriptionsUsingApi,
  renewSubscription,
  resumeSubscription,
} from "./api";
import Export from "./export";
import Refresh from "./refresh";
import UnpaidSubscriptions from "./unpaid-subscriptions";

// Cancel immediately makes it pointless to ever buy a license without
// buying a subscription, since you can just buy a license via a subscription,
// get a big discount, and cancel exactly at the end of the period. Hence
// disabling this for now, unless we come up with something better.  This
// flag can be toggled to turn the functionality back on.
const SUPPORT_CANCEL_IMMEDIATELY = false;

export function SubscriptionStatus({ status }) {
  return (
    <Tag color={STATUS_TO_COLOR[status]}>
      {capitalize(status.replace("_", " "))}
    </Tag>
  );
}

function SubscriptionActions({
  subscription_id,
  license_id,
  status,
  refresh,
  cost,
  interval,
}) {
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [license, setLicense] = useState<License | null>(null);

  const updateLicense = async () => {
    try {
      setLicense(await getLicense(license_id));
    } catch (err) {
      setError(`${err}`);
    }
  };

  const [costToResume, setCostToResume] = useState<number | undefined>(
    undefined,
  );
  const [periodicCost, setPeriodicCost] = useState<number | undefined>(
    undefined,
  );
  const updateCostToResume = async () => {
    try {
      const { cost, periodicCost } = await costToResumeSubscription(
        subscription_id,
      );
      setCostToResume(cost);
      setPeriodicCost(periodicCost);
      return cost;
    } catch (err) {
      setError(`${err}`);
    }
  };

  const [creditToCancel, setCreditToCancel] = useState<number | undefined>(
    undefined,
  );
  const updateCreditToCancel = async () => {
    try {
      const cost = await creditToCancelSubscription(subscription_id);
      setCreditToCancel(-cost);
      return cost;
    } catch (err) {
      setError(`${err}`);
    }
  };

  const handleCancel = async (now: boolean = false) => {
    try {
      setLoading(true);
      setError("");
      await cancelSubscription({ subscription_id, now });
      refresh();
    } catch (error) {
      setError(`${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResume = async () => {
    try {
      setLoading(true);
      setError("");
      try {
        await resumeSubscription(subscription_id);
      } catch (_) {
        cost = await updateCostToResume();
        await webapp_client.purchases_client.quotaModal({
          service: "edit-license",
          cost,
        });
        await resumeSubscription(subscription_id);
      }
      refresh();
    } catch (error) {
      setError(`${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRenewSubscription = async () => {
    try {
      setLoading(true);
      setError("");
      try {
        await renewSubscription(subscription_id);
      } catch (_) {
        await webapp_client.purchases_client.quotaModal({
          service: "edit-license",
          cost,
        });
        await renewSubscription(subscription_id);
      }
      refresh();
    } catch (error) {
      setError(`${error}`);
    } finally {
      setLoading(false);
    }
  };

  const footer = [
    <Button
      disabled={loading}
      key="nothing"
      onClick={() => setModalOpen(false)}
      type="primary"
    >
      No Change
    </Button>,
  ];
  if (SUPPORT_CANCEL_IMMEDIATELY) {
    footer.push(
      <Popconfirm
        key="cancelNow"
        title={"Cancel this subscription immediately?"}
        description={() => {
          setTimeout(updateCreditToCancel, 1);
          if (creditToCancel == null) {
            return <Spin />;
          }

          return (
            <div style={{ maxWidth: "450px" }}>
              The license will immediately become invalid and any projects using
              it will stop.
              {license?.info?.purchased.type == "disk" && (
                <b> All data on the disk will be permanently deleted.</b>
              )}{" "}
              You will receive a <b>credit of {currency(creditToCancel)}</b> for
              the prorated time left on the subscription. There are no
              transaction fees for canceling or resuming a subscription, and you
              can resume your subscription at any point later.
            </div>
          );
        }}
        onConfirm={() => handleCancel(true)}
        okText="Yes"
        cancelText="No"
      >
        <Button disabled={loading} danger>
          Cancel Now...
        </Button>
      </Popconfirm>,
    );
  }
  footer.push(
    <Popconfirm
      key="cancelEnd"
      title={"Cancel this subscription at period end?"}
      description={
        <div style={{ maxWidth: "450px" }}>
          <FormattedMessage
            id="purchases.subscriptions.cancel-end.description"
            defaultMessage={
              "The license will still be valid until the subscription period ends. You can always restart the subscription or edit the license to change the subscription price."
            }
          />
        </div>
      }
      onConfirm={() => handleCancel(false)}
      okText="Yes"
      cancelText="No"
    >
      <Button disabled={loading}>Cancel at Period End...</Button>
    </Popconfirm>,
  );

  return (
    <Space direction="vertical">
      {loading && <Spin />}
      {error && !loading && (
        <Alert
          type="error"
          description={error}
          style={{ marginBottom: "15px" }}
          closable
          onClose={() => setError("")}
        />
      )}
      {(status === "unpaid" || status === "past_due") && (
        <Popconfirm
          title={
            <div style={{ maxWidth: "450px" }}>
              Are you sure you want to pay for the next month of this
              subscription? The corresponding license will be renewed and your
              balance will be reduced by the subscription amount.
            </div>
          }
          onConfirm={handleRenewSubscription}
          okText="Yes"
          cancelText="No"
        >
          <Button disabled={loading} type="primary">
            Pay Now...
          </Button>
        </Popconfirm>
      )}
      {status !== "canceled" && (
        <Button
          disabled={loading}
          type="default"
          onClick={() => {
            updateLicense();
            setModalOpen(true);
          }}
        >
          Cancel...
        </Button>
      )}
      {status !== "canceled" && modalOpen && (
        <Modal
          title="Cancel Subscription"
          open={modalOpen}
          onCancel={() => setModalOpen(false)}
          footer={footer}
        >
          <div style={{ maxWidth: "450px" }}>
            Are you sure you want to cancel this subscription? The corresponding
            license will not be renewed.
            <ul style={{ margin: "15px 0" }}>
              <li>
                Select "Cancel at Period End" to cancel your subscription. You
                have already paid for your license, so it will continue to the
                end of the current period.
              </li>
              <li>
                You can always edit the license, which will change the
                subscription price. Click the license code to the left, then
                click "Edit License..."
              </li>
              {SUPPORT_CANCEL_IMMEDIATELY && (
                <li>
                  To receive a prorated credit for the remainder of this
                  license, select "Cancel Now". You can spend your
                  non-refundable credit on another license, pay-as-you-go
                  project upgrades, etc.
                </li>
              )}
              <li>You can resume a canceled subscription later.</li>
            </ul>
            {license?.info?.purchased.type == "disk" && (
              <Alert
                showIcon
                type="warning"
                message="Dedicated Disk"
                description="This is a dedicated disk, so when the license ends, all data on the disk will be permanently deleted."
              />
            )}
            {loading && (
              <div style={{ textAlign: "center" }}>
                <Spin />
              </div>
            )}
          </div>
        </Modal>
      )}
      {status == "canceled" && (
        <Popconfirm
          title={"Resume this subscription?"}
          description={() => {
            setTimeout(updateCostToResume, 1);
            if (costToResume == null) {
              return <Spin />;
            }
            return (
              <div style={{ maxWidth: "450px" }}>
                The corresponding license will become active again, and{" "}
                <b>you will be charged {currency(round2up(costToResume))}</b>{" "}
                for the remainder of the current period.
                {periodicCost != null && (
                  <span>
                    {" "}
                    The cost will then be{" "}
                    <b>
                      {currency(round2up(periodicCost))}/{interval}
                    </b>
                    , which is the current rate.
                  </span>
                )}
              </div>
            );
          }}
          onConfirm={handleResume}
          okText="Yes"
          cancelText="No"
        >
          <Button disabled={loading} type="default">
            Resume...
          </Button>
        </Popconfirm>
      )}
    </Space>
  );
}

function LicenseDescription({ license_id, refresh }) {
  return (
    <Collapse
      items={[
        {
          key: "license",
          label: `License: ${license_id}`,
          children: (
            <SiteLicensePublicInfo license_id={license_id} refresh={refresh} />
          ),
        },
      ]}
    />
  );
}

export default function Subscriptions() {
  const intl = useIntl();

  const [subscriptions, setSubscriptions] = useState<Subscription[] | null>(
    null,
  );
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [counter, setCounter] = useState<number>(0);

  const getSubscriptions = async () => {
    try {
      setLoading(true);
      setError("");
      // [ ] TODO: pager, which is only needed if one user has more than 100 subscriptions...
      const subs = await getSubscriptionsUsingApi({ limit: 100 });
      // sorting like this is nice, but it is very confusing when you change state of the
      // subscription and then the one you just paid moves.
      /*
      subs.sort((a, b) => {
        if (a.status == "unpaid" || a.status == "past_due") {
          return -1;
        }
        if (b.status == "unpaid" || b.status == "past_due") {
          return +1;
        }
        if (a.status == "canceled") {
          return 1;
        }
        if (b.status == "canceled") {
          return -1;
        }
        return -cmp(a.id, b.id);
      });
      */
      setSubscriptions(subs);
    } catch (err) {
      setError(`${err}`);
    } finally {
      setLoading(false);
      setCounter(counter + 1);
    }
  };

  useEffect(() => {
    getSubscriptions();
  }, []);

  const columns = useMemo(
    () => [
      {
        title: "Id",
        dataIndex: "id",
        key: "id",
      },
      {
        width: "40%",
        title: "Description",
        key: "desc",
        render: (_, { metadata }) => {
          if (metadata.type == "license" && metadata.license_id) {
            return (
              <LicenseDescription
                license_id={metadata.license_id}
                refresh={getSubscriptions}
              />
            );
          }
          return <>{JSON.stringify(metadata, undefined, 2)}</>;
        },
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        render: (status) => <SubscriptionStatus status={status} />,
      },
      {
        title: "Period",
        dataIndex: "interval",
        key: "interval",
        render: (interval) => {
          if (interval == "month") {
            return "Monthly";
          } else if (interval == "year") {
            return "Yearly";
          } else {
            return interval;
          }
        },
      },
      {
        title: "Cost",
        dataIndex: "cost",
        key: "cost",
        render: (cost, record) => {
          // in prod we hit a case where cost was null, hence the if here.
          if (record.status == "active" && cost != null) {
            return `${currency(round2up(cost))}/${record.interval}`;
          } else {
            return "-";
          }
        },
      },

      {
        width: "15%",
        title: "Current Period",
        key: "period",
        render: (_, record) => {
          return (
            <>
              <TimeAgo date={record.current_period_start} /> to{" "}
              <TimeAgo date={record.current_period_end} />
            </>
          );
        },
      },
      {
        title: "Last Transaction Id",
        dataIndex: "latest_purchase_id",
        key: "latest_purchase_id",
      },
      {
        title: "Action",
        key: "action",
        render: (_, { cost, id, metadata, status, interval }) => (
          <SubscriptionActions
            subscription_id={id}
            license_id={metadata.license_id}
            status={status}
            refresh={getSubscriptions}
            cost={cost}
            interval={interval}
          />
        ),
      },
      {
        title: "Created",
        dataIndex: "created",
        key: "created",
        render: (date) => <TimeAgo date={date} />,
      },
    ],
    [],
  );

  return (
    <SettingBox
      title={
        <>
          <Icon name="calendar" /> {intl.formatMessage(labels.subscriptions)}
          <Refresh
            handleRefresh={getSubscriptions}
            style={{ marginLeft: "30px" }}
          />
          <div style={{ marginLeft: "15px", float: "right", display: "flex" }}>
            <Export
              data={subscriptions}
              name="subscriptions"
              style={{ marginLeft: "8px" }}
            />
          </div>
        </>
      }
    >
      {error && (
        <Alert
          type="error"
          description={error}
          style={{ marginBottom: "15px" }}
        />
      )}
      {loading ? (
        <Spin />
      ) : (
        <div style={{ overflow: "auto", width: "100%" }}>
          <UnpaidSubscriptions
            size="large"
            style={{ margin: "15px 0", textAlign: "center" }}
            showWhen="unpaid"
            counter={counter}
            refresh={getSubscriptions}
          />
          <Table
            rowKey={"id"}
            pagination={{ hideOnSinglePage: true, defaultPageSize: 25 }}
            dataSource={subscriptions ?? undefined}
            columns={columns}
          />
        </div>
      )}
    </SettingBox>
  );
}
