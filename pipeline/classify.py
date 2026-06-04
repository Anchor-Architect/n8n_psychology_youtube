"""
Step ① — Script → scenes (the skill pass).

Reads the script from input/script/, loads the `script-reviewer` skill
(SKILL.md + references), and runs a full production pass through the Claude API.

Because a long script produces ~100 images, the output is CHUNKED so no single
response is truncated:
  Pass 1  → scene split + image counts (Jobs 7–8)
  Pass 2  → per scene: visual beats + replicate prompts + remotion scene (Jobs 9–11)
The script is assumed already reviewed/polished, so the skill's review passes
(Jobs 1–6) are skipped. The large skill prompt is cached, so the repeated
per-scene calls stay cheap.

Outputs:
  out/plan.md       scene + image-count plan (Job 8 table)
  replicate.json    image prompts, one per visual beat (Job 10)
  remotion.json     assembly timeline, one per scene (Job 11)
                    timing fields are PROVISIONAL here — audioDuration is null,
                    subtitles are []; the generate/measure step fills real values.
                    startTime/endTime are cumulative estimates computed in Python.

Run:  python pipeline/classify.py
"""

import json
import os
import re
import sys
from pathlib import Path

from anthropic import Anthropic
from dotenv import load_dotenv

import _workspace as ws

ROOT = ws.project_root()
SKILL_DIR = ws.skill_dir()
SCRIPT_DIR = ROOT / "input" / "script"
OUT_DIR = ROOT / "out"

# Keys come from the repo .env (or the env the API server passes through).
load_dotenv(ws.REPO_ROOT / ".env", override=False)

MODEL = os.environ.get("CLASSIFY_MODEL", "claude-opus-4-8")

client: Anthropic  # set in main()


# ── loading ────────────────────────────────────────────────────────────────

def find_script() -> Path:
    candidates = sorted(
        p for p in SCRIPT_DIR.glob("*") if p.suffix.lower() in {".txt", ".md"}
    )
    if not candidates:
        sys.exit(f"No script found. Put a .txt or .md file in {SCRIPT_DIR}/")
    if len(candidates) > 1:
        print(f"Multiple scripts found; using the first: {candidates[0].name}")
    return candidates[0]


def load_skill() -> str:
    parts = [f"# === SKILL.md ===\n{(SKILL_DIR / 'SKILL.md').read_text()}"]
    for ref in sorted((SKILL_DIR / "references").glob("*.md")):
        parts.append(f"\n\n# === references/{ref.name} ===\n{ref.read_text()}")
    style = ws.style_path()
    if style.exists():
        parts.append(f"\n\n# === assets/reference/STYLE.md ===\n{style.read_text()}")
    return "".join(parts)


# ── claude helper (skill cached across all calls) ────────────────────────────

def call_claude(skill: str, instructions: str, user: str, max_tokens: int) -> str:
    resp = client.messages.create(
        model=MODEL,
        max_tokens=max_tokens,
        system=[
            {"type": "text", "text": instructions},
            {"type": "text", "text": skill, "cache_control": {"type": "ephemeral"}},
        ],
        messages=[{"role": "user", "content": user}],
    )
    if resp.stop_reason == "max_tokens":
        sys.exit(f"A call hit max_tokens (truncated). Raise max_tokens or chunk smaller.")
    return "".join(b.text for b in resp.content if b.type == "text")


def parse_json(text: str):
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:]
    s = text
    a, b = s.find("{"), s.rfind("}")
    c, d = s.find("["), s.rfind("]")
    # pick whichever bracket type wraps the whole payload
    payload = s[c : d + 1] if (a == -1 or (c != -1 and c < a)) else s[a : b + 1]
    try:
        return json.loads(payload)
    except json.JSONDecodeError:
        # tolerate the common LLM slip: trailing commas before } or ]
        return json.loads(re.sub(r",(\s*[}\]])", r"\1", payload))


# ── Pass 1: review + scene split ─────────────────────────────────────────────

