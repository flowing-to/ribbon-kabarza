import { expect, test } from 'bun:test';
import { createTitleMotion } from './title-motion';
import { sampleText, TEXT_INTRO_END, TEXT_EXIT_END, TEXT_ENTER_END } from './timeline';

test('original text curves finish the initial reveal, hide the outgoing title, then reveal its replacement', () => {
  expect(sampleText(0)).toEqual([0, 0, 0]);
  expect(sampleText(TEXT_INTRO_END)).toEqual([1, 1, 1]);
  expect(sampleText(TEXT_EXIT_END)).toEqual([0, 0, 0]);
  expect(sampleText(TEXT_ENTER_END)).toEqual([1, 1, 1]);
  const motion = createTitleMotion('Landing', true);
  motion.update(TEXT_INTRO_END, false);
  expect(motion.getState().phase).toBe('idle');
  motion.setText('Footers');
  motion.update(0.3, false);
  expect(motion.getState().text).toBe('Landing');
  expect(motion.getState().progress[0]).toBeLessThan(1);
  motion.update(0.4, false);
  expect(motion.getState().text).toBe('Footers');
  expect(motion.getState().phase).toBe('enter');
  motion.update(1.6, false);
  expect(motion.getState().progress).toEqual([1, 1, 1]);
  expect(motion.getState().moving).toBe(false);
});

test('rapid title changes keep the current visual progress and reveal only the latest request', () => {
  const motion = createTitleMotion('Landing', false);
  motion.setText('First'); motion.update(0.2, false);
  motion.setText('Second'); motion.update(0.5, false);
  expect(motion.getState().text).toBe('Second');
  motion.update(0.5, false);
  const previous = motion.getState().progress;
  motion.setText('Third'); motion.update(0, false);
  expect(motion.getState().progress).toEqual(previous);
  motion.update(0.7, false); motion.update(1.6, false);
  expect(motion.getState().text).toBe('Third');
  expect(motion.getState().phase).toBe('idle');
});

test('reduced motion and replay discard pending text transitions', () => {
  const motion = createTitleMotion('Landing', true);
  motion.setText('Footers'); motion.update(0, true);
  expect(motion.getState().text).toBe('Footers');
  expect(motion.getState().progress).toEqual([1, 1, 1]);
  motion.reset('Landing', true);
  expect(motion.getState().progress).toEqual([0, 0, 0]);
  expect(motion.getState().requested).toBe('Landing');
  motion.update(7, false);
  expect(motion.getState().text).toBe('Landing');
});

test('title transitions have the same progress at 30, 60 and 120 Hz', () => {
  const states = [30, 60, 120].map(hz => {
    const motion = createTitleMotion('Landing', false); motion.setText('Footers');
    for (let frame = 0; frame < hz; frame++) motion.update(1 / hz, false);
    return motion.getState();
  });
  for (const state of states) {
    expect(state.text).toBe('Footers');
    state.progress.forEach((value, index) => expect(value).toBeCloseTo(states[1].progress[index], 6));
  }
});
