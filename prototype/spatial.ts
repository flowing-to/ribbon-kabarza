import * as THREE from 'three';
import type { Vector3Value } from './config';

export const RING_CENTER = { x: 0, y: 10, z: 0 };

/** Pose is outside the spinner. The configured axis tilts the whole circle. */
export function ringPoseQuaternion(orientation: Vector3Value, axis: Vector3Value) {
  const alignment = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3().copy(axis).normalize());
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(orientation.x, orientation.y, orientation.z)).multiply(alignment);
}

/** Highest projected point on the continuous foreground top rim, in CSS pixels.
 * The spinner is intentionally excluded so card gaps cannot make the title bob.
 */
export function createForegroundProjection() {
  const localCamera = new THREE.Vector3(), point = new THREE.Vector3();
  const inverse = new THREE.Matrix4();
  const samples = 256;
  const directions = Array.from({ length: samples }, (_, index) => {
    const angle = index / samples * Math.PI * 2;
    return { x: Math.sin(angle), z: Math.cos(angle) };
  });
  return (radius: number, cardHeight: number, pose: THREE.Matrix4, camera: THREE.PerspectiveCamera, width: number, height: number) => {
    inverse.copy(pose).invert();
    localCamera.copy(camera.position).applyMatrix4(inverse);
    let top = Infinity, x = width / 2;
    for (const direction of directions) {
      if (direction.x * localCamera.x + direction.z * localCamera.z < 0) continue;
      point.set(direction.x * radius, cardHeight / 2, direction.z * radius).applyMatrix4(pose).project(camera);
      if (point.z < -1 || point.z > 1) continue;
      const y = (1 - point.y) * height / 2;
      if (Number.isFinite(y) && y < top) { top = y; x = (point.x + 1) * width / 2; }
    }
    return Number.isFinite(top) ? { x, y: top } : null;
  };
}

export type Bounds = { left: number; right: number; top: number; bottom: number };

/** Bounds after rotating a rectangle in screen coordinates around its origin. */
export function rotatedBounds(bounds: Bounds, radians: number): Bounds {
  const c = Math.cos(radians), s = Math.sin(radians);
  const result = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
  for (const x of [bounds.left, bounds.right]) for (const y of [bounds.top, bounds.bottom]) {
    const px = c * x + s * y, py = -s * x + c * y;
    result.left = Math.min(result.left, px); result.right = Math.max(result.right, px);
    result.top = Math.min(result.top, py); result.bottom = Math.max(result.bottom, py);
  }
  return result;
}

export function bottomAnchoredOrigin(rimTop: number, overlap: number, bounds: Bounds, radians: number) {
  return rimTop + overlap - rotatedBounds(bounds, radians).bottom;
}
