import getPool from "@cocalc/database/pool";
import type { PoolClient } from "@cocalc/database/pool";

/*
compute the sum of the following, over all rows of the table for a given account_id:

- the cost if it is not null
- if the cost is null, I want to compute cost_per_hour times the number of
  hours from period_start to period_end, or if period_end is null, the
  current time.
*/

// selects the cost, or if not done, the rate-based cost cost so far, or if not that the usage based cost so far.
// We convert to ::decimal because cost is of type "real" (4 bytes) and in some cases COALESCE(a,b) with real is NOT
// equal to either a or b!  Or rather, it is a real that is technically equal to one of those numbers, but not as
// a double.
export const COST_OR_METERED_COST =
  "COALESCE(cost::decimal, COALESCE(cost_so_far::decimal, cost_per_hour * EXTRACT(EPOCH FROM (COALESCE(period_end, NOW()) - period_start)) / 3600)::decimal)::real";

// never update the balance more frequently than this for a given user.
const MIN_BALANCE_UPDATE_MS = 1000;

const lastUpdate: { [account_id: string]: number } = {};
export default async function getBalance({
  account_id,
  client,
  noSave,
}: {
  account_id: string;
  client?: PoolClient;
  // do not save the computed balance to the accounts table.
  noSave?: boolean;
}): Promise<number> {
  const pool = client ?? getPool();

  // Criticism:
  //   - user may have a large number of purchases, and this is adding the ALL up every single time
  //     it computes the balance.
  //   - the arithmetic is probably done using 32-bit floats and there could be a slight rounding error eventually.

  const { rows } = await pool.query(
    `SELECT -SUM(${COST_OR_METERED_COST}) as balance FROM purchases WHERE account_id=$1`,
    [account_id],
  );
  const balance = rows[0]?.balance ?? 0;
  if (!noSave) {
    const now = Date.now();
    if (now - (lastUpdate[account_id] ?? 0) >= MIN_BALANCE_UPDATE_MS) {
      lastUpdate[account_id] = now;
      await pool.query("UPDATE accounts SET balance=$2 WHERE account_id=$1", [
        account_id,
        balance,
      ]);
    }
  }
  return balance;
}

// total balance right now
export async function getTotalBalance(account_id: string, client?: PoolClient) {
  const pool = client ?? getPool();
  const { rows } = await pool.query(
    `SELECT -SUM(${COST_OR_METERED_COST}) as balance FROM purchases WHERE account_id=$1`,
    [account_id],
  );
  return rows[0]?.balance ?? 0;
}
