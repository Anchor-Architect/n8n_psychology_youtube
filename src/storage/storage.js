/**
 * Storage layer. Owns the on-disk layout for a job and all filesystem side
 * effects, so the rest of the engine never builds paths by hand.
 *
 *   jobs/<jobId>/
 *     job.json            persisted job state
 *     job.log             per-job structured log
 *     thumbnail.<ext>     downloaded approved thumbnail (from n8n)
 *     workspace/          isolated pipeline root (PROJECT_ROOT for Python)
 *       input/script/script.txt
 *       assets/{images,audio,images_raw}/
 *       out/plan.md
 *       remotion.json  replicate.json
 *     output/<title>.mp4  final render
 */
import fs from "node:fs";
import path from "node:path";
import { config } from "../config/index.js";

export function jobDir(jobId) {
  return path.join(config.jobsDir, jobId);
}
export function workspaceDir(jobId) {
  return path.join(jobDir(jobId), "workspace");
}
export function outputDir(jobId) {
  return path.join(jobDir(jobId), "output");
}
export function jobStatePath(jobId) {
  return path.join(jobDir(jobId), "job.json");
}
export function jobLogPath(jobId) {
  return path.join(jobDir(jobId), "job.log");
}

function safeName(title) {
  const base = (title || "video")
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return base || "video";
}

export function outputPath(jobId, title) {
  return path.join(outputDir(jobId), `${safeName(title)}.mp4`);
}

/** Create the job + workspace skeleton and write the script to disk. */
export function prepareWorkspace(job) {
  const ws = workspaceDir(job.id);
  for (const sub of [
    path.join(ws, "input", "script"),
    path.join(ws, "assets", "images"),
    path.join(ws, "assets", "audio"),
    path.join(ws, "assets", "images_raw"),
    path.join(ws, "out"),
    outputDir(job.id),
  ]) {
    fs.mkdirSync(sub, { recursive: true });
  }

  const scriptFile = path.join(ws, "input", "script", "script.txt");
  const header = job.input.videoTitle ? `${job.input.videoTitle}\n\n` : "";
  fs.writeFileSync(scriptFile, header + job.input.scriptText, "utf8");
  return ws;
}

/** Download the approved thumbnail; non-fatal if it fails. Returns path|null. */
export async function downloadThumbnail(job) {
  const url = job.input.thumbnailUrl;
  if (!url) return null;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`thumbnail download ${res.status} ${res.statusText}`);
  const ext = (path.extname(new URL(url).pathname) || ".png").split("?")[0];
  const dest = path.join(jobDir(job.id), `thumbnail${ext}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return dest;
}

export function writeJobState(job) {
  fs.mkdirSync(jobDir(job.id), { recursive: true });
  fs.writeFileSync(jobStatePath(job.id), JSON.stringify(job, null, 2), "utf8");
}

export function readJobState(jobId) {
  const p = jobStatePath(jobId);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

export function listPersistedJobIds() {
  if (!fs.existsSync(config.jobsDir)) return [];
  return fs
    .readdirSync(config.jobsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}
