/**
 * Central configuration. Resolves repo paths, the Python interpreter, and
 * service-wide defaults from the environment. Loads the repo .env first so the
 * Python steps (which inherit our process.env) get the API keys.
 */
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { loadDotEnv } from "../utils/env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "..", "..");

loadDotEnv(path.join(REPO_ROOT, ".env"));

function truthy(v) {
  return String(v ?? "").trim().toLowerCase() === "true" ||
    ["1", "yes", "on"].includes(String(v ?? "").trim().toLowerCase());
}

function resolvePython() {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
  const venv = path.join(REPO_ROOT, ".venv", "bin", "python");
  return fs.existsSync(venv) ? venv : "python3";
}

export const config = {
  port: Number(process.env.PORT || 8080),
  host: process.env.HOST || "0.0.0.0",

  repoRoot: REPO_ROOT,
  jobsDir: process.env.JOBS_DIR || path.join(REPO_ROOT, "jobs"),
  pipelineDir: path.join(REPO_ROOT, "pipeline"),
  remotionDir: path.join(REPO_ROOT, "remotion"),

  pythonBin: resolvePython(),

  // When true, every render runs in mock mode (no paid API calls). Individual
  // requests can also opt in per-job with {"mock": true} in the body.
  mockDefault: truthy(process.env.RENDER_MOCK),

  // Keep finished/failed job metadata in memory this long before it can be
  // garbage-collected (files on disk are kept regardless).
  jobRetentionMs: Number(process.env.JOB_RETENTION_MS || 24 * 60 * 60 * 1000),

  logLevel: process.env.LOG_LEVEL || "info",
};
