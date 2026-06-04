"""
Fix a scene whose real audio overflowed the 7s/image cap (flagged by measure.py).

Re-runs the skill's beat split (Pass 2) for ONE scene at a higher image count,
patches replicate.json + remotion.json, then you regenerate that scene's images
and re-measure.

  python pipeline/recount.py --scene S14 --images 7
  python pipeline/generate.py --scene S14 --images-only --force
  python pipeline/measure.py
"""

import argparse
import json
import sys
from pathlib import Path

from anthropic import Anthropic

import classify  # reuse skill loading + Pass 2
import _workspace as ws

ROOT = ws.project_root()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--scene", required=True)
    ap.add_argument("--images", type=int, required=True)
    args = ap.parse_args()

    remotion = json.loads((ROOT / "remotion.json").read_text())
    replicate = json.loads((ROOT / "replicate.json").read_text())

    scene = next((s for s in remotion if s["sceneId"] == args.scene), None)
    if not scene:
        sys.exit(f"{args.scene} not found in remotion.json")

    classify.client = Anthropic()
    skill = classify.load_skill()
    spec = {
        "sceneId": scene["sceneId"],
        "label": scene["label"],
        "role": scene["role"],
        "voiceover": scene["voiceover"],
        "imageCount": args.images,
    }
    print(f"Re-splitting {args.scene} into {args.images} beats ...")
    new = classify.pass2(skill, spec)

    # patch replicate.json (keep scene order)
    idx = next(i for i, r in enumerate(replicate) if r["sceneId"] == args.scene)
    replicate = [r for r in replicate if r["sceneId"] != args.scene]
    for off, r in enumerate(new["replicate"]):
        replicate.insert(idx + off, r)

    # patch remotion.json (replace images only; audio/subtitles refilled by measure)
    scene["images"] = new["images"]

    (ROOT / "replicate.json").write_text(json.dumps(replicate, indent=2, ensure_ascii=False))
    (ROOT / "remotion.json").write_text(json.dumps(remotion, indent=2, ensure_ascii=False))
    print(f"✓ {args.scene} now has {len(new['images'])} images.")
    print(f"Next:\n  python pipeline/generate.py --scene {args.scene} --images-only --force"
          f"\n  python pipeline/measure.py")


if __name__ == "__main__":
    main()
