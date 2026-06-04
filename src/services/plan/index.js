/**
 * Plan service — Step 1 of the render flow.
 * Turns the raw script into a validated scene timeline + image prompts:
 *   classify.py  → remotion.json (scenes) + replicate.json (image prompts)
 *   validate.py  → enforces the cross-file invariants (links, 7s cap)
 */
import { runPython } from "../_runner.js";

export async function generatePlan(ctx) {
  ctx.log.info("plan.started", { mock: ctx.mock });
  await runPython("classify.py", [], ctx);
  await runPython("validate.py", [], ctx);
  ctx.log.info("plan.completed");
}
