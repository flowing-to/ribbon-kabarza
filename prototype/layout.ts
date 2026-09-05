export const TAU = Math.PI * 2;

export function layoutForCount(count: number) {
  if (!Number.isInteger(count) || count < 3 || count > 20) {
    throw new RangeError('The carousel requires between 3 and 20 items.');
  }
  // Keep the original world units so shader frequencies/amplitudes retain meaning.
  const width = 13.8;
  const height = 8;
  const radius = Math.max(10, count * 26 / 12);
  return { width, height, radius, step: TAU / count };
}

export function cameraDistance(radius: number, aspect: number, fov: number) {
  const vertical = fov * Math.PI / 360;
  const horizontal = Math.atan(Math.tan(vertical) * aspect);
  return (radius + 2) / Math.sin(Math.min(vertical, horizontal));
}

export function shortestAngle(from: number, to: number) {
  return from + Math.atan2(Math.sin(to - from), Math.cos(to - from));
}
