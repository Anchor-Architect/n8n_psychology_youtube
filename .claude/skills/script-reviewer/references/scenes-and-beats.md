# Scenes, Image Count, and Visual Beats (Jobs 7–9)

## Job 7: Scene split

Split by **meaning flow**, not arbitrary length. Each scene is a coherent beat of the argument or story. Give each scene an id (S01, S02...), a label, and a role.

A typical psychology/motivational arc:
Hook → Recognition → Science/Evidence → Application → Trap/Problem → Reframe → Solution → Mechanism → Practice → Closing.
This is an example, not a fixed template — fit labels to the actual script.

Output: each scene with id, label, role, and the lines it contains.

## Job 8: Image count by scene (7-second cap)

Videos are sequences of still images. **No image stays on screen longer than 7 seconds. 7s is a hard maximum, not a target.**

> **Audio-first caveat (this project's #1 rule).** The WPM math below exists for ONE purpose: deciding **how many images** each scene needs so none exceeds 7s. The seconds it produces are **provisional estimates only**. The real scene length comes from the measured ElevenLabs audio duration, and the pipeline overwrites these estimates after the audio is generated. So: trust the *image counts* this job produces, but treat every *second* value as a placeholder to be replaced. Because durations are audio-first, the ceil math should run on a slightly conservative estimate so the image count still holds if the real audio runs a bit long (see step 6).

Calculation:
1. Total word count of the script.
2. Speaking rate: default **150 WPM** unless the user gives one. This is the planning rate; the rendered audio sets the true length.
3. Per scene: `scene_seconds = (scene_word_count / WPM) * 60`  *(provisional)*
4. Per scene image count: `images = ceil(scene_seconds / 7)`
5. Average dwell per image = `scene_seconds / images`. Using ceil guarantees this is ≤ 7 *at the estimated rate*.
6. **Safety margin for audio-first:** because real audio may run longer than the estimate, if `scene_seconds / images` is above ~6.0s (i.e. close to the 7s cap), add one more image so there's headroom when the measured duration replaces the estimate. This keeps the 7s cap safe after real timing is applied.

Pacing targets (within the 7s cap — aim shorter than the max where it fits):
- Hook / rapid-example sections: 3–5 s per image
- Explanation sections: 5–7 s per image
- Emotional ending: 6–7 s per image

To hit a pacing target shorter than the ceiling, you may use more images than the bare `ceil` minimum — e.g. a fast hook scene can take more images so each sits ~4s. Never fewer than the ceil minimum.

Output: a table with, per scene → scene id/label, word count, scene seconds *(provisional)*, image count, avg dwell per image *(provisional)*. Then total estimated video length and total image count. Confirm explicitly that no scene exceeds the 7s cap at the estimated rate, and note that final durations will be set by the measured audio.

Example: a 20s scene → ceil(20/7) = 3 images → 20/3 ≈ 6.7s each. That is above the 6.0s margin, so bump to 4 images → 5.0s each, leaving headroom for the real audio.

## Job 9: Visual beat split

Scene split alone isn't enough to generate images. Split each scene into **visual beats** — one beat per image, count taken from Job 8. Each beat is a self-contained instruction for one image.

Each beat has these fields:
- `imageId` — scene number + image number, e.g. `S01_001`
- `sceneId` — e.g. `S01`
- `relatedVoiceover` — the line(s) of script this image sits under (used later to align the beat to real audio timestamps)
- `visualPurpose` — what this image should make the viewer feel or understand
- `emotionalTone` — e.g. "quiet tension", "relief", "resolve"
- `coreSymbol` — the single concrete object/metaphor in frame (e.g. "blank laptop")
- `recommendedMotion` — Remotion motion hint (e.g. slowZoomIn, slowPanRight, fadeIn)

Example beat:
```json
{
  "imageId": "S01_001",
  "sceneId": "S01",
  "relatedVoiceover": "You are not lazy. You know exactly what you need to do.",
  "visualPurpose": "Show the viewer frozen before starting",
  "emotionalTone": "quiet tension",
  "coreSymbol": "blank laptop",
  "recommendedMotion": "slowZoomIn"
}
```

The beats are the bridge: `coreSymbol` + `visualPurpose` + `emotionalTone` feed the Replicate prompt; `recommendedMotion` + measured timing feed the Remotion timeline. Keep `imageId` identical across both so they link. Because `relatedVoiceover` records which words sit under each image, the pipeline can later split a scene's measured audio duration across its beats at word boundaries.
