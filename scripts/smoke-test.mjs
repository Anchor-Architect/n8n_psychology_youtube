/**
 * End-to-end smoke test in MOCK mode (no paid APIs, no real render).
 * Boots the API on an ephemeral port, POSTs /render, polls /status until the
 * job finishes, then fetches /result. Exits non-zero on any failure.
 *
 *   node scripts/smoke-test.mjs
 */
import { createApp } from "../src/server.js";

const SCRIPT = `Have you ever replayed a tiny mistake in your head for hours?
That loop has a name, and once you see it, you can break it.

Your brain treats social rejection like physical danger. It is trying to protect you.
But the threat is usually imaginary, and the cost of believing it is very real.

So here is the shift: name the thought, then ask if it is a fact or a fear.
Most of the time, it is just a fear wearing the costume of a fact.`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  process.env.RENDER_MOCK = process.env.RENDER_MOCK || "true";
  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  let ok = true;

  try {
    const health = await (await fetch(`${base}/health`)).json();
    console.log("health:", JSON.stringify(health));

    const submit = await fetch(`${base}/render`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        scriptText: SCRIPT,
        videoTitle: "Smoke Test — Overthinking",
        voice: "adam",
        channelType: "psychology",
        mock: true,
      }),
    });
    const { jobId, status } = await submit.json();
    console.log("submitted:", jobId, status, `(http ${submit.status})`);
    if (!jobId) throw new Error("no jobId returned");

    let last = "";
    for (let i = 0; i < 120; i++) {
      const st = await (await fetch(`${base}/status/${jobId}`)).json();
      const line = `status: ${st.status} ${st.progress}% (${st.phase})`;
      if (line !== last) console.log(line);
      last = line;
      if (st.status === "completed" || st.status === "failed") break;
      await sleep(500);
    }

    const result = await fetch(`${base}/result/${jobId}`);
    const body = await result.json();
    console.log("result:", JSON.stringify(body, null, 2));

    if (body.status !== "completed") {
      ok = false;
      console.error("✗ job did not complete");
    } else if (!body.videoPath || !body.duration) {
      ok = false;
      console.error("✗ result missing videoPath/duration");
    } else {
      console.log(`✓ completed: ${body.videoPath} (${body.duration}s)`);
    }
  } catch (e) {
    ok = false;
    console.error("✗ smoke test error:", e);
  } finally {
    server.close();
  }
  process.exit(ok ? 0 : 1);
}

main();
