/**
 * Render engine entrypoint. Boots the Express API, restores any persisted jobs,
 * and starts listening. The job queue worker starts lazily on first enqueue.
 */
import express from "express";
import { config } from "./config/index.js";
import { logger } from "./utils/logger.js";
import { router } from "./api/routes/index.js";
import { hydrateFromDisk } from "./jobs/jobStore.js";

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "5mb" }));

  // Request log
  app.use((req, _res, next) => {
    logger.debug("http.request", { method: req.method, path: req.path });
    next();
  });

  app.use("/", router);

  // 404 + error handlers
  app.use((req, res) => {
    res.status(404).json({ error: "not_found", path: req.path });
  });
  app.use((err, _req, res, _next) => {
    logger.error("http.error", { message: err?.message });
    res.status(500).json({ error: "internal_error", message: err?.message });
  });

  return app;
}

function start() {
  const restored = hydrateFromDisk();
  logger.info("boot", {
    restoredJobs: restored,
    mockDefault: config.mockDefault,
    pythonBin: config.pythonBin,
    jobsDir: config.jobsDir,
  });

  const app = createApp();
  app.listen(config.port, config.host, () => {
    logger.info("listening", { host: config.host, port: config.port });
  });
}

// Only start the server when run directly (not when imported by a test).
if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}
