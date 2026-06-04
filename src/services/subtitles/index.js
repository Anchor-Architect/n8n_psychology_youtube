/**
 * Subtitles service — Step 4: subtitles + audio-first timing.
 * measure.py reads each scene's measured audio length, writes word-timed
 * subtitle cues into remotion.json, and rewrites the cumulative scene timing so
 * the timeline length equals the real narration length.
 */
import { runPython } from "../_runner.js";

export async function generateSubtitles(ctx) {
  ctx.log.info("subtitles.started");
  await runPython("measure.py", [], ctx);
  ctx.log.info("subtitles.completed");
}
