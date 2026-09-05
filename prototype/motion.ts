import { damp } from 'maath/easing';

// Reduce the previous release damping rate by 20%; drag response stays unchanged.
export const RELEASE_SMOOTH_TIME = 1.2 / 0.8;

export type Pulse = { value: number; phase: 'idle' | 'up' | 'down'; closing: boolean; accumulator?: number };
export function startPulse(pulse: Pulse, closing: boolean) {
  pulse.phase = 'up'; pulse.closing = closing; pulse.accumulator = 0;
}

/** Original easing at the trace's ~60 Hz cadence, independent of display Hz. */
export function stepPulse(pulse: Pulse, delta: number) {
  pulse.accumulator = (pulse.accumulator ?? 0) + delta;
  // Custom legacy easing is not exponential; a fixed reference step preserves its envelope.
  while (pulse.accumulator + 1e-9 >= 1 / 60) {
    pulse.accumulator -= 1 / 60;
    stepReferencePulse(pulse);
  }
}

function stepReferencePulse(pulse: Pulse) {
  const dt = 0.01;
  if (pulse.phase === 'up') {
    if (pulse.closing) damp(pulse, 'value', 1, 0.13, dt);
    else damp(pulse, 'value', 1, 0.25, dt, 0.1, t => 1 - Math.pow(1 - t, 3));
    if (pulse.value > 0.98) pulse.phase = 'down';
  } else if (pulse.phase === 'down') {
    if (pulse.closing) damp(pulse, 'value', 0, 0.13, dt);
    else damp(pulse, 'value', 0, 0.1, dt, 0.4, t => t * t);
    if (pulse.value < 0.01) { pulse.value = 0; pulse.phase = 'idle'; }
  }
}
