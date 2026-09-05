export const TAU = Math.PI * 2;

export function layoutForCount(count: number, gapDegrees = 1, width = 13.8, height = 8) {
  if (!Number.isInteger(count) || count < 3 || count > 20) {
    throw new RangeError('The carousel requires between 3 and 20 items.');
  }
  if (!Number.isFinite(gapDegrees) || gapDegrees < 0 || count * gapDegrees >= 360) {
    throw new RangeError('The angular gap must be nonnegative and leave room for every card within 360 degrees.');
  }
  if (![width, height].every(value => Number.isFinite(value) && value > 0)) {
    throw new RangeError('Card width and height must be finite positive numbers.');
  }
  // Keep the original world units so shader frequencies/amplitudes retain meaning.
  const gapAngle = gapDegrees * Math.PI / 180;
  const step = TAU / count;
  const cardAngle = step - gapAngle;
  // Width is arc length on the curved surface: width = radius * cardAngle.
  // N cards plus N gaps fill exactly one circumference, including the seam.
  const radius = width / cardAngle;
  return { width, height, radius, step, cardAngle, gapAngle, gapDegrees };
}

export function cameraDistance(radius: number, aspect: number, fov: number) {
  const vertical = fov * Math.PI / 360;
  const horizontal = Math.atan(Math.tan(vertical) * aspect);
  return (radius + 2) / Math.sin(Math.min(vertical, horizontal));
}

export function shortestAngle(from: number, to: number) {
  return from + Math.atan2(Math.sin(to - from), Math.cos(to - from));
}
