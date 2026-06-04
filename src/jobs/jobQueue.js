/**
 * Serial FIFO job queue. Rendering is CPU/GPU heavy, so exactly one job runs at
 * a time; the rest wait in "queued". Enqueue returns immediately (the API
 * responds 202 with the jobId) and the worker drains the queue in order.
 */
import { logger } from "../utils/logger.js";
import { STATUS, updateJob } from "./jobStore.js";
import { runJob } from "./pipeline.js";

const pending = [];
let running = false;
let active = null;

export function enqueue(job) {
  pending.push(job.id);
  logger.info("queue.enqueued", { jobId: job.id, queueDepth: pending.length });
  drain();
}

export function queueState() {
  return { active, depth: pending.length, pending: [...pending] };
}

async function drain() {
  if (running) return;
  running = true;
  try {
    while (pending.length) {
      const jobId = pending.shift();
      active = jobId;
      const log = logger.child({ jobId });
      const job = updateJob(jobId, {}); // touch to fetch current state
      if (!job) continue;
      try {
        log.info("job.start");
        await runJob(job);
        log.info("job.done", { status: STATUS.COMPLETED });
      } catch (err) {
        log.error("render.failed", { message: err?.message, stack: err?.stack });
        updateJob(jobId, {
          status: STATUS.FAILED,
          phase: "failed",
          error: err?.message || String(err),
          finishedAt: new Date().toISOString(),
        });
      } finally {
        active = null;
      }
    }
  } finally {
    running = false;
  }
}
