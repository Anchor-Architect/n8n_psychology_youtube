/**
 * Render pipeline orchestrator. Runs one job end-to-end through the services,
 * advancing status/progress and logging the required lifecycle events:
 *   request received → audio → images → subtitles → render started →
 *   render completed | render failed
 *
 * Progress is split into fixed bands so /status reports steady forward motion;
 * the render band is driven by Remotion's own progress callback.
 */
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { resolveChannel } from "../config/channels.js";
import { resolveVoice } from "../config/voices.js";
import {
  prepareWorkspace,
  downloadThumbnail,
  workspaceDir,
  outputPath,
  jobLogPath,
} from "../storage/storage.js";
import { STATUS, updateJob } from "./jobStore.js";

import { generatePlan } from "../services/plan/index.js";
import { generateAudio } from "../services/audio/index.js";
import { generateImages } from "../services/images/index.js";
import { generateSubtitles } from "../services/subtitles/index.js";
import { renderVideo } from "../services/render/index.js";

// Progress band boundaries (percent) for each phase.
const BAND = {
  prepare: [0, 5],
  plan: [5, 15],
  audio: [15, 35],
  images: [35, 58],
  subtitles: [58, 62],
  render: [62, 98],
  finalize: [98, 100],
};

export async function runJob(job) {
  const log = logger.child({ jobId: job.id }, jobLogPath(job.id));
  const mock = Boolean(job.input.mock ?? config.mockDefault);

  const channel = resolveChannel(job.input.channelType);
  const voice = resolveVoice(job.input.voice, { mock });

  const ws = workspaceDir(job.id);
  const env = {
    PROJECT_ROOT: ws,
    SKILL_DIR: channel.skillDir,
    STYLE_PATH: channel.stylePath,
    RENDER_MOCK: mock ? "true" : "",
  };
  if (voice.id) env.ELEVENLABS_VOICE_ID = voice.id;

  const ctx = {
    job,
    log,
    mock,
    channel,
    voice,
    env,
    workspace: ws,
    outputPath: outputPath(job.id, job.input.videoTitle),
  };

  const setPhase = (phase, status = STATUS.PROCESSING) => {
    updateJob(job.id, { phase, status, progress: BAND[phase][0] });
    log.info("phase.enter", { phase, status });
  };
  const finishPhase = (phase) => updateJob(job.id, { progress: BAND[phase][1] });

  log.info("request.received", {
    videoTitle: job.input.videoTitle,
    channelType: channel.id,
    voice: voice.name,
    mock,
    scriptChars: job.input.scriptText.length,
  });

  updateJob(job.id, { status: STATUS.PROCESSING, startedAt: new Date().toISOString() });

  // 1. Workspace + approved thumbnail
  setPhase("prepare");
  prepareWorkspace(job);
  try {
    const thumb = await downloadThumbnail(job);
    if (thumb) log.info("thumbnail.saved", { path: thumb });
    ctx.thumbnailPath = thumb;
  } catch (e) {
    log.warn("thumbnail.failed", { message: String(e) }); // non-fatal
  }
  finishPhase("prepare");

  // 2. Scene plan (timeline + image prompts)
  setPhase("plan");
  await generatePlan(ctx);
  finishPhase("plan");

  // 3. Narration audio
  setPhase("audio");
  await generateAudio(ctx);
  finishPhase("audio");

  // 4. Scene images
  setPhase("images");
  await generateImages(ctx);
  finishPhase("images");

  // 5. Subtitles + audio-first timing
  setPhase("subtitles");
  await generateSubtitles(ctx);
  finishPhase("subtitles");

  // 6. Render MP4 (status flips to "rendering")
  setPhase("render", STATUS.RENDERING);
  const [lo, hi] = BAND.render;
  ctx.onRenderProgress = (p) => {
    const pct = Math.min(hi, Math.round(lo + p * (hi - lo)));
    updateJob(job.id, { progress: pct });
  };
  const render = await renderVideo(ctx);
  finishPhase("render");

  // 7. Finalize
  setPhase("finalize", STATUS.RENDERING);
  const result = {
    videoPath: render.videoPath,
    relativeVideoPath: render.relativeVideoPath,
    duration: render.duration,
    frames: render.frames,
    thumbnailPath: ctx.thumbnailPath || null,
  };
  updateJob(job.id, {
    status: STATUS.COMPLETED,
    progress: 100,
    phase: "completed",
    result,
    finishedAt: new Date().toISOString(),
  });
  log.info("render.completed.final", result);
  return result;
}
