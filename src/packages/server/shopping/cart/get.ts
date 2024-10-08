/*
Get shopping cart items.  By default gets the current shopping cart,
but you can also get all items that have been removed from the cart,
and also all items that were purchased.
*/

import { assertValidAccountID } from "@cocalc/util/misc";
import getPool from "@cocalc/database/pool";
import { Item } from "@cocalc/util/db-schema/shopping-cart-items";
export type { Item };
import { ensureValidLicenseIntervals } from "./validate";

interface Options {
  account_id: string;
  purchased?: boolean;
  removed?: boolean;
}

export default async function getCart({
  account_id,
  purchased,
  removed,
}: Options): Promise<Item[]> {
  assertValidAccountID(account_id);
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM shopping_cart_items WHERE account_id=$1 AND purchased IS ${
      purchased ? " NOT " : ""
    } NULL AND removed IS ${removed ? " NOT " : ""} NULL ORDER BY id DESC`,
    [account_id],
  );
  await ensureValidLicenseIntervals(rows, pool);
  return rows;
}

export async function getItem({
  account_id,
  id,
}: {
  account_id: string;
  id: number;
}): Promise<Item> {
  assertValidAccountID(account_id);
  const pool = getPool();
  const { rows } = await pool.query(
    "SELECT * FROM shopping_cart_items WHERE account_id=$1 AND id=$2",
    [account_id, id],
  );
  if (rows.length == 0) {
    throw Error(`no item with id ${id}`);
  }
  return rows[0];
}
