/*
Serve static files from the HOME directory.  

Security: Authentication is not handled at this level.

NOTE: There is a very similar server in src/compute/compute/lib/http-server/static.ts
*/

import { type Application, static as staticServer } from "express";
import index from "serve-index";
import { getLogger } from "@cocalc/project/logger";

const log = getLogger("serve-static-files-to-browser");

export default function init(app: Application, base: string) {
  log.info(`initialize with base="${base}"`);
  // Setup the static raw HTTP server.  This must happen after anything above,
  // since it serves all URL's (so it has to be the fallback).
  app.use(base, (req, res, next) => {
    // this middleware function has to come before the express.static server!
    // it sets the content type to octet-stream (aka "download me") if URL query ?download exists
    if (req.query.download != null) {
      res.setHeader("Content-Type", "application/octet-stream");
    }
    // Note: we do not set no-cache since that causes major issues on Safari:
    //   https://github.com/sagemathinc/cocalc/issues/5120
    // By now our applications should use query params to break the cache.
    res.setHeader("Cache-Control", "private, must-revalidate");
    next();
  });

  const { HOME } = process.env;
  if (HOME == null) {
    throw Error("HOME env variable must be defined");
  }
  log.info(`serving up HOME="${HOME}"`);

  app.use(base, index(HOME, { hidden: true, icons: true }));
  app.use(base, staticServer(HOME, { dotfiles: "allow" }));
}
