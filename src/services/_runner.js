/**
 * Shared helpers for the pipeline services. Each service is a thin wrapper that
 * spawns one pipeline step (a Python script, or the Node render job) inside the
 * job's isolated workspace and forwards its output to the job log.
 */
import path from "node:path";
import { config } from "../config/index.js";
import { run } from "../utils/spawn.js";

/** Run a pipeline Python script with the job env, logging each output line. */
export async function runPython(scriptName, args, ctx) {
  const script = path.join(config.pipelineDir, scriptName);
  ctx.log.debug("step.spawn", { command: config.pythonBin, script, args });
  await run(config.pythonBin, [script, ...args], {
    cwd: config.repoRoot,
    env: ctx.env,
    onStdoutLine: (line) => line.trim() && ctx.log.info("py.stdout", { script: scriptName, line }),
    onStderrLine: (line) => line.trim() && ctx.log.debug("py.stderr", { script: scriptName, line }),
  });
}
