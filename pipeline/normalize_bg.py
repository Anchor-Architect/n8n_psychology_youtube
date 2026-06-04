"""
Normalize image backgrounds to one uniform cream tone.

flux-schnell won't reliably honor a background color, so some images come out
white and others cream. This is a deterministic post-process: every bright,
low-saturation pixel (white / off-white background AND the character's white
interior fills) is remapped to a single cream color. Black outlines, gray
objects, and the selective accent colors (red/green/etc.) are left untouched.

A one-time backup of the originals is kept in assets/images_raw/ so this is
reversible and re-runnable.

  python pipeline/normalize_bg.py            # all images
  python pipeline/normalize_bg.py --scene S02
"""

import argparse
import shutil
from pathlib import Path

import numpy as np
from PIL import Image

import _workspace as ws

ROOT = ws.project_root()
IMG_DIR = ROOT / "assets" / "images"
RAW_DIR = ROOT / "assets" / "images_raw"

CREAM = np.array([244, 241, 232], dtype=np.uint8)
BRIGHT_MIN = 232   # pixel is "light" if its max channel exceeds this
SAT_MAX = 18       # and near-neutral (max-min channel spread below this)


def normalize(path: Path) -> None:
    img = Image.open(path).convert("RGB")
    arr = np.asarray(img).astype(np.int16)
    mx = arr.max(axis=-1)
    mn = arr.min(axis=-1)
    mask = (mx > BRIGHT_MIN) & ((mx - mn) < SAT_MAX)
    out = arr.astype(np.uint8)
    out[mask] = CREAM
    Image.fromarray(out).save(path)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--scene", help="only this sceneId prefix, e.g. S02")
    args = ap.parse_args()

    RAW_DIR.mkdir(exist_ok=True)
    pattern = f"{args.scene}_*.png" if args.scene else "*.png"
    files = sorted(IMG_DIR.glob(pattern))
    for f in files:
        backup = RAW_DIR / f.name
        if not backup.exists():           # keep pristine original once
            shutil.copy2(f, backup)
        normalize(f)
    print(f"✓ normalized {len(files)} image(s) to uniform cream "
          f"(originals backed up in assets/images_raw/).")


if __name__ == "__main__":
    main()
