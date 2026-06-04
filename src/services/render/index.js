/**
 * Render service — Steps 5–6: build the Remotion timeline and render the MP4.
 * Spawns remotion/render-job.mjs, which bundles the project with the job's
 * workspace as publicDir and renders <workspace>/remotion.json as inputProps.
 * The child emits newline-delimited JSON; we forward progress and capture the
 * final result (output path + duration).
 */
import path from "node:path";
import { config } from "../../config/index.js";
import { run } from "../../utils/spawn.js";

export async function renderVideo(ctx) {
  ctx.log.info("render.started", { composition: ctx.channel.composition, mock: ctx.mock });

  const args = [
    "render-job.mjs",
    "--workspace",
    ctx.workspace,
    "--out",
    ctx.outputPath,
    "--composition",
    ctx.channel.composition,
  ];
  if (ctx.mock) args.push("--mock");

  let result = null;

  await run("node", args, {
    cwd: config.remotionDir,
    env: ctx.env,
    onStdoutLine: (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      let msg;
      try {
        msg = JSON.parse(trimmed);
      } catch {
        ctx.log.debug("render.stdout", { line: trimmed });
        return;
      }
      if (msg.type === "progress") {
        ctx.onRenderProgress?.(msg.progress);
      } else if (msg.type === "phase") {
        ctx.log.info("render.phase", { phase: msg.phase });
      } else if (msg.type === "result") {
        result = msg;
      } else if (msg.type === "error") {
        ctx.log.error("render.child_error", { message: msg.message });
      }
    },
    onStderrLine: (line) => line.trim() && ctx.log.debug("render.stderr", { line }),
  });

  if (!result) throw new Error("render-job did not emit a result");
  ctx.log.info("render.completed", {
    output: result.output,
    durationSeconds: result.durationSeconds,
    frames: result.frames,
  });
  return {
    videoPath: result.output,
    relativeVideoPath: path.relative(config.repoRoot, result.output),
    duration: result.durationSeconds,
    frames: result.frames,
  };
}
