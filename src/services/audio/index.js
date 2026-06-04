/**
 * Audio service — Step 2: narration.
 * generate.py --audio-only produces one mp3 per scene plus a character-level
 * timestamp sidecar (consumed later by the subtitle/timing step).
 */
import { runPython } from "../_runner.js";

export async function generateAudio(ctx) {
  ctx.log.info("audio.started", { voice: ctx.voice?.name });
  await runPython("generate.py", ["--audio-only"], ctx);
  ctx.log.info("audio.completed");
}
