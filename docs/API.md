# Render Engine API

A headless Remotion rendering service. n8n POSTs an approved script + thumbnail;
the engine generates narration, scene images, subtitles, builds a Remotion
timeline, renders an MP4, and reports the result. n8n then uploads the MP4 to
Google Drive.

Base URL: `http://<host>:8080` (configurable via `PORT`/`HOST`).
All request/response bodies are JSON.

---

## POST /render

Enqueue a render job. Returns immediately (the work runs in the background
queue).

**Request body**

| field         | type    | required | default      | notes |
|---------------|---------|----------|--------------|-------|
| `scriptText`  | string  | yes      | —            | The approved narration script (≥10 chars). |
| `videoTitle`  | string  | no       | `"video"`    | Used for the output filename + logs. |
| `thumbnailUrl`| string  | no       | `null`       | Approved thumbnail; downloaded and stored with the job. |
| `voice`       | string  | no       | `"adam"`     | Voice name → ElevenLabs id (see `src/config/voices.js`). |
| `channelType` | string  | no       | `"psychology"`| Selects skill/style/composition (see `src/config/channels.js`). |
| `mock`        | boolean | no       | server default| `true` → stub assets, no paid APIs, no real render. |

```json
{
  "scriptText": "Have you ever replayed a tiny mistake for hours? ...",
  "videoTitle": "Why You Overthink Everything",
  "thumbnailUrl": "https://drive.google.com/.../thumb.png",
  "voice": "adam",
  "channelType": "psychology"
}
```

**Response** `202 Accepted`

```json
{ "jobId": "job_mpxxj5ad_08eb9ca2", "status": "queued" }
```

**Errors** `400` with `{ "error": "invalid_request", "details": [ ... ] }`.

---

## GET /status/:jobId

Poll job progress.

**Response** `200`

```json
{ "jobId": "job_...", "status": "rendering", "progress": 78, "phase": "render" }
```

`status` is one of: `queued`, `processing`, `rendering`, `completed`, `failed`.
`progress` is `0–100`. `phase` is the current pipeline stage
(`queued → prepare → plan → audio → images → subtitles → render → finalize`).

`404` if the job id is unknown.

---

## GET /result/:jobId

Fetch the final result.

**Completed** `200`

```json
{
  "jobId": "job_...",
  "status": "completed",
  "videoPath": "/abs/path/jobs/job_.../output/Why_You_Overthink_Everything.mp4",
  "relativeVideoPath": "jobs/job_.../output/Why_You_Overthink_Everything.mp4",
  "duration": 712,
  "frames": 21360,
  "thumbnailPath": "/abs/path/jobs/job_.../thumbnail.png"
}
```

**Still running** `202`

```json
{ "jobId": "job_...", "status": "rendering", "progress": 78,
  "message": "render not finished; poll GET /status/:jobId" }
```

**Failed** `200`

```json
{ "jobId": "job_...", "status": "failed", "error": "ElevenLabs 401 ..." }
```

---

## GET /health

Liveness + queue snapshot.

```json
{ "status": "ok", "mockDefault": false, "channels": ["psychology"],
  "queue": { "active": "job_...", "depth": 2, "pending": ["job_a","job_b"] },
  "uptimeSeconds": 1234 }
```

---

## Status lifecycle

```
queued ──► processing ──► rendering ──► completed
                 │              │
                 └──────────────┴──► failed
```

| status       | meaning |
|--------------|---------|
| `queued`     | accepted, waiting for the (serial) worker |
| `processing` | scene plan + audio + images + subtitles |
| `rendering`  | Remotion is rendering / finalizing the MP4 |
| `completed`  | MP4 ready at `videoPath` |
| `failed`     | see `error`; check `jobs/<id>/job.log` |

## Notes for integrators

- The queue is **serial** — one render at a time. Extra jobs stay `queued`.
- Job state is persisted to `jobs/<id>/job.json`; in-flight jobs are marked
  `failed` after a server restart (re-POST to retry).
- The engine returns a **local path**. Uploading to Google Drive is n8n's job
  (the engine deliberately does not talk to Drive).
- Every lifecycle event is logged as JSON to stdout and `jobs/<id>/job.log`.
