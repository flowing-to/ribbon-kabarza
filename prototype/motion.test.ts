import { expect, test } from 'bun:test';
import { evaluateTrack, sampleIntro, INTRO_DURATION, type Keyframe } from './timeline';
import { createIntroSpin, createWindMotion, startPulse, stepPulse, type Pulse } from './motion';

test('wind responds within a frame, stays bounded and fades without an acceleration overshoot', () => {
  const wind = createWindMotion();
  const peak = (4 - 0.1) * 0.28;
  expect(wind.update(4, 1 / 60)).toBeGreaterThan(peak * 0.7);
  for (let frame = 0; frame < 120; frame++) {
    const value = wind.update(frame % 2 ? 4 : -4, 1 / 60);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(peak);
  }
  const beforeRelease = wind.value;
  expect(wind.update(0, 1 / 60)).toBeLessThan(beforeRelease);
  for (let frame = 0; frame < 120; frame++) wind.update(0, 1 / 60);
  expect(wind.value).toBe(0);
  wind.update(4, 1 / 60); wind.reset();
  expect(wind.value).toBe(0);
  expect(wind.update(0.1, 1 / 60, false)).toBe(0);
});

test('wind responds to acceleration at low speed and has a consistent envelope across refresh rates', () => {
  const acceleration = createWindMotion();
  expect(acceleration.update(0.1, 1 / 60)).toBeGreaterThan(0);
  const samples = [30, 60, 120].map(hz => {
    const wind = createWindMotion();
    for (let frame = 0; frame < hz; frame++) wind.update(4, 1 / hz);
    for (let frame = 0; frame < hz / 2; frame++) wind.update(0, 1 / hz, false);
    return wind.value;
  });
  for (const value of samples) expect(value).toBeCloseTo(samples[1], 8);
});

test('entrance spin builds before emergence and decays at a consistent rate across refresh rates', () => {
  const samples = [30, 60, 120].map(hz => {
    const spin = createIntroSpin(true);
    for (let frame = 0; frame < hz * 2; frame++) expect(spin.update(1 / hz, false)).toBe(0);
    const start = spin.update(1 / hz, true);
    let middle = start;
    for (let frame = 1; frame < hz * 2; frame++) middle = spin.update(1 / hz, true);
    let end = middle;
    for (let frame = 0; frame < hz * 20; frame++) end = spin.update(1 / hz, true);
    expect(start).toBeGreaterThan(2.3);
    expect(middle).toBeGreaterThan(1);
    expect(middle).toBeLessThan(start);
    expect(end).toBe(0);
    expect(spin.active).toBe(false);
    return middle;
  });
  for (const value of samples) expect(value).toBeCloseTo(samples[1], 2);
});

test('manual input cancels entrance momentum; a fresh replay restores it', () => {
  const spin = createIntroSpin(true);
  spin.update(2, false);
  expect(spin.update(1 / 60, true)).toBeGreaterThan(2);
  spin.cancel();
  expect(spin.update(2, false)).toBe(0);
  expect(spin.update(1, true)).toBe(0);
  expect(spin.active).toBe(false);
  const replay = createIntroSpin(true);
  replay.update(2, false);
  expect(replay.update(1 / 60, true)).toBeGreaterThan(2);
  const disabled = createIntroSpin(false);
  disabled.update(4, false);
  expect(disabled.update(1, true)).toBe(0);
});

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
