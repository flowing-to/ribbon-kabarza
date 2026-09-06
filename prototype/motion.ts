import { damp } from 'maath/easing';

// Default release coast time; higher values retain momentum longer.
export const RELEASE_SMOOTH_TIME = 1.3;

/** Follow raw drag speed/acceleration without inheriting the coast filter's lag.
 * Exponential attack/release is bounded and has no carried damping derivative.
 */
export function createWindMotion() {
  let value = 0, previousSpeed = 0;
  return {
    update(speed: number, delta: number, enabled = true) {
      if (delta <= 0) return value;
      const acceleration = Math.abs(speed - previousSpeed) / delta;
      previousSpeed = enabled ? speed : 0;
      const speedTarget = Math.max(0, Math.abs(speed) - 0.1) * 0.28;
      const accelerationTarget = Math.min(0.28, acceleration * 0.006);
      const target = enabled ? Math.max(speedTarget, accelerationTarget) : 0;
      const time = target > value ? 0.012 : 0.12;
      value += (target - value) * (1 - Math.exp(-delta / time));
      if (target === 0 && value < 0.001) value = 0;
      return value;
    },
    reset() { value = previousSpeed = 0; },
    get value() { return value; },
  };
}

/** Original entrance momentum: +0.02 per 60 Hz frame before the handoff,
 * then maath's 2.1 smoothing time at the original 0.01 reference delta.
 * Keep this separate from drag momentum so input cannot restart the burst.
 */
export function createIntroSpin(enabled: boolean) {
  let phase: 'building' | 'coasting' | 'idle' = enabled ? 'building' : 'idle';
  let momentum = { value: 0 };
  return {
    update(delta: number, emerging: boolean) {
      if (phase === 'idle') return 0;
      if (!emerging) {
        if (phase === 'building') momentum.value = Math.min(28, momentum.value + 0.02 * 60 * delta);
        return 0;
      }
      phase = 'coasting';
      damp(momentum, 'value', 0, 2.1, delta * 0.6);
      if (momentum.value === 0) phase = 'idle';
      return momentum.value;
    },
    cancel() { phase = 'idle'; momentum = { value: 0 }; },
    get value() { return phase === 'coasting' ? momentum.value : 0; },
    get active() { return phase !== 'idle'; },
  };
}

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
