import * as THREE from 'three';
import sourceVertex from '../src/glsl/ribbon/ribbonVertex.glsl?raw';
import sourceFragment from '../src/glsl/ribbon/ribbonFragment.glsl?raw';
import ambient from '../src/glsl/includes/ambientLight.glsl?raw';
import directional from '../src/glsl/includes/directionalLight.glsl?raw';
import point from '../src/glsl/includes/pointLight.glsl?raw';
import { DEFAULT_AXIS, type Vector3Value } from './config';
import { RING_CENTER, ringPoseQuaternion } from './spatial';

const vertexShader = sourceVertex.replace(
  'smoothstep(fadeEndT, fadeStartT, abs(t - 0.5))',
  '(1.0 - smoothstep(fadeStartT, fadeEndT, abs(t - 0.5)))',
);
const fragmentShader = sourceFragment
  .replace('#include "../includes/ambientLight.glsl";', ambient)
  .replace('#include "../includes/directionalLight.glsl";', directional)
  .replace('#include "../includes/pointLight.glsl";', point);

export function createRibbon(count: number, radius: number, orientation: Vector3Value = { x: 0, y: 0, z: -0.1 }, axis = DEFAULT_AXIS, cardHeight = 8) {
  const pose = ringPoseQuaternion(orientation, axis);
  const ringPoints = Array.from({ length: count }, (_, index) => {
    const angle = (count - 1 - index) / count * Math.PI * 2;
    return new THREE.Vector3(Math.sin(angle) * radius, cardHeight / 2 + 1, Math.cos(angle) * radius)
      .applyQuaternion(pose).add(RING_CENTER);
  });
  const approach = [
    [-20, 10, -70], [50, 30, -80], [30, 30, -75], [50, 30, -70],
    [30, 30, -65], [50, 30, -60], [50, 10, -45], [35, 4, -35],
    [20, -10, -60], [-10, 20, -30], [10, 30, -22], [0, 25, -11],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const exit = [[60, 35, -30], [30, 20, -30], [20, 10, -35], [10, 15, -48], [5, 15, -58], [25, 10, -85], [50, -16, -82]]
    .map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const curve = new THREE.CatmullRomCurve3([
    ...approach, ...ringPoints,
    ringPoints[0].clone().add(new THREE.Vector3(-10, 20, 20)), ...exit,
  ], false, 'chordal', 0.5);
  const samples = 960;
  const positions = curve.getSpacedPoints(samples);
  const frames = curve.computeFrenetFrames(samples, false);
  const data = new Float32Array((samples + 1) * 4 * 4);
  [positions, frames.binormals, frames.normals, frames.tangents].forEach((row, y) => {
    row.forEach((v, x) => { const offset = (y * (samples + 1) + x) * 4; data[offset] = v.x; data[offset + 1] = v.y; data[offset + 2] = v.z; data[offset + 3] = 1; });
  });
  const spatial = new THREE.DataTexture(data, samples + 1, 4, THREE.RGBAFormat, THREE.FloatType);
  spatial.needsUpdate = true;
  const color = new THREE.DataTexture(new Uint8Array([205, 205, 205, 255]), 1, 1);
  color.colorSpace = THREE.SRGBColorSpace; color.needsUpdate = true;
  const normal = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1);
  normal.needsUpdate = true;
  const owned = new Set<THREE.Texture>([spatial, color, normal]);
  // Same cross-section and deformation, fewer longitudinal samples.
  const geometry = new THREE.BoxGeometry(8, 180, 0.4, 4, 360, 1);
  geometry.rotateX(-Math.PI / 2); geometry.translate(0, 0, 90);
  const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, side: THREE.DoubleSide, transparent: true,
    uniforms: {
      uTime: { value: 0 }, uOffset: { value: -0.01628327240327612 },
      uSpatialTexture: { value: spatial }, uTextureSize: { value: new THREE.Vector2(samples + 1, 4) },
      uLengthRatio: { value: 180 / curve.getLength() }, uObjSize: { value: new THREE.Vector3(8, 0.4, 180) },
      uFabricTexture: { value: color }, uFabricTextureNormal: { value: normal },
      uColor: { value: new THREE.Color(0.2, 0, 0.1) }, uLightDirection: { value: new THREE.Vector3(-0.5, 0.2, 0.5) }, uTwistAmt: { value: 0.1 },
    },
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  const lengths = curve.getLengths(curve.points.length * 10);
  const start = lengths[130] / curve.getLength() - 0.01;
  const emergence = lengths[10 * (13 + count)] / curve.getLength() - start;
  let disposed = false;
  let enhancement = 0;
  return {
    mesh, start, emergence,
    update(progress: number, time: number) {
      mesh.visible = progress < 0.9;
      material.uniforms.uOffset.value = progress;
      material.uniforms.uTime.value = time;
    },
    enhance(urls?: { color: string; normal: string }) {
      if (!urls) return;
      const version = ++enhancement;
      for (const [key, url] of [['uFabricTexture', urls.color], ['uFabricTextureNormal', urls.normal]]) {
        new THREE.TextureLoader().loadAsync(url).then(texture => {
          if (disposed || version !== enhancement) { texture.dispose(); return; }
          texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
          if (key === 'uFabricTexture') texture.colorSpace = THREE.SRGBColorSpace;
          const previous = material.uniforms[key].value as THREE.Texture;
          owned.delete(previous); previous.dispose();
          owned.add(texture); material.uniforms[key].value = texture;
        }).catch(() => { /* The base fabric remains visible without maps. */ });
      }
    },
    dispose() { disposed = true; geometry.dispose(); material.dispose(); owned.forEach(texture => texture.dispose()); },
  };
}
