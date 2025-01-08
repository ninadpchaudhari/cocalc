/*
Let user get all of their purchases
*/

import getAccountId from "lib/account/get-account";
import getPurchases from "@cocalc/server/purchases/get-purchases";
import getParams from "lib/api/get-params";
import { apiRoute, apiRouteOperation } from "lib/api";
import {
  GetPurchasesInputSchema,
  GetPurchasesOutputSchema,
} from "lib/api/schema/purchases/get-purchases";
import throttle from "@cocalc/util/api/throttle";

async function handle(req, res) {
  try {
    res.json(await get(req));
  } catch (err) {
    res.json({ error: `${err.message}` });
    return;
  }
}

async function get(req) {
  const account_id = await getAccountId(req);
  if (!account_id) {
    throw Error("must be signed in");
  }
  throttle({
    account_id,
    endpoint: "purchases/get-purchases",
  });
  const {
    limit,
    offset,
    service,
    project_id,
    group,
    cutoff,
    thisMonth,
    day_statement_id,
    month_statement_id,
    no_statement,
    compute_server_id,
  } = getParams(req);
  return await getPurchases({
    cutoff,
    thisMonth,
    limit,
    offset,
    service,
    account_id,
    project_id,
    group,
    day_statement_id,
    month_statement_id,
    no_statement,
    compute_server_id,
  });
}

export default apiRoute({
  getPurchases: apiRouteOperation({
    method: "POST",
    openApiOperation: {
      tags: ["Purchases"],
    },
  })
    .input({
      contentType: "application/json",
      body: GetPurchasesInputSchema,
    })
    .outputs([
      {
        status: 200,
        contentType: "application/json",
        body: GetPurchasesOutputSchema,
      },
    ])
    .handler(handle),
});
