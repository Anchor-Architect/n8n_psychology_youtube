"""
Prepare for a NEW video: archive the finished one, clear working files.

The pipeline names scenes S01, S02, ... every time, so leftover audio/images
from the previous video would be silently REUSED (generate.py skips existing
files). Run this between videos.

It ARCHIVES the previous result (nothing is lost):
    out/archive/<timestamp>/  ← final.mp4, replicate.json, remotion.json,
                                review.md, youtube_description.txt
and CLEARS the working assets so the next run starts clean:
    assets/images/*, assets/audio/*, assets/images_raw/*,
    replicate.json, remotion.json, out/*preview*/bg stills

It does NOT touch: input/script/ (you replace that), the skill, .env.

  python pipeline/reset.py            # archive + clear
  python pipeline/reset.py --no-archive   # just clear (discard previous)
"""

import argparse
import shutil
import time
from pathlib import Path

import _workspace as ws

ROOT = ws.project_root()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-archive", action="store_true")
    args = ap.parse_args()

    if not args.no_archive:
        stamp = time.strftime("%Y%m%d-%H%M%S")
        dest = ROOT / "out" / "archive" / stamp
        dest.mkdir(parents=True, exist_ok=True)
        for name in ["final.mp4", "plan.md", "youtube_description.txt"]:
            src = ROOT / "out" / name
            if src.exists():
                shutil.move(str(src), dest / name)
        for name in ["replicate.json", "remotion.json"]:
            src = ROOT / name
            if src.exists():
                shutil.copy2(src, dest / name)
        print(f"archived previous video → out/archive/{stamp}/")

    # clear working assets
    for sub in ["images", "audio", "images_raw"]:
        d = ROOT / "assets" / sub
        if d.exists():
            for f in d.iterdir():
                if f.is_file():
                    f.unlink()
    for f in (ROOT / "out").glob("*.png"):   # preview / bg stills
        f.unlink()
    for name in ["replicate.json", "remotion.json"]:
        p = ROOT / name
        if p.exists():
            p.unlink()

    print("✓ cleared images, audio, replicate.json, remotion.json, preview stills.")
    print("Ready for a new script in input/script/.")


if __name__ == "__main__":
    main()
