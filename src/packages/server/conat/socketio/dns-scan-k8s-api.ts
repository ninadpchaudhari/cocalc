import { readFile } from "fs/promises";
import * as https from "https";

import type { PodInfos } from "./dns-scan";

// Define the options interface for type safety
interface ListPodsOptions {
  labelSelector?: string; // e.g. "app=foo,env=prod"
}

let NAMESPACE: string | null = null;
let CA: string | null = null;

async function readK8sFile(filename: string): Promise<string> {
  const basePath = "/var/run/secrets/kubernetes.io/serviceaccount";
  return (await readFile(`${basePath}/${filename}`, "utf8")).trim();
}

async function listPods(options: ListPodsOptions = {}): Promise<any> {
  let token: string;
  try {
    NAMESPACE ??= await readK8sFile("namespace");
    CA ??= await readK8sFile("ca.crt");

    // Read service account details, token could be rotated, so read every time
    token = await readK8sFile("token");
  } catch (err) {
    throw new Error(`Failed to read service account files: ${err}`);
  }

  // Base API path
  let path = `/api/v1/namespaces/${NAMESPACE}/pods`;

  const queryParams: string[] = [];
  if (options.labelSelector) {
    queryParams.push(
      `labelSelector=${encodeURIComponent(options.labelSelector)}`,
    );
  }

  if (queryParams.length > 0) {
    path += `?${queryParams.join("&")}`;
  }

  const query: https.RequestOptions = {
    hostname: "kubernetes.default.svc",
    path,
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    ca: [CA],
  };

  return new Promise((resolve, reject) => {
    const req = https.request(query, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        if (res.statusCode !== 200) {
          reject(
            new Error(
              `K8S API request failed. status=${res.statusCode}: ${data}`,
            ),
          );
        } else {
          try {
            resolve(JSON.parse(data));
          } catch (parseError) {
            reject(parseError);
          }
        }
      });
    });

    req.on("error", (error) => reject(error));
    req.end();
  });
}

export async function getAddressesFromK8sApi(): Promise<PodInfos> {
  const res = await listPods({ labelSelector: "run=hub-conat-router" });
  const ret: PodInfos = [];
  for (const pod of res.items) {
    const name = pod.metadata?.name;
    const podIP = pod.status?.podIP;
    if (name && podIP) {
      ret.push({ name, podIP });
    }
  }
  return ret;
}
