# Review Rules (Jobs 1–6)

These are the qualitative review passes. Each one ends with concrete, paste-ready fixes — never just complaints. The user can't hear what's off in English, so be specific.

## Job 1: Genre detection

Identify the genre first; the other reviews depend on it.

- **High-energy / informational** (Hormozi, MrBeast style): short punchy rhythm, strong punchlines, confident momentum, fast pace. Judge on energy.
- **Calm narrative / motivational-psychology** (Huberman, Struthless style): quiet consistent tone, no energy spikes, confident but gentle statements. Judge on steadiness and emotional landing.

Apply the matching standard. Don't "fix" a calm script to sound punchy or vice versa. State the detected genre in one line before reviewing.

## Job 2: Naturalness review

Answer one question: would a native YouTuber think "a native wrote this"? Score out of 100, give a pass / needs-work verdict, list a few genuine strengths briefly, then the weak spots.

Checklist (each catches a real non-native or under-edited pattern):

- **Squeeze metaphors.** If a metaphor is thrown (Ferrari, supercomputer, factory), milk it one more beat before leaving. "Buying a Ferrari and driving it in a parking lot" is stronger with a follow-up like "You paid for the whole car. You're only using first gear."
- **Three repetitions is one too many.** Same sentence pattern 3× is usually one too many. Hit it twice, move on.
- **Kill weak words.** Self-evaluating words ("interesting", "fascinating") and hedge-overuse weaken delivery. (See the may-hedge note below — naturalness hedges and psychology hedges are different things.)
- **Don't announce interest.** Never have the narrator say "here's an interesting experiment." Saying it's interesting makes it less so. Just tell it.
- **The last line lands, not explains.** The closing line should make the viewer feel something, not restate the lesson.
- **No back-to-back duplicate-meaning lines.** Keep the stronger one.

Output: score, verdict, brief strengths, then per weak spot → original line / why weak / paste-ready alternative.

## Job 3: Psychology accuracy review

This genre cites brain science. Overstated claims destroy credibility. Check whether claims are responsible.

Flag:

- Overgeneralized claims ("everyone does X", "the brain always Y")
- Lines that sound like diagnosis ("you have anxiety", "this means you're depressed")
- Too-deterministic brain claims ("your amygdala forces you to...")
- Unsupported scientific certainty ("science proves...")
- Claims that need softer wording

Prefer controlled-certainty language: often, can, may, tends to, one explanation is, research suggests, in many cases.

**The hedge rule (resolves the apparent conflict with Job 2):** these two are different uses of "may", do not cancel each other:
- *Psychology hedge* — a deliberate accuracy softener on a science claim. Keep these; they make the content responsible.
- *Naturalness hedge* — a vague, habitual "may/maybe" sprinkled through ordinary narration that isn't a science claim. Trim these; they make the voice sound unsure.
So: soften scientific claims, but don't let hedges leak into ordinary motivational lines. The goal is confidence with scientific caution, not a script drowning in "may". As a rough ceiling, if non-science narration uses "may/maybe/might/perhaps" more than ~3 times, trim.

Output: per flagged claim → original line / why it's overstated or risky / paste-ready softened line.

## Job 4: Hook strength review

Review the first ~10 seconds separately — it decides retention.

The hook should: create immediate self-recognition ("that's me"), reverse self-blame, create psychological curiosity, avoid abstract openings, and usually open with recognition before any research.

Recommended hook pattern:
1. Self-recognition
2. Self-blame reversal
3. Hidden psychological explanation

If the script opens with abstract setup or research before recognition, flag it and reorder so recognition comes first. Output: assessment + a rewritten hook if it's weak.

## Job 5: TTS readability review

The script is read by ElevenLabs, so it must sound natural as AI voiceover. Check:

- Sentences too long to say in one breath → split.
- Punctuation awkward for AI narration (em-dashes mid-thought, nested clauses, semicolons) → simplify.
- Repetitive sentence openings (every line starting "You..." or "And...") → vary.
- Robotic rhythm (all sentences same length) → mix short and long.
- Places where a line break would create a natural pause for the narrator → add it.
- Whether it reads cleanly at ~150 WPM (the project's target narration pace).

Output: per issue → original line / why it's awkward for TTS / paste-ready alternative.

## Job 6: Retention risk check

Find sections where viewers may drop off. Flag:

- Long explanation with no emotional turn
- Too much theory without an example
- Repeated meaning
- Slow research explanation
- No visual variety (long stretch that would look static on screen)
- Weak scene transition
- Ending that explains instead of landing emotionally

For every risk, give a concrete fix (a line to add, cut, move, or rewrite — not "make it punchier").
