/*
SyncFS Server Service, which runs in the home base.
*/

import { createSyncFsServerService } from "@cocalc/nats/service/syncfs-server";
import { type SyncFS } from "../index";

export async function initNatsServerService({
  syncfs,
  project_id,
}: {
  syncfs: SyncFS;
  project_id: string;
}) {
  console.log("not used at all yet", typeof syncfs);
  const impl = {};
  return await createSyncFsServerService({
    project_id,
    impl,
  });
}
