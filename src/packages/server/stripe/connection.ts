/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

/*
The stripe connection object, which communicates with the remote stripe server.

Configure via the admin panel in account settings of an admin user.

Throws an error if stripe is not configured.

Double checks with database once per minute to see if the keys have changed,
and if so will return new stripe object.
*/

import Stripe from "stripe";
import { getServerSettings } from "@cocalc/database/settings";

// See https://stripe.com/docs/api/versioning
//const apiVersion = "2025-02-24.acacia";
const apiVersion = "2024-12-18.acacia" as any;

interface StripeWithPublishableKey extends Stripe {
  publishable_key: string;
}

let stripe: StripeWithPublishableKey | undefined = undefined;
let key: string = "";
let last: number = 0;
export async function getConn(): Promise<StripeWithPublishableKey> {
  if (stripe != null && Date.now() - last <= 1000 * 60) {
    return stripe;
  }
  const { stripe_publishable_key, stripe_secret_key } =
    await getServerSettings();
  if (!stripe_publishable_key) {
    throw Error(
      "stripe publishable key is not set -- billing functionality not available",
    );
  }
  if (!stripe_secret_key) {
    throw Error(
      "stripe secret key is not set -- billing functionality not available",
    );
  }
  if (stripe == null || key != stripe_publishable_key + stripe_secret_key) {
    key = stripe_publishable_key + stripe_secret_key;
    stripe = new Stripe(stripe_secret_key, {
      apiVersion,
    }) as StripeWithPublishableKey;
    stripe.publishable_key = stripe_publishable_key;
    last = Date.now();
  }
  return stripe;
}

export default getConn;
