/**
 * Voice registry. Maps a request's `voice` name to a concrete ElevenLabs voice
 * id. Ids are read from the environment so they stay out of source control:
 *
 *   VOICE_ADAM_ID=...      VOICE_RACHEL_ID=...     (etc.)
 *   ELEVENLABS_VOICE_ID=...   (fallback used when no per-voice id is set)
 *
 * Future voice providers can be added by extending the resolved object with a
 * `provider` field and branching in the audio service.
 */
function envId(name) {
  return process.env[`VOICE_${name.toUpperCase()}_ID`] || null;
}

export function resolveVoice(voiceName, { mock = false } = {}) {
  const name = (voiceName || "adam").toLowerCase();
  const id = envId(name) || process.env.ELEVENLABS_VOICE_ID || null;
  if (!id && !mock) {
    throw new Error(
      `No ElevenLabs voice id for "${name}". Set VOICE_${name.toUpperCase()}_ID ` +
        `or ELEVENLABS_VOICE_ID in .env (or run in mock mode).`
    );
  }
  return { name, provider: "elevenlabs", id };
}
