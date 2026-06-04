import { Sequence } from "remotion";
import { Scene } from "./Scene";
import { SceneData, sceneSeconds } from "./types";

const FPS = 30;

export const Video: React.FC<{ scenes: SceneData[] }> = ({ scenes }) => {
  let from = 0;
  return (
    <>
      {scenes.map((scene) => {
        const dur = Math.max(1, Math.ceil(sceneSeconds(scene) * FPS));
        const seq = (
          <Sequence key={scene.sceneId} from={from} durationInFrames={dur} name={scene.sceneId}>
            <Scene scene={scene} />
          </Sequence>
        );
        from += dur;
        return seq;
      })}
    </>
  );
};
