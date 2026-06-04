"""
One-command pipeline: script  →  preview-ready assets  (render NOT included).

Runs every step in order, stopping on the first failure:
    (reset) → classify → validate → generate → normalize_bg → measure

Usage:
    # NEW video: archive the previous one, clear assets, then build
    .venv/bin/python pipeline/run.py --new

    # resume after a failure (keeps the existing scene split, skips classify)
    .venv/bin/python pipeline/run.py

After it finishes, preview in Remotion (no render):
    cd remotion && npm run preview        # http://localhost:3000
And when you're happy, render separately:
    cd remotion && npx remotion render src/index.ts Psychology ../out/final.mp4

Run with the venv python so every step uses the installed deps.
"""

import argparse
import subprocess
import sys
from pathlib import Path

import _workspace as ws

ROOT = ws.project_root()
PY = sys.executable  # the interpreter run.py was launched with (use the venv one)


def step(title: str, args: list[str]) -> None:
    print(f"\n{'='*60}\n▶ {title}\n{'='*60}", flush=True)
    if subprocess.run([PY, *args], cwd=ROOT).returncode != 0:
        sys.exit(f"\n✗ {title} failed. Fix the cause and re-run "
                 f"`python pipeline/run.py` to resume.")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--new", action="store_true",
                    help="archive previous video + clear assets before building")
    ap.add_argument("--img-workers", type=int, default=1,
                    help="image concurrency (1 is safe under Replicate's low-credit throttle)")
    args = ap.parse_args()

    if args.new:
        step("reset (archive previous + clear assets)", ["pipeline/reset.py"])

    # Skip classify on a resume so the scene split (and image IDs) stay stable;
    # force a fresh split only for a new video or when none exists yet.
    if args.new or not (ROOT / "remotion.json").exists():
        step("classify (script → scenes + JSON)", ["pipeline/classify.py"])
        step("validate (links + 7s cap)", ["pipeline/validate.py"])
    else:
        print("\n• remotion.json exists → skipping classify "
              "(use --new to re-split a new script)")

    step("generate (audio ∥ images)",
         ["pipeline/generate.py", "--img-workers", str(args.img_workers)])
    step("normalize_bg (uniform cream)", ["pipeline/normalize_bg.py"])
    step("measure (audio-first timing + subtitles)", ["pipeline/measure.py"])

    print(f"\n{'='*60}")
    print("✓ Pipeline complete — assets ready (render NOT run).")
    print("  Preview:  cd remotion && npm run preview      → http://localhost:3000")
    print("  Render:   cd remotion && npx remotion render src/index.ts Psychology ../out/final.mp4")
    print("\n  ⚠ Check the measure output above:")
    print("    - 'Measured pace: NNN WPM' far from 150? adjust ELEVENLABS_SPEED in .env,")
    print("      then: python pipeline/generate.py --audio-only --force && python pipeline/measure.py")
    print("    - any '7.0s cap' warning? run: python pipeline/recount.py --scene SXX --images N")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
