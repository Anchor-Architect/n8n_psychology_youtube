/**
 * Job store. Single source of truth for job state, kept in memory and mirrored
 * to jobs/<id>/job.json so status survives a server restart.
 */
import { newJobId } from "../utils/id.js";
import {
  writeJobState,
  readJobState,
  listPersistedJobIds,
} from "../storage/storage.js";

export const STATUS = Object.freeze({
  QUEUED: "queued",
  PROCESSING: "processing",
  RENDERING: "rendering",
  COMPLETED: "completed",
  FAILED: "failed",
});

const jobs = new Map();

function persist(job) {
  job.updatedAt = new Date().toISOString();
  try {
    writeJobState(job);
  } catch {
    /* in-memory state is still authoritative if disk write fails */
  }
}

export function createJob(input) {
  const now = new Date().toISOString();
  const job = {
    id: newJobId(),
    status: STATUS.QUEUED,
    progress: 0,
    phase: "queued",
    input,
    result: null,
    error: null,
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    finishedAt: null,
  };
  jobs.set(job.id, job);
  persist(job);
  return job;
}

export function getJob(id) {
  return jobs.get(id) || null;
}

export function updateJob(id, patch) {
  const job = jobs.get(id);
  if (!job) return null;
  Object.assign(job, patch);
  persist(job);
  return job;
}

export function allJobs() {
  return [...jobs.values()];
}

/** Reload persisted jobs at boot; any left mid-flight are marked failed. */
export function hydrateFromDisk() {
  for (const id of listPersistedJobIds()) {
    const saved = readJobState(id);
    if (!saved) continue;
    if (saved.status === STATUS.PROCESSING || saved.status === STATUS.RENDERING) {
      saved.status = STATUS.FAILED;
      saved.error = "interrupted by server restart";
      saved.finishedAt = new Date().toISOString();
    }
    jobs.set(id, saved);
  }
  return jobs.size;
}
