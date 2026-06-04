"""
Dev helper — write cream placeholder PNGs for any image not yet generated.

Lets the Remotion preview run end-to-end (real audio + timing + captions + motion)
before Replicate images exist. Real flux PNGs from generate.py overwrite these at
the same outputPath. Placeholders are clearly marked so they're never mistaken for
final art.

  python pipeline/placeholders.py            # fill all missing
  python pipeline/placeholders.py --limit 2  # only first 2 scenes' images
"""

import argparse
import json
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
CREAM = (244, 241, 232)
INK = (40, 40, 40)
W, H = 1280, 720  # 16:9


def core_symbol(prompt: str) -> str:
    # first clause of the prompt = the concrete subject of the image
    return prompt.split(",")[0].split(".")[0].strip()[:90]


def make(rep: dict) -> None:
    out = ROOT / rep["outputPath"]
    out.parent.mkdir(parents=True, exist_ok=True)
    img = Image.new("RGB", (W, H), CREAM)
    d = ImageDraw.Draw(img)
    d.rectangle([8, 8, W - 8, H - 8], outline=(200, 195, 185), width=3)
    d.text((40, 40), f"{rep['imageId']}  (PLACEHOLDER)", fill=(150, 145, 135))
    y = 300
    for line in textwrap.wrap(core_symbol(rep["prompt"]), 46):
        d.text((40, y), line, fill=INK)
        y += 28
    img.save(out)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int)
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    images = json.loads((ROOT / "replicate.json").read_text())
    if args.limit:
        scenes = json.loads((ROOT / "remotion.json").read_text())
        allowed = {s["sceneId"] for s in scenes[: args.limit]}
        images = [r for r in images if r["sceneId"] in allowed]

    made = 0
    for rep in images:
        if (ROOT / rep["outputPath"]).exists() and not args.force:
            continue
        make(rep)
        made += 1
    print(f"✓ wrote {made} placeholder PNG(s).")


if __name__ == "__main__":
    main()
