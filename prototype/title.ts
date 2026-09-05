import * as THREE from 'three';
import sourceVertex from '../src/glsl/text/textVertex.glsl?raw';
import sourceFragment from '../src/glsl/text/textFragment.glsl?raw';
import { createTitleMotion } from './title-motion';
import { DEFAULT_TITLE, type TitleOptions } from './config';
import { bottomAnchoredOrigin, rotatedBounds, type Bounds } from './spatial';

// Keep the original wave equations in their world units, then project into the
// container's title area. The original material leaves uTime at its default zero.
const vertexShader = `uniform float uPixelsPerUnit; uniform vec2 uOrigin; uniform float uRotation; uniform float uWaveStrength;\n${sourceVertex}`
  .replace(/\(\s*1\.0 - uProgress2\s*\)/g, '((1.0 - uProgress2) * uWaveStrength)')
  .replace('vUv.y * 0.5', 'uv.y * 0.5')
  .replace('vec4 modelPosition = modelMatrix * vec4(pos, 1.0);', '$&\nmodelPosition.y += 47.12;')
  .replace('gl_Position = projectionMatrix * viewMatrix * modelPosition;',
    'vec2 titlePosition = (modelPosition.xy - vec2(0.0, 47.12)) * uPixelsPerUnit;\nfloat c = cos(uRotation), s = sin(uRotation);\nmodelPosition.xy = mat2(c, s, -s, c) * titlePosition + uOrigin;\ngl_Position = projectionMatrix * viewMatrix * modelPosition;');
const fragmentShader = `uniform sampler2D uMask;\n${sourceFragment}`
  .replace('gl_FragColor = layer2;', 'gl_FragColor = vec4(layer2.rgb, layer2.a * texture2D(uMask, vUv).a);');

