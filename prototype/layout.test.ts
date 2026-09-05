import { describe, expect, test } from 'bun:test';
import { cameraDistance, layoutForCount, shortestAngle } from './layout';

describe('container and count-independent layout', () => {
  test('supported counts retain the original almost-continuous ring spacing', () => {
    for (let count = 3; count <= 20; count++) {
      const { radius, width, step } = layoutForCount(count);
      expect(radius * step).toBeGreaterThan(width * 0.97);
    }
  });
  test('unsupported counts fail clearly', () => {
    for (const count of [0, 2, 21, 3.5, NaN]) expect(() => layoutForCount(count)).toThrow();
  });
  test('camera contains scene bounds in portrait and landscape', () => {
    for (const aspect of [0.3, 390 / 844, 1, 2, 4]) {
      const radius = layoutForCount(20).radius;
      const distance = cameraDistance(radius, aspect, 38);
      const vertical = 38 * Math.PI / 360;
      const horizontal = Math.atan(Math.tan(vertical) * aspect);
      expect(distance * Math.sin(Math.min(vertical, horizontal))).toBeGreaterThanOrEqual(radius);
    }
  });
  test('selection takes the short route across angular wrap', () => {
    expect(Math.abs(shortestAngle(6.2, 0.1) - 6.2)).toBeLessThan(0.2);
    expect(Math.abs(shortestAngle(-6.2, -0.1) + 6.2)).toBeLessThan(0.2);
  });
});
