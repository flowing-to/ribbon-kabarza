import { expect, test } from 'bun:test';
import { evaluateTrack, sampleIntro, INTRO_DURATION, type Keyframe } from './timeline';
import { startPulse, stepPulse, type Pulse } from './motion';

test('exported intro starts immediately and ends with the original camera and progress', () => {
  expect(sampleIntro(0).progress).toBeCloseTo(-0.01628327240327612, 10);
  expect(sampleIntro(1.2).progress).toBeCloseTo(0.3231924789569255, 10);
  expect(sampleIntro(4.033).progress).toBeCloseTo(0.9, 10);
  expect(sampleIntro(INTRO_DURATION).progress).toBe(1.5);
  expect(sampleIntro(INTRO_DURATION).cameraZ).toBeCloseTo(-56.19542877666141, 10);
});

test('Bezier time inversion supports linear curves, overshoot, and disconnected keys', () => {
  const keys: Keyframe[] = [
    { position: 0, value: 0, handles: [0.5, 1, 0.25, 0.25], connectedRight: true },
    { position: 1, value: 10, handles: [0.75, 0.75, 0.5, 0], connectedRight: true },
  ];
  expect(evaluateTrack(keys, 0.37)).toBeCloseTo(3.7, 5);
  keys[0].handles[3] = 2;
  keys[1].handles[1] = 2;
  expect(evaluateTrack(keys, 0.5)).toBeGreaterThan(10);
  keys[0].connectedRight = false;
  expect(evaluateTrack(keys, 0.99)).toBe(0);
  expect(evaluateTrack(keys, 1)).toBe(10);
});

test('opening pulse follows the captured rise and fall at 30, 60 and 120 Hz', () => {
  const states = [30, 60, 120].map(hz => {
    const pulse: Pulse = { value: 0, phase: 'idle', closing: false };
    startPulse(pulse, false);
    for (let frame = 0; frame < hz; frame++) stepPulse(pulse, 1 / hz);
    const peak = pulse.value;
    for (let frame = 0; frame < hz * 2; frame++) stepPulse(pulse, 1 / hz);
    return { peak, end: pulse.value, phase: pulse.phase };
  });
  expect(states[1].peak).toBeGreaterThan(0.5);
  expect(states[1].peak).toBeLessThan(1);
  for (const state of states) {
    expect(state.peak).toBeCloseTo(states[1].peak, 9);
    expect(state.end).toBe(0);
    expect(state.phase).toBe('idle');
  }
});

test('an interrupted opening can close and then open again', () => {
  const pulse: Pulse = { value: 0, phase: 'idle', closing: false };
  for (let repeat = 0; repeat < 5; repeat++) {
    startPulse(pulse, false);
    for (let frame = 0; frame < 20; frame++) stepPulse(pulse, 1 / 60);
    startPulse(pulse, true);
    for (let frame = 0; frame < 180; frame++) stepPulse(pulse, 1 / 60);
    expect(pulse.phase).toBe('idle');
    expect(pulse.value).toBe(0);
  }
});
