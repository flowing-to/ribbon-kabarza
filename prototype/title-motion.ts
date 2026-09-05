import { sampleText, TEXT_INTRO_END, TEXT_EXIT_END, TEXT_ENTER_END } from './timeline';

/** One outgoing title and the latest requested replacement; no timer callbacks to race. */
export function createTitleMotion(initial: string, intro: boolean) {
  let current = initial, requested = initial;
  let phase: 'intro' | 'exit' | 'enter' | 'idle' = intro ? 'intro' : 'idle';
  let elapsed = 0;
  let progress: [number, number, number] = intro ? [0, 0, 0] : [1, 1, 1];
  let exitFrom = progress;
  return {
    setText(text: string) {
      if (requested === text) return;
      requested = text;
      if (phase !== 'exit') { phase = 'exit'; elapsed = 0; exitFrom = [...progress]; }
    },
    reset(text: string, intro: boolean) {
      current = requested = text; elapsed = 0;
      phase = intro ? 'intro' : 'idle'; progress = intro ? [0, 0, 0] : [1, 1, 1];
    },
    update(delta: number, reducedMotion: boolean) {
      if (reducedMotion) {
        current = requested; phase = 'idle'; progress = [1, 1, 1];
        return;
      }
      elapsed += delta;
      if (phase === 'intro') {
        progress = sampleText(elapsed);
        if (elapsed >= TEXT_INTRO_END) { progress = [1, 1, 1]; phase = 'idle'; }
      } else if (phase === 'exit') {
        const duration = (TEXT_EXIT_END - TEXT_INTRO_END) / 1.5;
        const curve = sampleText(Math.min(TEXT_EXIT_END, TEXT_INTRO_END + elapsed * 1.5));
        progress = curve.map((value, index) => value * exitFrom[index]) as typeof progress;
        if (elapsed >= duration) {
          elapsed -= duration;
          current = requested; phase = 'enter';
          progress = sampleText(Math.min(TEXT_ENTER_END, TEXT_EXIT_END + elapsed));
        }
      } else if (phase === 'enter') {
        progress = sampleText(TEXT_EXIT_END + elapsed);
        if (elapsed >= TEXT_ENTER_END - TEXT_EXIT_END) { progress = [1, 1, 1]; phase = 'idle'; }
      }
    },
    getState() { return { text: current, requested, phase, progress: [...progress] as [number, number, number], moving: phase !== 'idle' }; },
  };
}
