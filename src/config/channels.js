/**
 * Channel registry. Each channel binds a request's `channelType` to the assets
 * that shape its videos: the script-reviewer skill, the art-style reference, and
 * the Remotion composition to render. Add a new object here to support a new
 * channel — the rest of the pipeline is channel-agnostic.
 */
import path from "node:path";
import { REPO_ROOT } from "./index.js";

const CHANNELS = {
  psychology: {
    id: "psychology",
    label: "Psychology / Self-improvement",
    skillDir: path.join(REPO_ROOT, ".claude", "skills", "script-reviewer"),
    stylePath: path.join(REPO_ROOT, "assets", "reference", "STYLE.md"),
    composition: "Psychology",
  },
};

export const DEFAULT_CHANNEL = "psychology";

export function resolveChannel(channelType) {
  const key = (channelType || DEFAULT_CHANNEL).toLowerCase();
  const channel = CHANNELS[key];
  if (!channel) {
    const known = Object.keys(CHANNELS).join(", ");
    throw new Error(`Unknown channelType "${channelType}". Known: ${known}`);
  }
  return channel;
}

export function listChannels() {
  return Object.keys(CHANNELS);
}
