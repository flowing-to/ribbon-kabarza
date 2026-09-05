import { describe, expect, test } from 'bun:test';
import { cameraDistance, layoutForCount, shortestAngle } from './layout';

describe('container and count-independent layout', () => {
  test('cards and configured gaps fill exactly one circle at every supported count', () => {
    for (let count = 3; count <= 20; count++) {
      for (const gapDegrees of [0, 1, 3, 6]) {
        const { radius, width, step, cardAngle, gapAngle } = layoutForCount(count, gapDegrees);
        expect(radius * cardAngle).toBeCloseTo(width, 10);
        expect(count * (cardAngle + gapAngle)).toBeCloseTo(2 * Math.PI, 10);
        // Each right edge must precede the next left edge by the configured arc.
        // Include the wrap from the final card to the first at 2π.
        for (let index = 0; index < count; index++) {
          const rightEdge = index * step + width / radius / 2;
          const nextLeftEdge = (index + 1) * step - width / radius / 2;
          expect((nextLeftEdge - rightEdge) * 180 / Math.PI).toBeCloseTo(gapDegrees, 10);
        }
      }
    }
  });
  test('twelve cards default to 29 degrees of card and 1 degree of gap', () => {
    const layout = layoutForCount(12);
    expect(layout.gapDegrees).toBe(1);
    expect(layout.cardAngle * 180 / Math.PI).toBeCloseTo(29, 10);
    expect(layout.radius).toBeCloseTo(13.8 / (29 * Math.PI / 180), 10);
    expect(layoutForCount(12, 3).radius).toBeGreaterThan(layout.radius);
  });
  test('invalid gap budgets fail instead of creating overlapping or inverted cards', () => {
    for (const gap of [-1, NaN, Infinity, 30, 31]) expect(() => layoutForCount(12, gap)).toThrow();
    expect(() => layoutForCount(20, 18)).toThrow();
  });
  test('card width changes the derived radius while retaining the angular budget', () => {
    const original = layoutForCount(12, 1);
    const larger = layoutForCount(12, 1, 27.6, 10);
    expect(larger.radius).toBeCloseTo(original.radius * 2, 10);
    expect(larger.cardAngle).toBe(original.cardAngle);
    expect(larger.height).toBe(10);
    for (const width of [0, -1, Infinity, NaN]) expect(() => layoutForCount(12, 1, width)).toThrow();
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
