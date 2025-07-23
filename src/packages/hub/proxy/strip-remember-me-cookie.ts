/*
In the interest of security and "XSS", we strip the "remember_me" cookie
from the header before passing anything along via the proxy.
The reason this is important is that it's critical that the project (and
nothing running in the project) can get access to a user's auth cookie.
I.e., malicious code running in a project shouldn't be able to steal
auth credentials for all users of a project!
*/

import {
  REMEMBER_ME_COOKIE_NAME,
  API_COOKIE_NAME,
} from "@cocalc/backend/auth/cookie-names";

export default function stripRememberMeCookie(cookie): {
  cookie: string;
  remember_me: string | undefined; // the value of the cookie we just stripped out.
  api_key: string | undefined;
} {
  if (cookie == null) {
    return {
      cookie,
      remember_me: undefined,
      api_key: undefined,
    };
  } else {
    const v: string[] = [];
    let remember_me: string | undefined = undefined;
    let api_key: string | undefined = undefined;
    for (const c of cookie.split(";")) {
      const z = c.split("=");
      if (z[0].trim() == REMEMBER_ME_COOKIE_NAME) {
        // save it but do not include it in v, which will
        // be the new cookies values after going through
        // the proxy.
        remember_me = z[1].trim();
      } else if (z[0].trim() == API_COOKIE_NAME) {
        api_key = z[1].trim();
      } else {
        v.push(c);
      }
    }
    return { cookie: v.join(";"), remember_me, api_key };
  }
}
