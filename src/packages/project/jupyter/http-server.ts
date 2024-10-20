/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

/*
HTTP server for getting various information from Jupyter, without
having to go through the websocket connection and messaging.  This is
useful, e.g., for big images, general info about all available
kernels, sending signals, doing tab completions, and so on.
*/

import { Router } from "express";
import * as os_path from "node:path";
import getLogger from "@cocalc/backend/logger";
import { BlobStoreInterface } from "@cocalc/jupyter/types/project-interface";
import { startswith, to_json } from "@cocalc/util/misc";
import { exists } from "@cocalc/backend/misc/async-utils-node";
import { get_existing_kernel } from "@cocalc/jupyter/kernel";
import {
  BlobStoreDisk,
  get_blob_store,
  BlobStoreSqlite,
} from "@cocalc/jupyter/blobs";
import { get_kernel_data } from "@cocalc/jupyter/kernel/kernel-data";
import { get_ProjectStatusServer } from "@cocalc/sync-server/monitor/status-and-alerts";
import { delay } from "awaiting";

const log = getLogger("jupyter-http-server");

const BASE = "/.smc/jupyter/";

function get_kernel(kernel_data, name) {
  for (const k of kernel_data) {
    if (k.name == name) return k;
  }
  return null;
}

function jupyter_kernel_info_handler(router): void {
  router.get(
    BASE + "ipywidgets-get-buffer",
    async function (req, res): Promise<void> {
      try {
        const { path, model_id, buffer_path } = req.query;
        const kernel = get_existing_kernel(path);
        if (kernel == null) {
          res.status(404).send(`kernel associated to ${path} does not exist`);
          return;
        }
        const buffer = kernel.ipywidgetsGetBuffer(model_id, buffer_path);
        if (buffer == null) {
          res
            .status(404)
            .send(
              `buffer associated to model ${model_id} at ${buffer_path} not known`
            );
          return;
        }
        res.status(200).send(buffer);
      } catch (err) {
        res.status(500).send(`Error getting ipywidgets buffer - ${err}`);
      }
    }
  );

  // we are only actually using this to serve up the logo.
  router.get(BASE + "kernelspecs/*", async function (req, res): Promise<void> {
    try {
      const kernel_data = await get_kernel_data();
      let path = req.path.slice((BASE + "kernelspecs/").length).trim();
      if (path.length === 0) {
        res.json(kernel_data);
        return;
      }
      const segments = path.split("/");
      const name = segments[0];
      const kernel = get_kernel(kernel_data, name);
      if (kernel == null) {
        const msg = `no such kernel '${name}'`;
        throw Error(msg);
      }
      const resource_dir = kernel.resource_dir;
      path = os_path.join(resource_dir, segments.slice(1).join("/"));
      path = os_path.resolve(path);

      if (!startswith(path, resource_dir)) {
        // don't let user use .. or something to get any file on the server...!
        // (this really can't happen due to url rules already; just being super paranoid.)
        throw Error(`suspicious path '${path}'`);
      }
      if (await exists(path)) {
        res.sendFile(path);
      } else {
        throw Error(`no such path '${path}'`);
      }
    } catch (err) {
      res.status(500).send(err.toString());
    }
  });
}

export default async function init(): Promise<Router> {
  // this might take infinitely long, obviously:
  let blob_store: BlobStoreSqlite | BlobStoreDisk;
  let d = 3000;
  while (true) {
    try {
      // This call right here causes the configured blobstore to be initialized in the file
      // packages/jupyter/blobs/get.ts
      blob_store = await get_blob_store();
      get_ProjectStatusServer().clearComponentAlert("BlobStore");
      break;
    } catch (err) {
      get_ProjectStatusServer().setComponentAlert("BlobStore");
      log.warn(`unable to instantiate BlobStore -- ${err}`);
    }
    await delay(d);
    d = Math.min(30000, 1.2 * d);
  }

  log.debug("got blob store, setting up jupyter http server");
  const router = Router();

  // Install handling for the blob store
  jupyter_blobstore_handler(router, blob_store);

  // Handler for Jupyter kernel info
  jupyter_kernel_info_handler(router);

  return router;
}

function jupyter_blobstore_handler(
  router: Router,
  blob_store: BlobStoreInterface
): void {
  const base = BASE + "blobs/";

  router.get(base, async (_, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(to_json(await blob_store.keys()));
  });

  router.get(base + "*", async (req, res) => {
    const filename: string = req.path.slice(base.length);
    const sha1: string = `${req.query.sha1}`;
    res.type(filename);
    res.send(await blob_store.get(sha1));
  });
}
