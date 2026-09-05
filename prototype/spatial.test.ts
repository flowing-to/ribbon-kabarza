import { expect, test } from 'bun:test';
import * as THREE from 'three';
import { bottomAnchoredOrigin, createForegroundProjection, RING_CENTER, ringPoseQuaternion, rotatedBounds } from './spatial';

test('local spin preserves the circle center and normal for arbitrary outer tilt/axis', () => {
  for (const angles of [{ x: 0, y: 0, z: -0.1 }, { x: 0.4, y: -0.7, z: 0.3 }]) {
    const pose = new THREE.Group(); pose.position.copy(RING_CENTER);
    pose.quaternion.copy(ringPoseQuaternion(angles, { x: 0.2, y: -1, z: 0.15 }));
    const spinner = new THREE.Group(); pose.add(spinner);
    const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(pose.quaternion);
    for (const spin of [0, 0.5, 1.4, 3.2, 5, Math.PI * 2]) {
      spinner.rotation.y = -spin; pose.updateMatrixWorld(true);
      const center = new THREE.Vector3().applyMatrix4(spinner.matrixWorld);
      const rim = new THREE.Vector3(0, 0, 26).applyMatrix4(spinner.matrixWorld).sub(center);
      expect(center.distanceTo(new THREE.Vector3().copy(RING_CENTER))).toBeLessThan(1e-10);
      expect(rim.dot(normal)).toBeCloseTo(0, 10);
      expect(rim.length()).toBeCloseTo(26, 10);
    }
  }
});

test('foreground top projection matches the analytic front point of a level circle', () => {
  const project = createForegroundProjection();
  const camera = new THREE.PerspectiveCamera(50, 1.5, 0.1, 1000);
  camera.position.set(0, 0, 50); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const top = project(20, 8, new THREE.Matrix4(), camera, 900, 600)!;
  const expected = (1 - 4 / ((50 - 20) * Math.tan(25 * Math.PI / 180))) * 300;
  expect(top.y).toBeCloseTo(expected, 8);
  expect(top.x).toBeCloseTo(450, 8);
});

test('title bottom stays at the overlap when lines, font bounds and text rotation change', () => {
  for (const bounds of [
    { left: -100, right: 100, top: -10, bottom: 10 },
    { left: -130, right: 130, top: -45, bottom: 45 },
  ]) for (const angle of [0, -0.3, 0.4]) {
    const origin = bottomAnchoredOrigin(300, 15, bounds, angle);
    expect(origin + rotatedBounds(bounds, angle).bottom).toBeCloseTo(315, 10);
  }
});

test('rim tracking adapts to tilt and container size without depending on spin', () => {
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  camera.position.set(5, -5, -80); camera.lookAt(0, 10, 0); camera.updateMatrixWorld();
  const pose = new THREE.Matrix4().compose(new THREE.Vector3().copy(RING_CENTER), ringPoseQuaternion({ x: 0.2, y: 0.3, z: -0.1 }, { x: 0, y: -1, z: 0 }), new THREE.Vector3(1, 1, 1));
  const project = createForegroundProjection();
  const small = project(26, 8, pose, camera, 400, 400)!;
  const large = project(26, 8, pose, camera, 800, 800)!;
  expect(large.y).toBeCloseTo(small.y * 2, 8);
  expect(large.x).toBeCloseTo(small.x * 2, 8);
  expect(Number.isFinite(small.y)).toBe(true);
});
