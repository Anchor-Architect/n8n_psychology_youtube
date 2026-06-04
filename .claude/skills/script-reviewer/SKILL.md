---
name: script-reviewer
description: Review English YouTube psychology/motivational scripts and turn them into a production-ready structure for an automated Replicate + ElevenLabs + Remotion pipeline. Does native-speaker naturalness review, psychology-accuracy review, hook-strength review, TTS-readability review, retention-risk check, scene split, 7-second-capped image counts, visual-beat split, and emits two separate JSON outputs (Replicate image prompts, Remotion assembly timeline). Use this skill whenever the user shares an English video script (faceless / voiceover / motivational / educational / psychology YouTube content) and wants ANY of: naturalness feedback, a check that the brain-science claims aren't overstated, a hook review, a check that it reads well as AI voiceover, drop-off/retention analysis, scene splitting, image-count planning, visual beats for image generation, or production JSON for Replicate/Remotion. Trigger even when the user asks for only one of these and even if they don't say "skill" — e.g. "이 스크립트 자연스러워?", "원어민이 봐도 괜찮아?", "씬 나눠줘", "이미지 몇 장 필요해?", "이거 voiceover로 어색하지 않아?", "이탈 구간 있어?", "Replicate JSON 만들어줘", "Remotion용으로 정리해줘", "review this script", "make it sound native", "split into scenes", "is the brain science overstated".
---

# Script Reviewer

Reviews English YouTube scripts (psychology / motivational / educational, faceless voiceover style) and prepares them for an automated production pipeline.

## Pipeline context — read this first

The script becomes a video through three tools with strict, separate roles:

- **Replicate (flux-schnell)** generates the images (one PNG per visual beat). Runs **in parallel** with ElevenLabs.
- **ElevenLabs** generates the voiceover AND the word-level timestamps used for subtitles. Runs **in parallel** with Replicate.
- **Remotion** does NOT generate anything. It only assembles already-generated images, voiceover, subtitles, motion, and timing into the final video.

This separation drives the two JSON outputs: a **Replicate JSON** (prompts that make images) and a **Remotion JSON** (timeline that references already-made image paths). They are linked by a shared `imageId`. Never put prompts in the Remotion JSON; never put file paths in the Replicate JSON's job. See `references/pipeline-json.md`.

### The timing principle (this project's #1 rule): audio-first

**The real length of every scene is decided by the actual ElevenLabs audio duration — not by a word-count estimate.** A still image's time on screen = the audio length of the words under it.

This means the WPM math in this skill is used for **ONE thing only: deciding how many images a scene needs** (so no image exceeds 7s). It produces *provisional* `startTime` / `endTime` / `duration` numbers in the Remotion JSON. After ElevenLabs runs, a script overwrites those provisional numbers with the **measured** audio durations and splits each scene's real duration across its beats. Treat every timing number this skill emits as a placeholder, clearly marked, that the pipeline will replace. See the "Provisional vs measured timing" section in `references/pipeline-json.md`.

### Output format: 16:9 horizontal (YouTube long-form)

This channel is **16:9 widescreen**. Every Replicate prompt's style block ends with `wide 16:9 composition`. Remotion renders at 1920×1080.

### Character / art style: use the project reference

The fixed style block must match the project's existing character reference in `assets/reference/STYLE.md` (minimalist 2D stickman, round blank head with two dot eyes, thin hand-drawn black outlines, warm cream off-white background, mostly grayscale with a single selective accent color). Do not invent a new style — read that file and reuse its style token so all images stay consistent with the reference images.

The user is not a native English speaker and relies on this review to catch what they can't hear. Be direct and specific. For every weak point give: the original line, why it's weak, and a paste-ready alternative. No vague praise.

## Jobs

This skill has many possible outputs. Do only what the user asks. If they ask for "everything" or a full production pass, use the full order below. If they ask for one thing (e.g. "씬 나눠줘"), output only that.

**Full output order (when the user wants everything):**

1. Genre detection
2. Naturalness review
3. Psychology accuracy review
4. Hook strength review
5. TTS readability review
6. Retention risk check
7. Scene split
8. Image count by scene
9. Visual beat split
10. Replicate image prompt JSON
11. Remotion assembly JSON

## Where the detail lives

To keep this file light, the actual rules are split into reference files. Read the relevant one before doing that job — don't work from memory.

- **Review jobs (1–6)** → read `references/review-rules.md`. Covers genre detection, naturalness checklist, psychology-accuracy (controlled-certainty language), hook structure, TTS readability, and retention-risk — each with what to flag and how to fix.
- **Structure jobs (7–9)** → read `references/scenes-and-beats.md`. Covers scene splitting, the 7-second image-count math, pacing targets, and the visual-beat schema.
- **JSON jobs (10–11)** → read `references/pipeline-json.md`. Covers the Replicate prompt JSON schema, the Remotion assembly JSON schema, the fixed style block, negative prompts, the audio fields, provisional-vs-measured timing, and the imageId/outputPath linking rules.

## Three rules that never bend

1. **7 seconds is a hard maximum per image, never a target.** Every image must be on screen for ≤ 7 seconds. Use `ceil(scene_seconds / 7)` so this can't be violated, then confirm explicitly in the output that no image exceeds 7s.
2. **Images never contain text.** Every Replicate prompt includes "no text / no text overlays" and a negative prompt blocking text, letters, logos, watermarks. Captions are added by Remotion, not baked into images.
3. **Timing is audio-first.** Every timing number this skill emits is provisional and gets overwritten by the measured ElevenLabs audio duration. Never present skill-computed seconds as final.
