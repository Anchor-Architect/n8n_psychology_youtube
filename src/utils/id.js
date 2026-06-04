import { randomBytes } from "node:crypto";

/**
 * Short, URL-safe, time-ordered job id, e.g. "job_lq3f8k_a1b2c3".
 * The timestamp prefix keeps job directories sortable by creation time.
 */
export function newJobId() {
  const ts = Date.now().toString(36);
  const rand = randomBytes(4).toString("hex");
  return `job_${ts}_${rand}`;
}
