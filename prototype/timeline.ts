import project from '../src/components/canvas/Ribbon r3f Project.theatre-project-state.json';

export interface Keyframe {
  position: number;
  value: number;
  handles: number[];
  connectedRight?: boolean;
}

function bezier(t: number, a: number, b: number) {
  const s = 1 - t;
  return 3 * s * s * t * a + 3 * s * t * t * b + t * t * t;
}

/** Evaluate the original exported cubic handles without the Theatre runtime. */
export function evaluateTrack(keys: readonly Keyframe[], time: number, fallback = 0): number {
  if (!keys.length) return fallback;
  if (time <= keys[0].position) return keys[0].value;
  for (let i = 0; i < keys.length - 1; i++) {
    const left = keys[i], right = keys[i + 1];
    if (time === left.position) return left.value;
    if (time >= right.position) continue;
    if (left.connectedRight === false) return left.value;
    const x = (time - left.position) / (right.position - left.position);
    let lo = 0, hi = 1;
    for (let iteration = 0; iteration < 24; iteration++) {
      const mid = (lo + hi) / 2;
      if (bezier(mid, left.handles[2], right.handles[0]) < x) lo = mid;
      else hi = mid;
    }
    const y = bezier((lo + hi) / 2, left.handles[3], right.handles[1]);
    return left.value + (right.value - left.value) * y;
  }
  return keys[keys.length - 1].value;
}

const tracks = project.sheetsById['Ribbon r3f Sheet'].sequence.tracksByObject;
function track(object: keyof typeof tracks, property: string): Keyframe[] {
  const entry = tracks[object] as { trackIdByPropPath: Record<string, string>; trackData: Record<string, { keyframes: Keyframe[] }> };
  return entry.trackData[entry.trackIdByPropPath[property]].keyframes;
}
const progress = track('progress', '["x"]');
const time = track('time', '["t"]');
const cameraX = track('Camera', '["position","x"]');
const cameraZ = track('Camera', '["position","z"]');
const lookX = track('lookAt', '["position","x"]');
const lookY = track('lookAt', '["position","y"]');
export const INTRO_DURATION = 4.267;

export function sampleIntro(seconds: number) {
  return {
    progress: evaluateTrack(progress, seconds),
    time: evaluateTrack(time, seconds),
    cameraX: evaluateTrack(cameraX, seconds),
    // The original overwrites the exported Y track every frame.
    cameraY: -5 / 2.9,
    cameraZ: evaluateTrack(cameraZ, seconds),
    lookX: evaluateTrack(lookX, seconds),
    lookY: evaluateTrack(lookY, seconds),
  };
}