PASS1 = """You are running the `script-reviewer` skill (below) as an automated \
pipeline step. The script is ALREADY reviewed and polished, so SKIP the review \
passes (Jobs 1–6). Do ONLY Jobs 7–8: scene split + image counts. Do NOT write \
image prompts or the remotion timeline yet.

Return ONE JSON object, nothing else:
{
  "image_plan_markdown": "the Job 8 table + 7s-cap confirmation, noting durations are provisional/audio-first.",
  "scenes": [
    {
      "sceneId": "S01",
      "label": "Hook",
      "role": "...",
      "voiceover": "the exact script lines belonging to this scene, joined into the spoken text",
      "imageCount": 3
    }
  ]
}
Rules: split by meaning (Job 7). imageCount per Job 8 including the 7s safety margin. \
Every spoken line belongs to exactly one scene, in order.

SCENE GRANULARITY — split FINELY by meaning flow, NOT by the script's big sections. \
Any "=== ... ===" headers are coarse ACT markers; do NOT use them as the scene \
boundaries. Each scene should be one tight beat — typically a few sentences, about \
10-25 seconds of speech. A ~9-minute script should yield roughly 15-25 scenes, not \
5-6. Keeping scenes short keeps audio in sync with images and keeps each image under \
the 7s cap.

IMPORTANT — the script may contain non-spoken markup. Use it ONLY to understand \
structure; NEVER put it in any `voiceover`. Exclude entirely from voiceover: the \
title line, parenthetical production notes like "(Final narration script ...)", \
section headers like "=== 3. PROOF (1:45-5:30) ===", any timecodes, horizontal rules \
"---", and a trailing "Sources:" / citation block. `voiceover` must contain ONLY the \
words a narrator actually speaks. Output strict JSON, no code fences."""


def pass1(skill: str, script: str) -> dict:
    print("Pass 1: scene split + image counts ...", flush=True)
    out = call_claude(skill, PASS1,
                      f"Here is the script.\n\n<script>\n{script}\n</script>",
                      max_tokens=16000)
    return parse_json(out)


# ── Pass 2: per-scene beats + json ───────────────────────────────────────────

PASS2 = """You are running the `script-reviewer` skill (below). Do Jobs 9–11 for \
ONE scene only. Produce its visual beats and the image prompts + the remotion scene object.

Return ONE JSON object, nothing else:
{
  "sceneId": "S01",
  "label": "...",
  "role": "...",
  "voiceover": "...",
  "caption": "...",
  "estimatedDuration": 7.2,
  "images": [
    {"imageId": "S01_001", "src": "assets/images/S01_001.png", "duration": 3.6, "motion": "slowZoomIn"}
  ],
  "replicate": [
    {"imageId": "S01_001", "sceneId": "S01", "prompt": "<built from coreSymbol+visualPurpose+emotionalTone> + fixed 16:9 style block", "negativePrompt": "...", "outputPath": "assets/images/S01_001.png"}
  ]
}
Rules:
- Exactly imageCount images, numbered S<NN>_001..00N for this sceneId.
- Every image duration ≤ 7.0. src must equal the matching replicate outputPath exactly (assets/images/<imageId>.png).
- Use the fixed 16:9 style block from the skill / STYLE.md on every prompt; name the single accent color when used.
- Images contain NO text; prompt and negativePrompt both enforce that.
- estimatedDuration is provisional (audio-first); real timing is filled later.
Output strict JSON, no code fences."""


def pass2(skill: str, scene: dict) -> dict:
    user = (
        f"Scene to expand:\n{json.dumps(scene, ensure_ascii=False, indent=2)}\n\n"
        f"Produce its beats, replicate prompts, and remotion scene object."
    )
    for attempt in range(2):
        try:
            return parse_json(call_claude(skill, PASS2, user, max_tokens=8000))
        except json.JSONDecodeError:
            if attempt == 1:
                raise
            print("    (invalid JSON, retrying)", flush=True)


# ── mock (no Anthropic) ──────────────────────────────────────────────────────

MOTIONS = ["slowZoomIn", "slowZoomOut", "slowPanRight", "slowPanLeft", "fadeIn"]


def _mock_scene_texts(script: str) -> list[str]:
    """Split the raw script into scene-sized chunks without calling an LLM.

    Prefers blank-line paragraphs; if the script is one block, falls back to
    grouping sentences. Lines that are obvious non-spoken markup are dropped.
    """
    def spoken(line: str) -> bool:
        s = line.strip()
        if not s:
            return False
        if s.startswith(("#", "===", "---", "Sources:", "(")):
            return False
        return True

    paras = [
        " ".join(l.strip() for l in block.splitlines() if spoken(l)).strip()
        for block in re.split(r"\n\s*\n", script)
    ]
    paras = [p for p in paras if p]
    if len(paras) >= 2:
        return paras

    # one big block → chunk by sentences, ~45 words per scene
    sentences = re.split(r"(?<=[.!?])\s+", " ".join(paras) or script)
    chunks, cur, n = [], [], 0
    for sent in sentences:
        cur.append(sent)
        n += len(sent.split())
        if n >= 45:
            chunks.append(" ".join(cur).strip())
            cur, n = [], 0
    if cur:
        chunks.append(" ".join(cur).strip())
    return [c for c in chunks if c] or [script.strip()]


