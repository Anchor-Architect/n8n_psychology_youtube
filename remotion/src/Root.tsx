import { Composition } from "remotion";
import { Video } from "./Video";
import { Short } from "./Short";
import { SceneData, sceneSeconds } from "./types";

const FPS = 30;

// The render engine drives this composition entirely through inputProps
// (`--props='{"scenes": [...]}'`), one isolated timeline per job. There is no
// static remotion.json import anymore, so the bundle is job-agnostic and can be
// re-bundled per job with a job-specific publicDir for assets.
const EMPTY_SCENES: SceneData[] = [];

const totalFrames = (scenes: SceneData[]): number =>
  Math.max(1, Math.ceil(scenes.reduce((acc, s) => acc + sceneSeconds(s), 0) * FPS));

// A minimal placeholder so the Short composition has a valid default before
// inputProps arrive (Remotion evaluates defaultProps at bundle time).
const PLACEHOLDER_SCENE: SceneData = {
  sceneId: "S00",
  label: "placeholder",
  role: "placeholder",
  voiceover: "",
  audioPath: "",
  audioDuration: null,
  startTime: 0,
  endTime: 1,
  estimatedDuration: 1,
  subtitles: [],
  images: [],
  caption: "",
};

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="Psychology"
      component={Video}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={1}
      defaultProps={{ scenes: EMPTY_SCENES }}
      calculateMetadata={({ props }) => ({
        durationInFrames: totalFrames((props.scenes as SceneData[]) ?? EMPTY_SCENES),
      })}
    />
    <Composition
      id="Short"
      component={Short}
      fps={FPS}
      width={1080}
      height={1920}
      durationInFrames={1}
      defaultProps={{ scene: PLACEHOLDER_SCENE }}
      calculateMetadata={({ props }) => ({
        durationInFrames: Math.max(
          1,
          Math.ceil(sceneSeconds(props.scene as SceneData) * FPS)
        ),
      })}
    />
  </>
);
