import { Button, Card, Input, Space, Spin } from "antd";
import { useEffect, useRef, useState } from "react";
import { path_split, path_to_file, plural } from "@cocalc/util/misc";
import { default_filename } from "@cocalc/frontend/account";
import { useProjectContext } from "@cocalc/frontend/project/context";
import { redux, useRedux } from "@cocalc/frontend/app-framework";
import CheckedFiles from "./checked-files";
import ShowError from "@cocalc/frontend/components/error";
import { PRE_STYLE } from "./action-box";
import { Icon } from "@cocalc/frontend/components/icon";

export default function Download({}) {
  const inputRef = useRef<any>(null);
  const { actions } = useProjectContext();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const project_id = actions?.project_id ?? "";
  const current_path = useRedux(["current_path"], project_id);
  const checked_files = useRedux(["checked_files"], project_id);
  const [target, setTarget] = useState<string>(() => {
    if (checked_files?.size == 1) {
      return path_split(checked_files?.first()).tail;
    }
    return default_filename("", actions?.project_id ?? "");
  });
  const [url, setUrl] = useState<string>("todo");
  const [archiveMode, setArchiveMode] = useState<boolean>(
    (checked_files?.size ?? 0) > 1,
  );

  useEffect(() => {
    if (checked_files == null) {
      return;
    }
    if (checked_files.size > 1) {
      setArchiveMode(true);
      return;
    }
    const file = checked_files.first();
    const isdir = redux.getProjectStore(project_id).get("displayed_listing")
      ?.file_map?.[path_split(file).tail]?.isdir;
    console.log({ isdir });
    setArchiveMode(!!isdir);
    if (!isdir) {
      const store = actions?.get_store();
      setUrl(store?.get_raw_link(file) ?? "");
    }
  }, [checked_files, current_path]);

  useEffect(() => {
    if (!archiveMode) {
      return;
    }
    if (checked_files?.size == 1) {
      setTarget(path_split(checked_files?.first()).tail);
    } else {
      setTarget(default_filename("", actions?.project_id ?? ""));
    }

    setTimeout(() => {
      inputRef.current?.select();
    }, 1);
  }, [archiveMode]);

  const doDownload = async () => {
    if (actions == null || loading) {
      return;
    }
    const store = actions.get_store();
    if (store == null) {
      return;
    }
    try {
      setLoading(true);
      const files = checked_files.toArray();
      let dest;
      if (archiveMode) {
        dest = path_to_file(store.get("current_path"), target + ".zip");
        await actions.zip_files({ src: files, dest });
      } else {
        dest = files[0];
      }
      actions.download_file({ path: dest, log: files });
      await actions.fetch_directory_listing({
        path: store.get("current_path"),
      });
    } catch (err) {
      setLoading(false);
      setError(err);
    } finally {
      setLoading(false);
    }
    actions.set_all_files_unchecked();
    actions.set_file_action();
  };

  if (actions == null) {
    return null;
  }

  return (
    <Card
      title=<>Download {archiveMode ? "files" : "a file"} to your computer</>
    >
      <div style={{ display: "flex" }}>
        <div style={{ flex: 1, overflowX: "auto", marginRight: "15px" }}>
          <CheckedFiles />
        </div>
        {archiveMode && (
          <div style={{ flex: 1 }}>
            <Input
              ref={inputRef}
              autoFocus
              onChange={(e) => setTarget(e.target.value)}
              value={target}
              placeholder="Name of zip archive..."
              onPressEnter={doDownload}
              suffix=".zip"
            />
          </div>
        )}
        {!archiveMode && (
          <div
            style={{
              flex: 1,
              overflowX: "auto",
              display: "flex",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                height: PRE_STYLE.minHeight,
                marginRight: "15px",
              }}
            >
              <a href={url} target="_blank">
                <Icon name="external-link" />
              </a>
            </div>
            <pre style={{ ...PRE_STYLE, height: PRE_STYLE.minHeight }}>
              <a href={url} target="_blank">
                {url}
              </a>
            </pre>
          </div>
        )}
      </div>
      {archiveMode && (
        <Space wrap>
          <Button
            onClick={() => {
              actions?.set_file_action();
            }}
          >
            Cancel
          </Button>{" "}
          <Button onClick={doDownload} type="primary" disabled={loading}>
            <Icon name="cloud-download" /> Compress {checked_files?.size}{" "}
            {plural(checked_files?.size, "item")} and Download {target}.zip{" "}
            {loading && <Spin />}
          </Button>
        </Space>
      )}
      {!archiveMode && (
        <Space wrap>
          <Button
            onClick={() => {
              actions?.set_file_action();
            }}
          >
            Cancel
          </Button>{" "}
          <Button onClick={doDownload} type="primary" disabled={loading}>
            <Icon name="cloud-download" /> Download {loading && <Spin />}
          </Button>
        </Space>
      )}
      <ShowError setError={setError} error={error} />
    </Card>
  );
}
