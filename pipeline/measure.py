"""
Step ②.5 — Apply measured (audio-first) timing to remotion.json.

This is where the project's #1 rule lands: the provisional WPM estimates are
replaced by the REAL ElevenLabs audio timing.

For each scene that has audio (assets/audio/<sceneId>.json sidecar):
  - audioDuration  = measured spoken length (+ a small tail pad)
  - subtitles      = phrase cues built from character timestamps
  - image durations = the measured scene length split across its images
  - startTime/endTime = cumulative running sum across the whole timeline
  - assert every image ≤ 7.0s; warn (don't crash) on any scene that now needs
    an extra image because the real audio ran longer than the estimate.

Scenes without audio yet keep their provisional values (so partial previews work).
Idempotent — safe to re-run after regenerating any scene's audio.

Run:  python pipeline/measure.py
"""

import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

import _workspace as ws

ROOT = ws.project_root()
load_dotenv(ws.REPO_ROOT / ".env", override=False)

TAIL_PAD = float(os.environ.get("AUDIO_TAIL_PAD", "0.3"))  # gap after each scene
MAX_WORDS_PER_CUE = 7
CAP = 7.0


def _flush(buf, cues):
    """Emit buf (a list of words within ONE sentence) as cues of ≤ MAX words."""
    for i in range(0, len(buf), MAX_WORDS_PER_CUE):
        chunk = buf[i : i + MAX_WORDS_PER_CUE]
        cues.append({
            "text": " ".join(w for w, _, _ in chunk),
            "start": round(chunk[0][1], 3),
            "end": round(chunk[-1][2], 3),
        })


def build_subtitles(chars, starts, ends):
    """
    Group character timestamps into subtitle cues that never cross a sentence
    boundary, then split long sentences into ≤ MAX_WORDS_PER_CUE chunks. This
    keeps every cue starting at a natural sentence/clause start.
    """
    # em/en dashes are spoken as pauses, not words — drop them from captions
    # (treat as a word boundary, never display the dash itself).
    DROP = "—–"  # — –
    words = []  # (text, start, end)
    cur, w_start, w_end = "", None, None
    for ch, st, en in zip(chars, starts, ends):
        if ch.isspace() or ch in DROP:
            if cur:
                words.append((cur, w_start, w_end))
                cur, w_start, w_end = "", None, None
        else:
            if not cur:
                w_start = st
            cur, w_end = cur + ch, en
    if cur:
        words.append((cur, w_start, w_end))

    cues, sentence = [], []
    for text, st, en in words:
        sentence.append((text, st, en))
        # treat as sentence end even with a trailing quote/paren, e.g. me?"
        stripped = text.rstrip('")\'’”')
        if stripped and stripped[-1] in ".!?":
            _flush(sentence, cues)
            sentence = []
    if sentence:
        _flush(sentence, cues)
    return cues


def main() -> None:
    scenes = json.loads((ROOT / "remotion.json").read_text())

    cursor = 0.0
    measured = 0
    over_cap = []          # scenes whose image dwell now exceeds 7s
    total_words = total_spoken = 0.0

    for s in scenes:
        sidecar = (ROOT / s["audioPath"]).with_suffix(".json")
        if sidecar.exists():
            a = json.loads(sidecar.read_text())
            spoken = a["ends"][-1] if a["ends"] else 0.0
            dur = round(spoken + TAIL_PAD, 3)
            s["audioDuration"] = dur
            s["subtitles"] = build_subtitles(a["characters"], a["starts"], a["ends"])
            n = len(s["images"])
            dwell = round(dur / n, 3)
            for img in s["images"]:
                img["duration"] = dwell
            if dwell > CAP:
                need = -(-int(dur * 1000) // int(CAP * 1000))  # ceil(dur/CAP)
                over_cap.append((s["sceneId"], dwell, n, need))
            measured += 1
            total_words += len(s["voiceover"].split())
            total_spoken += spoken
        else:
            dur = float(s.get("estimatedDuration") or
                        sum(i["duration"] for i in s["images"]))

        s["startTime"] = round(cursor, 3)
        s["endTime"] = round(cursor + dur, 3)
        cursor += dur

    (ROOT / "remotion.json").write_text(
        json.dumps(scenes, indent=2, ensure_ascii=False))

    print(f"Measured {measured}/{len(scenes)} scenes.")
    print(f"Timeline length: {round(cursor, 1)}s "
          f"({'partial — ' if measured < len(scenes) else ''}"
          f"{measured} measured + {len(scenes) - measured} still estimated)")
    if total_spoken:
        wpm = total_words / (total_spoken / 60)
        print(f"Measured pace: {wpm:.0f} WPM "
              f"(target 150 → adjust ELEVENLABS_SPEED if far off)")
    if over_cap:
        print(f"\n⚠ {len(over_cap)} scene(s) exceed the {CAP}s cap after real audio "
              f"(audio ran longer than estimated). Regenerate these with more images:")
        for sid, dwell, n, need in over_cap:
            print(f"  - {sid}: {dwell}s/image across {n} imgs → needs ≥{need} images")
    print("\n✓ remotion.json updated with measured timing. "
          "Next: preview in Remotion.")


if __name__ == "__main__":
    main()