/** Rasterize only when text/size changes; animate its alpha mask with the original GLSL. */
export function createTitle(text: string, intro: boolean) {
  const motion = createTitleMotion(text, intro);
  const bitmap = document.createElement('canvas');
  const context = bitmap.getContext('2d')!;
  let texture = new THREE.CanvasTexture(bitmap);
  texture.generateMipmaps = false; texture.minFilter = THREE.LinearFilter;
  const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader,
    transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
    uniforms: {
      uMask: { value: texture }, uTime: { value: 0 },
      uProgress1: { value: 1 }, uProgress2: { value: 1 }, uProgress3: { value: 1 },
      uResolution: { value: new THREE.Vector3(1, 1, 1) },
      uPixelsPerUnit: { value: 1 }, uOrigin: { value: new THREE.Vector2() },
      uRotation: { value: 0 }, uWaveStrength: { value: 1 },
    },
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 80, 16), material);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(mesh);
  const camera = new THREE.OrthographicCamera(0, 1, 1, 0, 0.1, 10);
  camera.position.z = 1;
  let width = 1, height = 1, fontSize = 22, pixelRatio = 1;
  let drawnText: string | undefined;
  let dirty = true;
  let settings = { ...DEFAULT_TITLE };
  let logicalHeight = 1, padding = 0;
  let ink: Bounds = { left: 0, right: 0, top: 0, bottom: 0 };
  let ringTop: number | null = null, originScreenY = 0, lineCount = 1;

  function position() {
    originScreenY = settings.anchor === 'ring' && ringTop !== null
      ? bottomAnchoredOrigin(ringTop, settings.overlapPx, ink, settings.rotation)
      : height * settings.y + logicalHeight / 2 - padding;
    material.uniforms.uOrigin.value.set(width * settings.x, height - originScreenY);
    material.uniforms.uRotation.value = settings.rotation;
    material.uniforms.uWaveStrength.value = settings.waveStrength;
  }

  function draw(value: string) {
    // The title font is available synchronously; no font/worker/network barrier.
    const font = `500 ${fontSize}px Arial, sans-serif`;
    const setFont = () => {
      context.font = font;
      (context as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${-fontSize * 0.05}px`;
    };
    setFont();
    context.textAlign = 'center'; context.textBaseline = 'alphabetic';
    const maxWidth = width * 0.86;
    const lines: string[] = [];
    for (const paragraph of value.split('\n')) {
      let line = '';
      // Wrapping includes long unbroken strings and never changes the supplied text.
      for (const word of paragraph.split(/(\s+)/)) {
        if (line && context.measureText(line + word).width > maxWidth) { lines.push(line.trimEnd()); line = ''; }
        for (const character of word) {
          if (line && context.measureText(line + character).width > maxWidth) { lines.push(line); line = ''; }
          line += character;
        }
      }
      lines.push(line.trimEnd());
    }
    padding = fontSize * 0.3;
    lineCount = lines.length;
    const metrics = lines.map(line => context.measureText(line));
    const ascent = Math.max(fontSize * 0.8, ...metrics.map(metric => metric.actualBoundingBoxAscent));
    const lineHeight = fontSize * 1.02;
    const logicalWidth = Math.max(1, ...lines.map(line => context.measureText(line).width)) + padding * 2;
    logicalHeight = lines.length * lineHeight + padding * 2;
    const ratio = Math.min(2, Math.max(1, pixelRatio), 2048 / Math.max(logicalWidth, logicalHeight));
    bitmap.width = Math.max(1, Math.ceil(logicalWidth * ratio));
    bitmap.height = Math.max(1, Math.ceil(logicalHeight * ratio));
    context.setTransform(ratio, 0, 0, ratio, 0, 0); setFont();
    context.fillStyle = '#fff'; context.textAlign = 'center'; context.textBaseline = 'alphabetic';
    ink = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
    lines.forEach((line, index) => {
      const baseline = padding + ascent + index * lineHeight;
      context.fillText(line, logicalWidth / 2, baseline);
      if (!line.trim()) return;
      const metric = metrics[index];
      ink.left = Math.min(ink.left, -metric.actualBoundingBoxLeft);
      ink.right = Math.max(ink.right, metric.actualBoundingBoxRight);
      ink.top = Math.min(ink.top, baseline - metric.actualBoundingBoxAscent - logicalHeight / 2);
      ink.bottom = Math.max(ink.bottom, baseline + metric.actualBoundingBoxDescent - logicalHeight / 2);
    });
    if (!Number.isFinite(ink.top)) ink = { left: 0, right: 0, top: 0, bottom: 0 };
    // A different title can change the bitmap dimensions. Replace its GPU storage
    // rather than uploading into the previous allocation and retaining old pixels.
    texture.dispose(); texture = new THREE.CanvasTexture(bitmap);
    texture.generateMipmaps = false; texture.minFilter = THREE.LinearFilter;
    material.uniforms.uMask.value = texture;
    const pixelsPerUnit = fontSize / 7;
    const geometry = new THREE.PlaneGeometry(logicalWidth / pixelsPerUnit, logicalHeight / pixelsPerUnit, 80, 16);
    mesh.geometry.dispose(); mesh.geometry = geometry;
    material.uniforms.uPixelsPerUnit.value = pixelsPerUnit;
    position();
    drawnText = value; dirty = false;
  }

  return {
    setText: motion.setText,
    reset: motion.reset,
    setRingTop(value: number | null) { ringTop = value; position(); },
    resize(nextWidth: number, nextHeight: number, nextFontSize: number, nextPixelRatio: number, style?: TitleOptions) {
      settings = { ...DEFAULT_TITLE, ...style };
      nextFontSize *= settings.scale;
      position();
      if (width === nextWidth && height === nextHeight && fontSize === nextFontSize && pixelRatio === nextPixelRatio) return;
      width = nextWidth; height = nextHeight; fontSize = nextFontSize; pixelRatio = nextPixelRatio;
      camera.right = width; camera.top = height; camera.updateProjectionMatrix();
      material.uniforms.uResolution.value.set(width * pixelRatio, height * pixelRatio, 1);
      dirty = true;
    },
    update(delta: number, reducedMotion: boolean) {
      motion.update(delta * settings.transitionSpeed, reducedMotion);
      const state = motion.getState();
      if (dirty || state.text !== drawnText) draw(state.text);
      state.progress.forEach((value, index) => { material.uniforms[`uProgress${index + 1}`].value = value; });
      return state.moving;
    },
    render(renderer: THREE.WebGLRenderer) {
      renderer.clearDepth(); renderer.render(scene, camera);
    },
    getState() {
      const bounds = rotatedBounds(ink, settings.rotation);
      return { ...motion.getState(), anchor: settings.anchor, lineCount,
        settledBounds: { left: width * settings.x + bounds.left, right: width * settings.x + bounds.right, top: originScreenY + bounds.top, bottom: originScreenY + bounds.bottom } };
    },
    dispose() { mesh.geometry.dispose(); material.dispose(); texture.dispose(); },
  };
}
