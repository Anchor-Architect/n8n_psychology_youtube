import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  useVideoConfig,
} from "remotion";
import { SceneData } from "./types";
import { KenBurns } from "./Scene";
import { ShortCaption } from "./ShortCaption";

const CREAM = "#f4f1e8";

/**
 * A single scene rendered as a vertical (9:16) Short. The still images keep
 * `objectFit: cover`, so the same horizontal art fills the tall frame (center
 * crop). Audio + word-timed subtitles come straight from the scene, so the cut
 * is frame-accurate to the original video.
 */
export const Short: React.FC<{ scene: SceneData }> = ({ scene }) => {
  const { fps } = useVideoConfig();
  const hasAudio = scene.audioDuration !== null;

  let from = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: CREAM }}>
      {scene.images.map((image) => {
        const frames = Math.max(1, Math.round(image.duration * fps));
        const seq = (
          <Sequence
            key={image.imageId}
            from={from}
            durationInFrames={frames}
            name={image.imageId}
          >
            <KenBurns image={image} frames={frames} />
          </Sequence>
        );
        from += frames;
        return seq;
      })}

      {hasAudio && <Audio src={staticFile(scene.audioPath)} />}

      <ShortCaption subtitles={scene.subtitles} hasAudio={hasAudio} />
    </AbsoluteFill>
  );
};
