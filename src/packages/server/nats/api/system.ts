import getCustomize from "@cocalc/database/settings/customize";
export { getCustomize };
import { record_user_tracking } from "@cocalc/database/postgres/user-tracking";
import { db } from "@cocalc/database";
import manageApiKeys from "@cocalc/server/api/manage";
export { manageApiKeys };
import { type UserSearchResult } from "@cocalc/util/db-schema/accounts";
import isAdmin from "@cocalc/server/accounts/is-admin";
import search from "@cocalc/server/accounts/search";
export { getNames } from "@cocalc/server/accounts/get-name";

export function ping() {
  return { now: Date.now() };
}

export async function terminate() {}

export async function userTracking({
  event,
  value,
  account_id,
}: {
  event: string;
  value: object;
  account_id?: string;
}): Promise<void> {
  await record_user_tracking(db(), account_id!, event, value);
}

export {
  generateUserAuthToken,
  revokeUserAuthToken,
} from "@cocalc/server/auth/auth-token";

export async function userSearch({
  account_id,
  query,
  limit,
  admin,
  only_email,
}: {
  account_id?: string;
  query: string;
  limit?: number;
  admin?: boolean;
  only_email?: boolean;
}): Promise<UserSearchResult[]> {
  if (!account_id) {
    throw Error("You must be signed in to search for users.");
  }
  if (admin) {
    if (!(await isAdmin(account_id))) {
      throw Error("Must be an admin to do admin search.");
    }
  } else {
    if (limit != null && limit > 50) {
      // hard cap at 50... (for non-admin)
      limit = 50;
    }
  }
  return await search({ query, limit, admin, only_email });
}
