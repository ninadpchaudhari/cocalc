import Cookies from "cookies";
import { Router } from "express";
import { getLogger } from "@cocalc/hub/logger";
const { COOKIE_OPTIONS } = require("@cocalc/hub/client"); // import { COOKIE_OPTIONS } from "@cocalc/hub/client";

export default function init(router: Router) {
  const winston = getLogger("set-cookie");

  router.get("/cookies", (req, res) => {
    if (req.query.set) {
      // TODO: implement setting maxAge as part of query?  not needed for now.
      const maxAge = 1000 * 24 * 3600 * 30 * 6; // 6 months -- long is fine now since we support "sign out everywhere" ?

      winston.debug(`${req.query.set}=${req.query.value}`);
      // The option { secure: true } is needed if SSL happens outside the hub; see
      //    https://github.com/pillarjs/cookies/issues/51#issuecomment-568182639
      // It basically tells the server to pretend the connection is secure, even though
      // it's internal heuristic based on req says it is not secure.
      const cookies = new Cookies(req, res, { secure: true });
      const conf = { ...COOKIE_OPTIONS, maxAge };
      winston.debug(`conf=${JSON.stringify(conf)}`);
      cookies.set(req.query.set, req.query.value, conf);
    }
    res.end();
  });
}
