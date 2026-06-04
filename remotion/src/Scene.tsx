import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SceneData, SceneImage } from "./types";
import { Caption } from "./Caption";

const CREAM = "#f4f1e8";

/** One still image with a slow Ken Burns move over its own sub-window. */
export const KenBurns: React.FC<{ image: SceneImage; frames: number }> = ({ image, frames }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, frames], [0, 1], {
    extrapolateRight: "clamp",
  });

  let scale = 1.06;
  let x = 0;
  let y = 0;
  let opacity = 1;
  switch (image.motion) {
    case "slowZoomIn":
      scale = interpolate(p, [0, 1], [1.0, 1.08]);
      break;
    case "slowZoomOut":
      scale = interpolate(p, [0, 1], [1.08, 1.0]);
      break;
    case "slowPanRight":
      scale = 1.08;
      x = interpolate(p, [0, 1], [-2.5, 2.5]);
      break;
    case "slowPanLeft":
      scale = 1.08;
      x = interpolate(p, [0, 1], [2.5, -2.5]);
      break;
    case "fadeIn":
      scale = interpolate(p, [0, 1], [1.04, 1.08]);
      opacity = interpolate(p, [0, 0.15], [0, 1], { extrapolateRight: "clamp" });
      break;
    default:
      scale = interpolate(p, [0, 1], [1.0, 1.06]);
  }

  return (
    <AbsoluteFill style={{ backgroundColor: CREAM }}>
      <Img
        src={staticFile(image.src)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale}) translate(${x}%, ${y}%)`,
          opacity,
        }}
      />
    </AbsoluteFill>
  );
};

export const Scene: React.FC<{ scene: SceneData }> = ({ scene }) => {
  const { fps } = useVideoConfig();
  const hasAudio = scene.audioDuration !== null;

  let from = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: CREAM }}>
      {scene.images.map((image) => {
        const frames = Math.max(1, Math.round(image.duration * fps));
        const seq = (
          <Sequence key={image.imageId} from={from} durationInFrames={frames} name={image.imageId}>
            <KenBurns image={image} frames={frames} />
          </Sequence>
        );
        from += frames;
        return seq;
      })}

      {hasAudio && <Audio src={staticFile(scene.audioPath)} />}

      <Caption subtitles={scene.subtitles} fallback={scene.caption} hasAudio={hasAudio} />
    </AbsoluteFill>
  );
};
