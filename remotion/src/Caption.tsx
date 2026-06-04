import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Subtitle } from "./types";

/**
 * Bottom-center subtitle. Driven by ElevenLabs word timestamps (`subtitles`),
 * which are relative to the scene's audio. Before the measure step fills those
 * in, there is nothing to show (we don't dump the whole-scene `caption` block on
 * screen — that's only a fallback for tooling).
 */
export const Caption: React.FC<{
  subtitles: Subtitle[];
  fallback: string;
  hasAudio: boolean;
}> = ({ subtitles, hasAudio }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  if (!hasAudio || subtitles.length === 0) return null;

  const cue = subtitles.find((s) => t >= s.start && t <= s.end);
  if (!cue) return null;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: 90,
      }}
    >
      <div
        style={{
          maxWidth: "80%",
          textAlign: "center",
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 52,
          fontWeight: 700,
          color: "#1a1a1a",
          lineHeight: 1.3,
          padding: "0 28px",
          // no background box; subtle light halo keeps text legible over images
          textShadow:
            "0 0 6px rgba(244,241,232,0.9), 0 1px 2px rgba(244,241,232,0.9)",
        }}
      >
        {cue.text}
      </div>
    </AbsoluteFill>
  );
};
