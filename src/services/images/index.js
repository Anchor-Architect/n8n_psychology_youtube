/**
 * Images service — Step 3: scene assets.
 * generate.py --images-only renders one still per visual beat; normalize_bg.py
 * then flattens every background to one uniform cream tone.
 */
import { runPython } from "../_runner.js";

export async function generateImages(ctx) {
  ctx.log.info("images.started");
  await runPython("generate.py", ["--images-only"], ctx);
  await runPython("normalize_bg.py", [], ctx);
  ctx.log.info("images.completed");
}
