/**
 * HTTP handlers for the render API. Thin layer: validate input, talk to the job
 * store / queue, shape the response. All heavy lifting happens in the pipeline.
 */
import { config } from "../../config/index.js";
import { logger } from "../../utils/logger.js";
import { resolveChannel, listChannels } from "../../config/channels.js";
import { createJob, getJob, STATUS } from "../../jobs/jobStore.js";
import { enqueue, queueState } from "../../jobs/jobQueue.js";

function validateRenderBody(body) {
  const errors = [];
  if (!body || typeof body !== "object") {
    return { errors: ["request body must be a JSON object"] };
  }
  const { scriptText, videoTitle, thumbnailUrl, voice, channelType, mock } = body;

  if (typeof scriptText !== "string" || scriptText.trim().length < 10) {
    errors.push("scriptText is required (a non-empty script, ≥10 chars)");
  }
  if (videoTitle != null && typeof videoTitle !== "string") {
    errors.push("videoTitle must be a string");
  }
  if (thumbnailUrl != null && typeof thumbnailUrl !== "string") {
    errors.push("thumbnailUrl must be a string (URL)");
  }
  if (channelType != null) {
    try {
      resolveChannel(channelType);
    } catch (e) {
      errors.push(e.message);
    }
  }
  if (mock != null && typeof mock !== "boolean") {
    errors.push("mock must be a boolean");
  }
  if (errors.length) return { errors };

  return {
    input: {
      scriptText,
      videoTitle: videoTitle || "video",
      thumbnailUrl: thumbnailUrl || null,
      voice: voice || "adam",
      channelType: channelType || "psychology",
      mock: mock === true ? true : undefined, // undefined → fall back to server default
    },
  };
}

export function postRender(req, res) {
  const { input, errors } = validateRenderBody(req.body);
  if (errors) {
    return res.status(400).json({ error: "invalid_request", details: errors });
  }
  const job = createJob(input);
  logger.child({ jobId: job.id }).info("api.render.accepted", {
    videoTitle: input.videoTitle,
    channelType: input.channelType,
    voice: input.voice,
  });
  enqueue(job);
  return res.status(202).json({ jobId: job.id, status: job.status });
}

export function getStatus(req, res) {
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: "job_not_found", jobId: req.params.jobId });
  return res.json({
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    phase: job.phase,
  });
}

export function getResult(req, res) {
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: "job_not_found", jobId: req.params.jobId });

  if (job.status === STATUS.COMPLETED) {
    return res.json({
      jobId: job.id,
      status: job.status,
      videoPath: job.result.videoPath,
      relativeVideoPath: job.result.relativeVideoPath,
      duration: job.result.duration,
      frames: job.result.frames,
      thumbnailPath: job.result.thumbnailPath,
    });
  }
  if (job.status === STATUS.FAILED) {
    return res.status(200).json({ jobId: job.id, status: job.status, error: job.error });
  }
  // Not finished yet — tell n8n to keep polling /status.
  return res.status(202).json({
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    message: "render not finished; poll GET /status/:jobId",
  });
}

export function getHealth(_req, res) {
  return res.json({
    status: "ok",
    mockDefault: config.mockDefault,
    channels: listChannels(),
    queue: queueState(),
    uptimeSeconds: Math.round(process.uptime()),
  });
}