def mock_main() -> None:
    """Deterministic stand-in for the skill pass — builds valid JSON for free."""
    script_path = find_script()
    script = script_path.read_text()
    texts = _mock_scene_texts(script)
    print(f"[MOCK] Script: {script_path.name} ({len(script.split())} words) "
          f"→ {len(texts)} scenes")

    WPM = 150.0
    CAP = 7.0
    replicate: list = []
    remotion: list = []
    cursor = 0.0
    for i, text in enumerate(texts, 1):
        sid = f"S{i:02d}"
        words = max(1, len(text.split()))
        dur = round(words / WPM * 60.0, 3)
        n_img = max(1, -(-int(dur * 1000) // int(CAP * 1000)))  # ceil(dur/CAP)
        dwell = round(dur / n_img, 3)
        images, reps = [], []
        for k in range(1, n_img + 1):
            iid = f"{sid}_{k:03d}"
            path = f"assets/images/{iid}.png"
            images.append({
                "imageId": iid, "src": path,
                "duration": dwell, "motion": MOTIONS[(i + k) % len(MOTIONS)],
            })
            reps.append({
                "imageId": iid, "sceneId": sid,
                "prompt": ("Minimalist 2D stick figure illustration, flat cream "
                           "background, mostly grayscale, simple doodle style, "
                           "wide 16:9 composition, no text overlays. [MOCK]"),
                "negativePrompt": "text, words, letters, watermark",
                "outputPath": path,
            })
        replicate.extend(reps)
        remotion.append({
            "sceneId": sid, "label": f"Scene {i}", "role": "body",
            "voiceover": text,
            "audioPath": f"assets/audio/{sid}.mp3",
            "audioDuration": None,
            "startTime": round(cursor, 3),
            "endTime": round(cursor + dur, 3),
            "estimatedDuration": dur,
            "subtitles": [],
            "images": images,
            "caption": text,
        })
        cursor += dur

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "plan.md").write_text(
        f"# MOCK plan\n\n{len(remotion)} scenes, {len(replicate)} images, "
        f"~{round(cursor)}s estimated (audio-first; real timing filled by measure).\n")
    (ROOT / "replicate.json").write_text(json.dumps(replicate, indent=2, ensure_ascii=False))
    (ROOT / "remotion.json").write_text(json.dumps(remotion, indent=2, ensure_ascii=False))
    print(f"[MOCK] ✓ remotion.json ({len(remotion)} scenes), "
          f"replicate.json ({len(replicate)} images)")


# ── assembly ─────────────────────────────────────────────────────────────────

def main() -> None:
    if ws.is_mock():
        return mock_main()
    global client
    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("ANTHROPIC_API_KEY is empty in .env — fill it in first.")
    client = Anthropic()

    script_path = find_script()
    script = script_path.read_text()
    skill = load_skill()
    print(f"Script: {script_path.name} ({len(script.split())} words)")
    print(f"Model:  {MODEL}\n")

    plan = pass1(skill, script)
    scenes = plan["scenes"]
    print(f"  {len(scenes)} scenes, "
          f"{sum(s['imageCount'] for s in scenes)} images planned\n")

    replicate: list = []
    remotion: list = []
    cursor = 0.0
    for i, scene in enumerate(scenes, 1):
        print(f"Pass 2 [{i}/{len(scenes)}] {scene['sceneId']} "
              f"({scene['imageCount']} imgs) ...", flush=True)
        r = pass2(skill, scene)
        replicate.extend(r["replicate"])
        dur = float(r.get("estimatedDuration") or sum(im["duration"] for im in r["images"]))
        remotion.append({
            "sceneId": r["sceneId"],
            "label": r.get("label", scene.get("label")),
            "role": r.get("role", scene.get("role")),
            "voiceover": r.get("voiceover", scene.get("voiceover")),
            "audioPath": f"assets/audio/{r['sceneId']}.mp3",
            "audioDuration": None,            # filled by measure step (audio-first)
            "startTime": round(cursor, 3),    # provisional cumulative estimate
            "endTime": round(cursor + dur, 3),
            "estimatedDuration": round(dur, 3),
            "subtitles": [],                  # filled by measure step
            "images": r["images"],
            "caption": r.get("caption", r.get("voiceover", "")),
        })
        cursor += dur

    OUT_DIR.mkdir(exist_ok=True)
    (OUT_DIR / "plan.md").write_text(plan.get("image_plan_markdown", ""))
    (ROOT / "replicate.json").write_text(json.dumps(replicate, indent=2, ensure_ascii=False))
    (ROOT / "remotion.json").write_text(json.dumps(remotion, indent=2, ensure_ascii=False))

    print(f"\n✓ out/plan.md  (scene/image plan)")
    print(f"✓ replicate.json  ({len(replicate)} images)")
    print(f"✓ remotion.json   ({len(remotion)} scenes, "
          f"~{round(cursor)}s estimated)")
    print("\nNext: python pipeline/validate.py")


if __name__ == "__main__":
    main()
