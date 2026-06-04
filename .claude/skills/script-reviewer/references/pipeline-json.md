# Pipeline JSON (Jobs 10–11)

Two separate JSON outputs, linked by `imageId`. Keep them separate — this mirrors the real tool split.

- **Replicate JSON** (`replicate.json`) = instructions to *create* images. Has prompts. No timeline.
- **Remotion JSON** (`remotion.json`) = instructions to *assemble* the video. References already-created image paths + audio. No prompts.

## Fixed style block

All Replicate prompts share one fixed style block appended to the end, so every image looks consistent. **This project already has a character reference — read `assets/reference/STYLE.md` and use its style token.** Do not invent a new style. The current project style block (16:9 stickman psychology channel) is:

`Minimalist 2D stick figure illustration, round blank head with two small dot eyes, thin hand-drawn black outlines, flat uniform warm cream background (solid pale beige #f4f1e8, filling the entire frame, no gradient, no vignette, no background shading), mostly grayscale with a single selective accent color, simple doodle style, lots of negative space, soft elliptical ground shadow, wide 16:9 composition, no text overlays.`

The style block must always: name the character/style explicitly (for consistency), specify the cream/off-white background and 16:9, keep grayscale + one accent color, and end with "no text overlays".

## Job 10: Replicate image prompt JSON (`replicate.json`)

One object per visual beat (from Job 9). Schema:

```json
{
  "imageId": "S01_001",
  "sceneId": "S01",
  "prompt": "<scene description built from coreSymbol + visualPurpose + emotionalTone> + <fixed style block>",
  "negativePrompt": "text, letters, words, captions, logo, watermark, signature, realistic human, photorealism, 3D render, complex background, cluttered, multiple accent colors",
  "outputPath": "assets/images/S01_001.png"
}
```

Rules:
- `imageId` must include scene number AND image number (`S01_001`).
- `outputPath` must be the exact path Remotion will later read (`assets/images/<imageId>.png`).
- Always include `negativePrompt`.
- Always include "no text" / "no text overlays" inside `prompt` as well (belt and suspenders).
- Never instruct the model to render text inside the image.
- Use the same fixed style block for every prompt.
- For each beat, name the **single accent color** in the prompt if any (e.g. "red heart", "yellow moon") to match the reference look; default to grayscale otherwise.

## Job 11: Remotion assembly JSON (`remotion.json`)

One object per scene. References image files by path and the scene's audio file — **no prompts here.**

```json
{
  "sceneId": "S01",
  "label": "Hook",
  "role": "Self-blame reversal",
  "voiceover": "You are not lazy. You know exactly what you need to do.",
  "audioPath": "assets/audio/S01.mp3",
  "audioDuration": null,
  "startTime": 0,
  "endTime": 7.2,
  "estimatedDuration": 7.2,
  "subtitles": [],
  "images": [
    {
      "imageId": "S01_001",
      "src": "assets/images/S01_001.png",
      "duration": 3.6,
      "motion": "slowZoomIn"
    },
    {
      "imageId": "S01_002",
      "src": "assets/images/S01_002.png",
      "duration": 3.6,
      "motion": "slowPanRight"
    }
  ],
  "caption": "You are not lazy. You know exactly what you need to do."
}
```

Field roles:
- `audioPath` — where ElevenLabs will write this scene's voice file (`assets/audio/<sceneId>.mp3`). One audio file per scene.
- `audioDuration` — **left `null` by the skill.** Filled in later with the measured ElevenLabs duration in seconds. This is the source of truth for the scene's real length.
- `subtitles` — **left `[]` by the skill.** Filled later from ElevenLabs word/phrase timestamps: `[{ "text": "...", "start": 0.0, "end": 1.2 }]`. Times are relative to the scene's audio.
- `estimatedDuration` — the provisional length from Job 8 (kept for reference/debugging).
- `voiceover` / `caption` — the on-screen subtitle text; Remotion renders it, never baked into the image.
- `motion` comes from the beat's `recommendedMotion`.

Rules:
- `src` must equal the matching Replicate `outputPath` for that `imageId`. They must agree exactly.
- Every image `duration` ≤ 7.0. (Hard cap — must still hold after measured timing is applied.)
- `caption` is the on-screen subtitle text; it is never baked into the image.

## Provisional vs measured timing (audio-first)

This is the project's #1 rule. There are two phases:

**Phase A — skill output (provisional).** The skill fills `startTime`, `endTime`, `estimatedDuration`, and each image `duration` from the Job 8 WPM estimate. It sets `audioDuration: null` and `subtitles: []`. These second-values are placeholders.

**Phase B — pipeline overwrite (measured).** After ElevenLabs generates each scene's audio, a script:
1. Measures the real audio length → writes it to `audioDuration`.
2. Recomputes the scene's `endTime` as the running cumulative sum of measured `audioDuration`s across all scenes (so the whole timeline shifts to real time).
3. Splits the measured `audioDuration` across that scene's images — evenly, or proportionally by `relatedVoiceover` word share aligned to ElevenLabs word timestamps — and writes each image's real `duration`.
4. Writes the word/phrase timestamps into `subtitles`.
5. Asserts every image `duration` ≤ 7.0; if any beat exceeds it (because real audio ran long), the pipeline flags the scene to add an image and regenerate that scene's timing.

Remotion reads the **measured** values. Never present the Phase A numbers as final.

## Scale note

For a real video this is dozens of objects (e.g. 42 images across ~10 scenes). Writing all of them by hand in chat is token-heavy and error-prone. The pipeline pattern is: this skill defines the structure and the full JSON for every beat/scene, a Python step validates the schema and the imageId/path links, then the generation scripts call Replicate (PNGs at each `outputPath`) and ElevenLabs (one mp3 per scene + timestamps) in parallel, and finally the measured-timing step (Phase B) fills the real durations before Remotion renders.
