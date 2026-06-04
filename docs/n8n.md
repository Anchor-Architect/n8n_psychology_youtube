# n8n Integration

Workflow #3 calls this engine after a script + thumbnail are approved, waits for
the render, then uploads the MP4 to Google Drive.

```
Approved script + thumbnail
        │
   [HTTP] POST /render ───────────────► { jobId, status: "queued" }
        │
        ▼
   [Wait]  (e.g. 30s)
        │
   [HTTP] GET /status/:jobId ─────────► { status, progress }
        │
   [IF] status == "completed"? ──no──► back to [Wait]   (loop)
        │ yes
        ▼
   [HTTP] GET /result/:jobId ─────────► { videoPath, duration }
        │
        ▼
   [Read Binary File] videoPath
        │
        ▼
   [Google Drive] Upload
```

## 1) POST /render — HTTP Request node

- **Method:** `POST`
- **URL:** `http://YOUR_ENGINE_HOST:8080/render`
- **Body Content Type:** `JSON`
- **Body:**

```json
{
  "scriptText": "={{ $json.approvedScript }}",
  "videoTitle": "={{ $json.title }}",
  "thumbnailUrl": "={{ $json.thumbnailUrl }}",
  "voice": "adam",
  "channelType": "psychology"
}
```

Save `{{ $json.jobId }}` for the next steps.

## 2) Poll loop — Wait → GET /status → IF

**Wait node:** 30 seconds (renders take minutes; polling every 20–30s is plenty).

**HTTP Request (status):**
- **Method:** `GET`
- **URL:** `http://YOUR_ENGINE_HOST:8080/status/{{ $json.jobId }}`

**IF node:** continue when
`{{ $json.status === "completed" }}` is true. Add a second branch for
`{{ $json.status === "failed" }}` → error handling. Otherwise loop back to Wait.

> Tip: also stop the loop after N iterations as a safety timeout.

## 3) GET /result — HTTP Request node

- **Method:** `GET`
- **URL:** `http://YOUR_ENGINE_HOST:8080/result/{{ $json.jobId }}`

Returns `videoPath` (absolute) and `duration`.

## 4) Get the file to Google Drive

If n8n runs **on the same host** as the engine, use a **Read Binary File** node
with `{{ $json.videoPath }}`, then a **Google Drive → Upload** node.

If n8n is **n8n Cloud** (separate host), it cannot read the engine's local disk.
Two options:
- Have the engine host expose the file (e.g. a static file server / signed URL)
  and use **HTTP Request → Download** in n8n; or
- Run a small companion step on the engine host that pushes the MP4 to Drive.

The engine intentionally returns a path and leaves the upload to your workflow.

## curl equivalents (for quick testing)

```bash
HOST=http://localhost:8080

# 1) submit
JOB=$(curl -s -X POST $HOST/render -H 'content-type: application/json' \
  -d '{"scriptText":"...your script...","videoTitle":"Demo","voice":"adam","channelType":"psychology","mock":true}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["jobId"])')
echo "job=$JOB"

# 2) poll
curl -s $HOST/status/$JOB

# 3) result
curl -s $HOST/result/$JOB
```

Add `"mock": true` to the body to test the whole flow without spending any
Anthropic / ElevenLabs / Replicate credits.
