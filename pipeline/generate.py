"""
Step ② — Generate assets (audio ∥ images), in parallel.

ElevenLabs : one mp3 per scene (from remotion.json `voiceover`) + a sidecar
             <sceneId>.json holding character-level timestamps for subtitles.
Replicate  : one PNG per visual beat (from replicate.json `prompt`), 16:9.

Idempotent: existing files are skipped unless --force, so you can resume or
regenerate only specific scenes. Use --limit to validate the pipeline cheaply
on the first N scenes before spending on all ~121 images.

Examples:
  python pipeline/generate.py --limit 2          # first 2 scenes only (cheap test)
  python pipeline/generate.py                    # everything
  python pipeline/generate.py --scene S05 --force # redo one scene's assets
  python pipeline/generate.py --images-only
"""

import argparse
import base64
import json
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from dotenv import load_dotenv

import _workspace as ws

ROOT = ws.project_root()
load_dotenv(ws.REPO_ROOT / ".env", override=False)
MOCK = ws.is_mock()

# Paid SDKs are only needed for real generation; importing them lazily keeps
# mock runs free of credentials and (optionally) of the packages themselves.
if not MOCK:
    import replicate
    from elevenlabs.client import ElevenLabs
    from elevenlabs.types import VoiceSettings

VOICE_ID = os.environ.get("ELEVENLABS_VOICE_ID")
SPEED = float(os.environ.get("ELEVENLABS_SPEED", "1.0"))
TTS_MODEL = os.environ.get("ELEVENLABS_MODEL", "eleven_multilingual_v2")
FLUX_MODEL = os.environ.get("FLUX_MODEL", "black-forest-labs/flux-schnell")
# Voice consistency across the per-scene calls (v3 is expressive but drifts):
# a fixed seed + higher stability + feeding each scene the neighbouring text
# (previous_text/next_text) keeps tone/timbre steady from scene to scene.
SEED = os.environ.get("ELEVENLABS_SEED", "12345")
STABILITY = float(os.environ.get("ELEVENLABS_STABILITY", "0.5"))
# Audio clarity: 192kbps keeps more high-frequency detail than 128k (less "muffled");
# similarity_boost pulls output closer to the voice's full character.
OUTPUT_FORMAT = os.environ.get("ELEVENLABS_OUTPUT_FORMAT", "mp3_44100_192")
SIMILARITY = float(os.environ.get("ELEVENLABS_SIMILARITY", "0.85"))

eleven = None if MOCK else ElevenLabs(api_key=os.environ.get("ELEVENLABS_API_KEY"))


# ── mock generators (no paid APIs) ───────────────────────────────────────────

def _mock_audio(scene: dict) -> str:
    """Write a placeholder mp3 + a synthetic timestamp sidecar.

    The render step is stubbed in mock mode so the mp3 bytes are never decoded;
    only the sidecar (consumed by measure.py) needs realistic timings.
    """
    out = ROOT / scene["audioPath"]
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(b"")  # placeholder; not played in mock render

    text = scene["voiceover"]
    est = float(scene.get("estimatedDuration") or max(1.0, len(text.split()) / 2.5))
    chars = list(text)
    n = max(1, len(chars))
    per = est / n
    starts = [round(i * per, 3) for i in range(n)]
    ends = [round((i + 1) * per, 3) for i in range(n)]
    out.with_suffix(".json").write_text(json.dumps({
        "characters": chars, "starts": starts, "ends": ends,
    }))
    return f"✓ [MOCK] audio {scene['sceneId']}"


def _mock_image(rep: dict) -> str:
    from PIL import Image  # local import: only needed for mock stubs
    out = ROOT / rep["outputPath"]
    out.parent.mkdir(parents=True, exist_ok=True)
    Image.new("RGB", (1920, 1080), (244, 241, 232)).save(out)
    return f"✓ [MOCK] image {rep['imageId']}"


def gen_audio(scene: dict, force: bool) -> str:
    out = ROOT / scene["audioPath"]
    align = out.with_suffix(".json")
    if out.exists() and align.exists() and not force:
        return f"· skip audio {scene['sceneId']}"
    if MOCK:
        return _mock_audio(scene)
    out.parent.mkdir(parents=True, exist_ok=True)
    # ElevenLabs rejects concurrent calls for the same voice (409 already_running);
    # retry with backoff so parallel scene generation doesn't drop audio.
    kwargs = dict(
        voice_id=VOICE_ID,
        text=scene["voiceover"],
        model_id=TTS_MODEL,
        output_format=OUTPUT_FORMAT,
        voice_settings=VoiceSettings(
            speed=SPEED, stability=STABILITY,
            similarity_boost=SIMILARITY, use_speaker_boost=True),
    )
    if SEED:
        kwargs["seed"] = int(SEED)
    if scene.get("_prev"):            # context continuity → steadier voice
        kwargs["previous_text"] = scene["_prev"]
    if scene.get("_next"):
        kwargs["next_text"] = scene["_next"]
    last_err = None
    for attempt in range(5):
        try:
            r = eleven.text_to_speech.convert_with_timestamps(**kwargs)
            break
        except Exception as e:  # noqa: BLE001
            last_err = e
            if "409" in repr(e) or "already_running" in repr(e):
                time.sleep(2 * (attempt + 1))
                continue
            raise
    else:
        raise last_err
    out.write_bytes(base64.b64decode(r.audio_base_64))
    a = r.alignment
    align.write_text(json.dumps({
        "characters": a.characters,
        "starts": a.character_start_times_seconds,
        "ends": a.character_end_times_seconds,
    }))
    return f"✓ audio {scene['sceneId']}  ({out.name})"


