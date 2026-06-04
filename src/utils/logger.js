/**
 * Structured logger. Every line is JSON so logs are greppable and ingestible,
 * and is also mirrored to a per-job file when a logger is bound to a job.
 *
 *   const log = logger.child({ jobId });
 *   log.info("render.started", { composition });
 */
import fs from "node:fs";
import { config } from "../config/index.js";

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[config.logLevel] ?? LEVELS.info;

function write(stream, base, level, event, data) {
  if ((LEVELS[level] ?? LEVELS.info) < threshold) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...base,
    ...(data || {}),
  };
  const line = JSON.stringify(entry);
  process.stdout.write(line + "\n");
  if (stream) {
    try {
      fs.appendFileSync(stream, line + "\n");
    } catch {
      /* never let logging crash a render */
    }
  }
  return entry;
}

function make(base = {}, file = null) {
  return {
    debug: (event, data) => write(file, base, "debug", event, data),
    info: (event, data) => write(file, base, "info", event, data),
    warn: (event, data) => write(file, base, "warn", event, data),
    error: (event, data) => write(file, base, "error", event, data),
    child: (extra, childFile) => make({ ...base, ...extra }, childFile ?? file),
  };
}

export const logger = make();
