/**
 * Per-job Remotion render.
 *
 * Bundles this Remotion project with the JOB's workspace as the publicDir (so
 * `staticFile("assets/...")` resolves to that job's images/audio), then renders
 * the timeline from <workspace>/remotion.json passed as inputProps.
 *
 * Emits newline-delimited JSON to stdout so the Node orchestrator can track
 * progress without parsing human text:
 *   {"type":"phase","phase":"bundling"}
 *   {"type":"progress","progress":0.42}
 *   {"type":"result","output":"...","durationSeconds":712.3,"frames":21369}
 *
 * Usage:
 *   node render-job.mjs --workspace <dir> --out <file.mp4> [--composition Psychology] [--mock]
 */
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const out = { composition: "Psychology", mock: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--mock") out.mock = true;
    else if (a === "--workspace") out.workspace = argv[++i];
    else if (a === "--out") out.out = argv[++i];
    else if (a === "--composition") out.composition = argv[++i];
  }
  if (!out.workspace || !out.out) {
    throw new Error("render-job: --workspace and --out are required");
  }
  return out;
}

const emit = (obj) => process.stdout.write(JSON.stringify(obj) + "\n");

function timelineSeconds(scenes) {
  if (!scenes.length) return 0;
  // Prefer the cumulative endTime measure.py wrote; fall back to summing.
  const last = scenes[scenes.length - 1];
  if (typeof last.endTime === "number" && last.endTime > 0) return last.endTime;
  return scenes.reduce(
    (acc, s) => acc + (s.audioDuration ?? s.estimatedDuration ?? 0),
    0
  );
}

async function main() {
  const args = parseArgs(process.argv);
  const scenes = JSON.parse(
    fs.readFileSync(path.join(args.workspace, "remotion.json"), "utf8")
  );
  const durationSeconds = Math.round(timelineSeconds(scenes) * 10) / 10;

  fs.mkdirSync(path.dirname(args.out), { recursive: true });

  // Mock: skip the real (CPU-heavy) render entirely. Write a small placeholder
  // so the API can exercise the whole queue/status/result flow for free.
  if (args.mock) {
    emit({ type: "phase", phase: "bundling" });
    emit({ type: "progress", progress: 0.5 });
    fs.writeFileSync(
      args.out,
      `MOCK RENDER\ncomposition=${args.composition}\nscenes=${scenes.length}\n` +
        `durationSeconds=${durationSeconds}\nworkspace=${args.workspace}\n`
    );
    emit({ type: "progress", progress: 1 });
    emit({
      type: "result",
      output: args.out,
      durationSeconds,
      frames: 0,
      scenes: scenes.length,
      mock: true,
    });
    return;
  }

  const { bundle } = await import("@remotion/bundler");
  const { selectComposition, renderMedia } = await import("@remotion/renderer");

  emit({ type: "phase", phase: "bundling" });
  const serveUrl = await bundle({
    entryPoint: path.join(__dirname, "src", "index.ts"),
    // The job's workspace holds assets/ — expose it as the static root.
    publicDir: args.workspace,
  });

  emit({ type: "phase", phase: "selecting" });
  const inputProps = { scenes };
  const composition = await selectComposition({
    serveUrl,
    id: args.composition,
    inputProps,
  });

  emit({ type: "phase", phase: "rendering" });
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    imageFormat: "jpeg",
    outputLocation: args.out,
    inputProps,
    overwrite: true,
    onProgress: ({ progress }) => emit({ type: "progress", progress }),
  });

  emit({
    type: "result",
    output: args.out,
    durationSeconds,
    frames: composition.durationInFrames,
    scenes: scenes.length,
    mock: false,
  });
}

main().catch((err) => {
  emit({ type: "error", message: err?.stack || String(err) });
  process.exit(1);
});