def _retry_after(err: Exception, default: float) -> float:
    m = re.search(r"resets in ~?(\d+)s", repr(err))
    return float(m.group(1)) + 1 if m else default


def gen_image(rep: dict, force: bool) -> str:
    out = ROOT / rep["outputPath"]
    if out.exists() and not force:
        return f"· skip image {rep['imageId']}"
    if MOCK:
        return _mock_image(rep)
    out.parent.mkdir(parents=True, exist_ok=True)
    # Replicate throttles to 6 req/min (burst 1) while account credit < $5,
    # returning 429. Retry, honoring the "resets in ~Ns" hint.
    last_err = None
    for attempt in range(8):
        try:
            output = replicate.run(FLUX_MODEL, input={
                "prompt": rep["prompt"],
                "aspect_ratio": "16:9",
                "output_format": "png",
                "num_outputs": 1,
            })
            item = output[0] if isinstance(output, (list, tuple)) else output
            out.write_bytes(item.read())
            return f"✓ image {rep['imageId']}"
        except Exception as e:  # noqa: BLE001
            last_err = e
            if "429" in repr(e) or "throttled" in repr(e):
                time.sleep(_retry_after(e, 11))
                continue
            raise
    raise last_err


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, help="only the first N scenes")
    ap.add_argument("--scene", help="only this sceneId (e.g. S05)")
    ap.add_argument("--audio-only", action="store_true")
    ap.add_argument("--images-only", action="store_true")
    ap.add_argument("--force", action="store_true", help="regenerate existing files")
    ap.add_argument("--workers", type=int, default=4, help="audio concurrency")
    ap.add_argument("--img-workers", type=int, default=1,
                    help="image concurrency (Replicate allows burst 1 under $5 credit)")
    args = ap.parse_args()

    if not VOICE_ID and not MOCK:
        sys.exit("ELEVENLABS_VOICE_ID is empty in .env.")

    scenes = json.loads((ROOT / "remotion.json").read_text())
    images = json.loads((ROOT / "replicate.json").read_text())

    # neighbour text for voice continuity (computed on the FULL ordered list so
    # even a single --scene regen still uses the correct surrounding context)
    for i, s in enumerate(scenes):
        s["_prev"] = scenes[i - 1]["voiceover"] if i > 0 else ""
        s["_next"] = scenes[i + 1]["voiceover"] if i < len(scenes) - 1 else ""

    if args.scene:
        scenes = [s for s in scenes if s["sceneId"] == args.scene]
    elif args.limit:
        scenes = scenes[: args.limit]
    allowed = {s["sceneId"] for s in scenes}
    images = [r for r in images if r["sceneId"] in allowed]

    tasks = []
    if not args.images_only:
        tasks += [("audio", s) for s in scenes]
    if not args.audio_only:
        tasks += [("image", r) for r in images]

    n_a = sum(1 for t, _ in tasks if t == "audio")
    n_i = sum(1 for t, _ in tasks if t == "image")
    print(f"Scenes: {len(scenes)}  |  audio: {n_a}  images: {n_i}  "
          f"(speed={SPEED}, audio×{args.workers}, image×{args.img_workers})\n")

    errors = []
    # Audio runs in parallel; images run on their own (serial) pool because
    # Replicate throttles concurrent predictions under low credit.
    with ThreadPoolExecutor(max_workers=args.workers) as a_ex, \
            ThreadPoolExecutor(max_workers=args.img_workers) as i_ex:
        futs = {}
        for kind, obj in tasks:
            ex = a_ex if kind == "audio" else i_ex
            fn = gen_audio if kind == "audio" else gen_image
            futs[ex.submit(fn, obj, args.force)] = (kind, obj)
        total = len(futs)
        done = 0
        for fut in as_completed(futs):
            kind, obj = futs[fut]
            done += 1
            try:
                print(f"[{done}/{total}] {fut.result()}", flush=True)
            except Exception as e:  # noqa: BLE001 — keep going, report at end
                ident = obj.get("sceneId") or obj.get("imageId")
                errors.append((ident, repr(e)))
                print(f"[{done}/{total}] ✗ {kind} {ident}: {e}", flush=True)

    if errors:
        print(f"\n{len(errors)} failed:")
        for ident, e in errors:
            print(f"  - {ident}: {e}")
        sys.exit(1)
    print("\n✓ generation complete. Next: python pipeline/measure.py"
          + (f" --limit {args.limit}" if args.limit else ""))


if __name__ == "__main__":
    main()
