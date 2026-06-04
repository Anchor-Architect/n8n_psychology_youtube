export type Subtitle = { text: string; start: number; end: number };

export type SceneImage = {
  imageId: string;
  src: string;
  duration: number; // seconds
  motion: string;
};

export type SceneData = {
  sceneId: string;
  label: string;
  role: string;
  voiceover: string;
  audioPath: string;
  audioDuration: number | null; // null until measured (audio-first)
  startTime: number;
  endTime: number;
  estimatedDuration: number;
  subtitles: Subtitle[];
  images: SceneImage[];
  caption: string;
};

// The real length of a scene: measured audio if present, else the estimate.
export const sceneSeconds = (s: SceneData): number =>
  s.audioDuration ?? s.estimatedDuration;
