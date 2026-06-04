"""
Step ①.5 — Validate the skill output before spending money on generation.

Checks the cross-file invariants the skill promises:
  - every remotion image `src` has a matching replicate `outputPath` (and vice versa)
  - no image duration exceeds the 7s hard cap
  - audioDuration is null and subtitles is [] (timing is still provisional here)
  - imageId format S<NN>_<NNN>

Run:  python pipeline/validate.py
Exits non-zero on any failure so it can gate the pipeline.
"""

import json
import re
import sys
from pathlib import Path

import _workspace as ws

ROOT = ws.project_root()
ID_RE = re.compile(r"^S\d{2}_\d{3}$")

errors: list[str] = []


def load(name: str):
    p = ROOT / name
    if not p.exists():
        sys.exit(f"{name} not found — run pipeline/classify.py first.")
    return json.loads(p.read_text())


def main() -> None:
    replicate = load("replicate.json")
    remotion = load("remotion.json")

    rep_paths = {}
    for r in replicate:
        if not ID_RE.match(r.get("imageId", "")):
            errors.append(f"bad imageId: {r.get('imageId')!r}")
        rep_paths[r["imageId"]] = r["outputPath"]
        if r["outputPath"] != f"assets/images/{r['imageId']}.png":
            errors.append(f"{r['imageId']}: outputPath mismatch -> {r['outputPath']}")
        if "no text" not in r["prompt"].lower():
            errors.append(f"{r['imageId']}: prompt missing 'no text'")

    used = set()
    for s in remotion:
        if s.get("audioDuration") is not None:
            errors.append(f"{s['sceneId']}: audioDuration must be null (audio-first)")
        if s.get("subtitles"):
            errors.append(f"{s['sceneId']}: subtitles must be [] at classify stage")
        for img in s["images"]:
            used.add(img["imageId"])
            if img["duration"] > 7.0:
                errors.append(
                    f"{img['imageId']}: duration {img['duration']}s exceeds 7s cap"
                )
            if rep_paths.get(img["imageId"]) != img["src"]:
                errors.append(
                    f"{img['imageId']}: src {img['src']} != replicate outputPath"
                )

    missing = set(rep_paths) - used
    orphan = used - set(rep_paths)
    if missing:
        errors.append(f"images in replicate.json but unused in remotion.json: {missing}")
    if orphan:
        errors.append(f"images in remotion.json with no replicate prompt: {orphan}")

    if errors:
        print("✗ validation failed:")
        for e in errors:
            print(f"  - {e}")
        sys.exit(1)
    print(f"✓ valid: {len(replicate)} images across {len(remotion)} scenes, "
          f"all linked, all ≤ 7s.")


if __name__ == "__main__":
    main()
