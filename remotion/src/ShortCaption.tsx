import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Subtitle } from "./types";

/**
 * Vertical (9:16) caption for Shorts. Bigger and bolder than the horizontal
 * Caption, placed in the lower-middle "safe zone" (above the platform UI that
 * lives along the very bottom), with a soft dark scrim so white text stays
 * legible over any image. The active word is emphasized for a "quote" feel.
 */
export const ShortCaption: React.FC<{
  subtitles: Subtitle[];
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
        justifyContent: "center",
        alignItems: "center",
        // sit in the lower third, clear of the bottom platform chrome
        paddingTop: "62%",
        paddingBottom: 0,
      }}
    >
      <div
        style={{
          maxWidth: "86%",
          textAlign: "center",
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 70,
          fontWeight: 800,
          color: "#ffffff",
          lineHeight: 1.22,
          letterSpacing: -0.5,
          padding: "26px 34px",
          borderRadius: 28,
          // soft dark scrim only behind the text block
          background: "rgba(0,0,0,0.42)",
          textShadow:
            "0 2px 10px rgba(0,0,0,0.65), 0 0 2px rgba(0,0,0,0.6)",
        }}
      >
        {cue.text}
      </div>
    </AbsoluteFill>
  );
};
