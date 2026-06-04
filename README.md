# Psychology Video Render Engine

![Node](https://img.shields.io/badge/Node-%E2%89%A520-339933?logo=node.js&logoColor=white)
![Python](https://img.shields.io/badge/Python-%E2%89%A53.10-3776AB?logo=python&logoColor=white)
![Remotion](https://img.shields.io/badge/Remotion-4.x-0B84F3?logo=remotion&logoColor=white)
![Express](https://img.shields.io/badge/API-Express-000000?logo=express&logoColor=white)
![Driven by n8n](https://img.shields.io/badge/Driven%20by-n8n-EA4B71?logo=n8n&logoColor=white)
![License](https://img.shields.io/badge/License-Proprietary-red)
![Status](https://img.shields.io/badge/status-active-success)

A **headless rendering service** that turns an approved script + thumbnail into a
finished 16:9 MP4. Built to be driven by **n8n Cloud** (Workflow #3).

```
n8n  ──POST /render──►  Render Engine  ──►  MP4  ──►  (n8n uploads to Google Drive)
        ◄─ jobId ─                         ▲
        ──GET /status/:id──►  progress     │
        ──GET /result/:id──►  videoPath ───┘
```

The engine receives a script, then automatically:
1. **plans** the scene timeline + image prompts (Claude, via the `script-reviewer` skill),
2. generates **narration audio** (ElevenLabs, with word timestamps),
3. generates **scene images** (Replicate · flux-schnell) and normalizes backgrounds,
4. builds **subtitles** + audio-first timing,
5. **renders** a single Remotion timeline to MP4,
6. returns the output path + duration.

Each job runs in its own isolated workspace (`jobs/<jobId>/workspace`), so
concurrent/repeat renders never collide.

---

## Architecture

```
src/                         Node/Express render service
  api/
    routes/                  POST /render, GET /status, GET /result, GET /health
    controllers/             request validation + response shaping
  jobs/
    jobStore.js              job state (in-memory + jobs/<id>/job.json)
    jobQueue.js              serial FIFO worker (one render at a time)
    pipeline.js              orchestrates the 6 steps, advances status/progress
  services/
    plan/  audio/  images/  subtitles/  render/   one step each
  storage/                   per-job workspace layout + thumbnail download
  config/                    channels, voices, env-derived config
  utils/                     logger, spawn, .env loader, id

pipeline/                    Python steps (run per-job via PROJECT_ROOT)
  classify.py  validate.py  generate.py  normalize_bg.py  measure.py
  _workspace.py             resolves the job workspace + skill/style + mock flag

remotion/                    Remotion project
  src/                       Root/Video/Scene/Caption (+ Short)
  render-job.mjs             bundles per-job (publicDir = workspace) and renders

.claude/skills/script-reviewer/   the scene-split + image-prompt skill
assets/reference/STYLE.md         shared art-style reference
docs/                             API.md, n8n.md
examples/                         sample request bodies
```

**Why this split:** Remotion rendering is Node-native, so the API + render path
are one language; the proven Python asset-generation pipeline is reused as-is,
spawned per job in an isolated workspace.

---

## Local startup guide

### 0. Prerequisites
- Node.js ≥ 20 (tested on 24)
- Python ≥ 3.10 (tested on 3.14)
- The Remotion deps are already installed under `remotion/node_modules`.

### 1. Install dependencies

```bash
# Node API server (root)
npm install

# Python pipeline (virtualenv)
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt

# Remotion (only if remotion/node_modules is missing)
cd remotion && npm install && cd ..
```

### 2. Configure secrets

```bash
cp .env.example .env
# then fill in:
#   ANTHROPIC_API_KEY        (scene plan)
#   ELEVENLABS_API_KEY + VOICE_ADAM_ID (or ELEVENLABS_VOICE_ID)  (narration)
#   REPLICATE_API_TOKEN      (scene images)
```

### 3. Run it

```bash
npm start          # listens on http://localhost:8080
# or: npm run dev  # auto-restart on change
```

### 4. Verify without spending credits (mock mode)

```bash
# self-contained: boots, runs a full mock job, prints the result
node scripts/smoke-test.mjs

# or against a running server:
curl -s -X POST http://localhost:8080/render \
  -H 'content-type: application/json' \
  -d @examples/render-request.mock.json
```

Mock mode stubs every paid call and skips the heavy render, so you can validate
the API + queue + status/result flow end-to-end for free. Drop `"mock": true`
(and set real keys) for a real render.

### 5. A real render

```bash
curl -s -X POST http://localhost:8080/render \
  -H 'content-type: application/json' \
  -d @examples/render-request.json
# → { "jobId": "...", "status": "queued" }
# poll GET /status/:jobId until "completed", then GET /result/:jobId
```

Output lands at `jobs/<jobId>/output/<title>.mp4`.

---

## Documentation
- [`docs/API.md`](docs/API.md) — full REST reference + status lifecycle
- [`docs/n8n.md`](docs/n8n.md) — n8n node-by-node wiring + curl examples
- [`examples/`](examples) — sample request bodies

## Configuration knobs
- **Voices:** `src/config/voices.js` — `voice` name → `VOICE_<NAME>_ID` env.
- **Channels:** `src/config/channels.js` — `channelType` → skill / style / composition.
- **Server:** `PORT`, `HOST`, `LOG_LEVEL`, `RENDER_MOCK`, `PYTHON_BIN` (see `.env.example`).
- **Pipeline tuning** (voice speed, audio format, flux model, etc.): see `.env.example`.

## Design for future scale
- **Multiple channels** — add an entry to the channel registry.
- **Multiple voices / providers** — extend the voice registry (the resolved voice
  carries a `provider` field for branching).
- **Multiple templates** — add Remotion compositions and map them per channel.
- **Batch rendering** — POST multiple jobs; the serial queue drains them in order
  (raise concurrency later by parallelizing `jobQueue.js`).

## Core invariants (unchanged from the original pipeline)
1. Timing is **audio-first** — image counts are estimates; real ElevenLabs audio
   length sets each scene's duration.
2. One audio file per scene; one Remotion timeline; **16:9 / 1920×1080**.
3. Images carry **no text** (7s hard cap per image); subtitles are drawn by Remotion.

## License

Proprietary — All rights reserved. See [`LICENSE`](LICENSE).
