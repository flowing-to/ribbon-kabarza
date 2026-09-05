import * as THREE from 'three';
import { cameraDistance, layoutForCount, shortestAngle } from './layout';
import { damp } from 'maath/easing';
import originalImageVertex from '../src/glsl/image/imageVertex.glsl?raw';
import { createRibbon } from './ribbon';
import { INTRO_DURATION, sampleIntro } from './timeline';
import { RELEASE_SMOOTH_TIME, startPulse, stepPulse, type Pulse } from './motion';
import { createTitle } from './title';
import { DEFAULT_AXIS, DEFAULT_SELECTION_OFFSET, type TitleOptions, type Vector3Value } from './config';

export interface CarouselItem {
  id: string;
  title: string;
  previewSrc: string;
  src: string;
}

export interface CarouselOptions {
  items: CarouselItem[];
  title?: string;
  tilt?: number;
  /** XYZ Euler angles in radians. Supersedes the legacy Z-only tilt option. */
  orientation?: Vector3Value;
  rotationAxis?: Vector3Value;
  /** Initial spin in radians; updating this sets the current spin immediately. */
  rotation?: number;
  cardWidth?: number;
  cardHeight?: number;
  cameraFov?: number;
  cameraDistanceScale?: number;
  selectionAngle?: number;
  selectedScale?: number;
  selectionOffset?: Vector3Value;
  releaseDamping?: number;
  text?: TitleOptions;
  /** Empty arc between adjacent cards, in degrees. Defaults to 1. */
  gapDegrees?: number;
  autoRotate?: boolean;
  speed?: number;
  windStrength?: number;
  intro?: boolean;
  fabric?: { color: string; normal: string };
  onSelect?: (id: string | null) => void;
  onAssetError?: (id: string, url: string) => void;
}

// Preserve original deformation and its world-space units; fix an uninitialized varying.
const vertexShader = originalImageVertex.replace('vUv.y * 0.3', 'uv.y * 0.3');

const fragmentShader = `
uniform sampler2D uTexture;
uniform float uReady, uImageAspect, uCardAspect, uReveal;
varying vec2 vUv;
varying float vElavation;
void main() {
  vec2 uv = vUv - 0.5;
  if (uImageAspect > uCardAspect) uv.x *= uCardAspect / uImageAspect;
  else uv.y *= uImageAspect / uCardAspect;
  vec3 placeholder = mix(vec3(0.70, 0.71, 0.69), vec3(0.89, 0.89, 0.86), vUv.y);
  vec3 color = mix(placeholder, texture2D(uTexture, uv + 0.5).rgb, uReady);
  color *= (gl_FrontFacing ? 1.0 : 0.64) * (1.0 - abs(vElavation) * 0.03);
  gl_FragColor = vec4(color, uReveal);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** Independent, container-scoped carousel using the original ribbon and image deformation. */
export function mountRibbonCarousel(container: HTMLElement, initial: CarouselOptions) {
  let options = { ...initial };
  validateItems(options.items);
  validateTuning(options);
  let layout = layoutForCount(options.items.length, options.gapDegrees, options.cardWidth, options.cardHeight);
  let destroyed = false;
  let generation = 0;
  let frameId = 0;
  let width = 1, height = 1;
  let rotationTarget = options.rotation ?? 0, velocity = 0;
  let rotation = { value: rotationTarget };
  let inertia = { value: 0 };
  let wind = { value: 0 };
  let renderedFrames = 0;
  let hovered = false;
  let introElapsed = 0;
  let introFinished = initial.intro === false;
  let currentSpeed = 0;
  let materialTime = 0;
  let lastUpgrade = 0;
  let selected = -1;
  let elapsed = 0;
  let lastTime = performance.now();
  let activeLoads = 0;
  let visible = true;
  const introEnd = sampleIntro(INTRO_DURATION);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const textures = new Set<THREE.Texture>();
  const root = document.createElement('div');
  root.style.cssText = 'position:relative;width:100%;height:100%;min-height:0;overflow:hidden;';
  const shadow = root.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>
    :host{font-family:Arial,sans-serif;color:#151713}
    canvas{display:block;width:100%;height:100%;touch-action:pan-y;outline-offset:-4px}
    h2{position:absolute;z-index:1;top:9%;left:7%;right:7%;margin:0;text-align:center;font-weight:500;font-size:var(--title-size,22px);line-height:1.02;letter-spacing:-.05em;pointer-events:none}
    .ui{position:absolute;bottom:20px;left:20px;right:20px;display:flex;justify-content:space-between;align-items:center;gap:10px;z-index:2}
    .buttons{display:flex;gap:6px}button{border:1px solid #15171333;background:#ffffffb8;color:inherit;border-radius:50%;width:40px;height:40px;cursor:pointer;font-size:20px}
    button:focus-visible{outline:2px solid #151713;outline-offset:2px}.status{min-width:0;flex:1;font-size:12px;letter-spacing:.02em} [hidden]{display:none!important}
  </style><h2></h2><div class="ui"><span class="status" aria-live="polite">Drag to explore</span><div class="buttons"><button class="prev" aria-label="Previous card">←</button><button class="next" aria-label="Next card">→</button><button class="close" aria-label="Close selected card" hidden>×</button></div></div>`;
  root.style.containerType = 'inline-size';
  container.append(root);
  const title = shadow.querySelector('h2')!;
  const status = shadow.querySelector('.status')!;
  const close = shadow.querySelector<HTMLButtonElement>('.close')!;
  const controls = shadow.querySelector<HTMLElement>('.ui')!;
  title.textContent = options.title ?? 'Beautiful Designs\nAdvanced Interactions';
  title.style.whiteSpace = 'pre-line';

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'default' });
  } catch (error) {
    root.remove();
    throw error;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.autoClear = false;
  renderer.info.autoReset = false;
  const titleEffect = createTitle(title.textContent!, initial.intro !== false && !reducedMotion.matches);
  // Retain the semantic heading; its visible counterpart is rendered by the shader.
  title.style.color = 'transparent';
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'region');
  canvas.setAttribute('aria-label', 'Image carousel. Use arrow keys to select a card and Escape to close.');
  shadow.prepend(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(options.cameraFov ?? 50, 1, 0.1, 1200);
  const ring = new THREE.Group();
  function orientation() { return options.orientation ?? { x: 0, y: 0, z: options.tilt ?? -0.1 }; }
  const initialOrientation = orientation();
  const ringBase = new THREE.Quaternion().setFromEuler(new THREE.Euler(initialOrientation.x, initialOrientation.y, initialOrientation.z));
  ring.quaternion.copy(ringBase);
  scene.add(ring);
  let geometry = cardGeometry();
  let ribbon = createRibbon(options.items.length, layout.radius, orientation());
  scene.add(ribbon.mesh);
  ribbon.enhance(options.fabric);
  const dummy = new THREE.DataTexture(new Uint8Array([220, 220, 215, 255]), 1, 1);
  dummy.needsUpdate = true;
  type Card = { mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>; group: THREE.Group; open: number; scale: number; pulse: Pulse; full: boolean; requested: boolean; reveal: number; openingStarted: boolean };
  let cards: Card[] = [];
  type Job = { index: number; full: boolean; generation: number; url: string };
  let queue: Job[] = [];
  const loader = new THREE.TextureLoader();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const focusPosition = new THREE.Vector3();
  const restCamera = new THREE.Vector3();
  const cameraTarget = new THREE.Vector3();
  const inverseRing = new THREE.Quaternion();
  const rotationAxis = new THREE.Vector3().copy(options.rotationAxis ?? DEFAULT_AXIS).normalize();
  const worldPosition = new THREE.Vector3();
  const referenceView = new THREE.Vector3(introEnd.cameraX - introEnd.lookX, introEnd.cameraY - introEnd.lookY, introEnd.cameraZ);

  function cardGeometry() {
    const plane = new THREE.PlaneGeometry(layout.width, layout.height, 56, 24);
    const position = plane.getAttribute('position');
    for (let index = 0; index < position.count; index++) {
      const angle = position.getX(index) / layout.radius;
      position.setXYZ(index, Math.sin(angle) * layout.radius, position.getY(index), (Math.cos(angle) - 1) * layout.radius);
    }
    position.needsUpdate = true;
    plane.computeBoundingSphere();
    return plane;
  }

  function invalidate() {
    if (!frameId && !destroyed) frameId = requestAnimationFrame(render);
  }

  function pump() {
    while (activeLoads < 3 && queue.length && !destroyed) {
      const job = queue.shift()!;
      if (job.generation !== generation) continue;
      activeLoads++;
      loader.loadAsync(job.url).then(texture => {
        if (destroyed || job.generation !== generation) { texture.dispose(); return; }
        const card = cards[job.index];
        if (!job.full && card.full) { texture.dispose(); return; }
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
        const previous = card.mesh.material.uniforms.uTexture.value as THREE.Texture;
        if (previous !== dummy) { textures.delete(previous); previous.dispose(); }
        textures.add(texture);
        card.mesh.material.uniforms.uTexture.value = texture;
        card.mesh.material.uniforms.uReady.value = 1;
        card.mesh.material.uniforms.uImageAspect.value = texture.image.width / texture.image.height;
        card.full ||= job.full;
        invalidate();
      }).catch(() => {
        if (!destroyed && job.generation === generation) options.onAssetError?.(options.items[job.index].id, job.url);
      }).finally(() => { activeLoads--; pump(); });
    }
  }

  function upgrade(index: number) {
    const card = cards[index];
    if (!card || card.requested) return;
    card.requested = true;
    queue.unshift({ index, full: true, generation, url: options.items[index].src });
    pump();
  }

  function buildCards() {
    generation++;
    queue = [];
    for (const card of cards) { ring.remove(card.group); card.mesh.material.dispose(); }
    for (const texture of textures) texture.dispose();
    textures.clear();
    cards = options.items.map((item, index) => {
      const material = new THREE.ShaderMaterial({
        vertexShader, fragmentShader, side: THREE.DoubleSide, transparent: true,
        uniforms: {
          uTime: { value: 0 }, uVelocity: { value: 0 }, uProgress: { value: 0 }, uOffset: { value: 0 }, uOffsetTotal: { value: 0 },
          uRadius: { value: layout.radius }, uReady: { value: 0 }, uTexture: { value: dummy },
          uImageAspect: { value: layout.width / layout.height }, uCardAspect: { value: layout.width / layout.height }, uReveal: { value: 1 },
        },
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.index = index;
      // Shader deformation can move vertices outside the flat geometry's bounds.
      mesh.frustumCulled = false;
      positionCard(mesh, index);
      const group = new THREE.Group();
      group.add(mesh); ring.add(group);
      queue.push({ index, full: false, generation, url: item.previewSrc || item.src });
      return { mesh, group, open: 0, scale: 1, pulse: { value: 0, phase: 'idle', closing: false } as Pulse, full: false, requested: false, reveal: 0, openingStarted: false };
    });
    queue.sort((a, b) => Math.cos((options.items.length - 1 - a.index) * layout.step) - Math.cos((options.items.length - 1 - b.index) * layout.step));
    pump();
    invalidate();
  }

  function positionCard(mesh: Card['mesh'], index: number) {
    const angle = (options.items.length - 1 - index) * layout.step;
    mesh.position.set(Math.sin(angle) * layout.radius, 10, Math.cos(angle) * layout.radius);
    mesh.rotation.y = angle;
    mesh.material.uniforms.uRadius.value = layout.radius;
    mesh.material.uniforms.uCardAspect.value = layout.width / layout.height;
  }

  function resize() {
    const rect = root.getBoundingClientRect();
    width = Math.max(1, rect.width); height = Math.max(1, rect.height);
    const titleSize = Math.max(18, Math.min(70, Math.max(22, width * 0.05), height * 0.09));
    root.style.setProperty('--title-size', `${titleSize}px`);
    // Bound total raster work as well as DPR, including large desktop containers.
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(2_000_000 / (width * height))));
    renderer.setSize(width, height, false);
    titleEffect.resize(width, height, titleSize, renderer.getPixelRatio(), options.text);
    camera.aspect = width / height;
    camera.fov = options.cameraFov ?? 50;
    const final = introEnd;
    const fitFactor = THREE.MathUtils.lerp(1.04, 0.82, THREE.MathUtils.smoothstep(camera.aspect, 0.9, 1.5));
    const depth = Math.max(45, cameraDistance(layout.radius, camera.aspect, camera.fov) * fitFactor) * (options.cameraDistanceScale ?? 1);
    camera.far = Math.max(1200, depth + layout.radius * 3 + 200);
    // Dolly along the original viewing direction so portrait fitting preserves the ring angle.
    restCamera.copy(referenceView).multiplyScalar(depth / Math.abs(final.cameraZ)).add(new THREE.Vector3(final.lookX, final.lookY, 0));
    if (introFinished) { camera.position.copy(restCamera); camera.lookAt(final.lookX, final.lookY, 0); }
    camera.updateProjectionMatrix();
    invalidate();
  }

  function select(index: number) {
    if (!introFinished || index === selected) return;
    if (selected >= 0 && selected !== index) {
      if (cards[selected].open > 0.001 || cards[selected].pulse.value > 0.001) startPulse(cards[selected].pulse, true);
      cards[selected].openingStarted = false;
    }
    selected = index;
    velocity = 0; inertia = { value: 0 };
    if (index >= 0) {
      const target = (cards.length - 1 - index) * layout.step - Math.PI + (options.selectionAngle ?? Math.PI / 36);
      rotationTarget = shortestAngle(rotation.value, target);
      cards[index].openingStarted = false;
    }
    title.textContent = index < 0 ? options.title ?? 'Beautiful Designs\nAdvanced Interactions' : options.items[index].title;
    titleEffect.setText(title.textContent!);
    status.textContent = index < 0 ? 'Drag to explore' : `${index + 1} / ${cards.length} · Click outside to close`;
    close.hidden = index < 0;
    if (index >= 0) upgrade(index);
    options.onSelect?.(index < 0 ? null : options.items[index].id);
    invalidate();
  }

  function render(now: number) {
    frameId = 0;
    if (destroyed) return;
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    if ((introFinished && !visible) || document.hidden) return;
    elapsed += dt;
    if (reducedMotion.matches) {
      introFinished = true;
      rotation = { value: rotationTarget };
      inertia = { value: 0 }; wind = { value: 0 }; velocity = 0;
    }
    if (!introFinished) {
      introElapsed += dt;
      if (introElapsed >= INTRO_DURATION) introFinished = true;
    }
    const intro = introFinished ? introEnd : sampleIntro(introElapsed);
    materialTime = introFinished ? elapsed + 3 : intro.time;
    const final = introEnd;
    // Preserve the original camera path, then fit its end position to the container.
    const cameraBlend = THREE.MathUtils.smoothstep(introElapsed, 1.8, INTRO_DURATION);
    camera.position.set(intro.cameraX, intro.cameraY, intro.cameraZ);
    camera.position.lerp(restCamera, introFinished ? 1 : cameraBlend);
    cameraTarget.set(intro.lookX, intro.lookY, 0);
    camera.lookAt(cameraTarget);
    if (introFinished) camera.lookAt(final.lookX, final.lookY, 0);
    ribbon.update(intro.progress, intro.time);
    const emerging = intro.progress >= ribbon.start;
    if (emerging && selected < 0) {
      damp(inertia, 'value', gesture?.dragged ? velocity : 0, gesture?.dragged ? 0.12 : (options.releaseDamping ?? RELEASE_SMOOTH_TIME), dt * 0.6);
      const baseSpeed = options.autoRotate !== false && !reducedMotion.matches && !hovered ? options.speed ?? 0.1 : 0;
      currentSpeed = baseSpeed + inertia.value;
      if (!gesture) rotationTarget += currentSpeed * dt;
    } else currentSpeed = 0;
    damp(rotation, 'value', rotationTarget, selected >= 0 ? 0.25 : 0.1, dt * 0.6);
    ring.quaternion.setFromAxisAngle(rotationAxis, rotation.value).multiply(ringBase);
    damp(wind, 'value', selected < 0 ? Math.max(0, Math.abs(currentSpeed) - 0.1) * 0.28 : 0, selected < 0 ? 0.6 : 0.1, dt * 0.6);
    inverseRing.copy(ring.quaternion).invert();
    const focal = 2 * Math.tan(camera.fov * Math.PI / 360);
    const selectedScale = options.selectedScale ?? 1.2;
    const offset = options.selectionOffset ?? DEFAULT_SELECTION_OFFSET;
    const focusDepth = Math.max(layout.width * selectedScale / (focal * camera.aspect * 0.68), layout.height * selectedScale / (focal * 0.5));
    const extraPull = Math.max(0, Math.abs(restCamera.z) - layout.radius * selectedScale - focusDepth + offset.z);
    focusPosition.copy(referenceView).multiplyScalar(extraPull / Math.abs(referenceView.z)).add(offset).applyQuaternion(inverseRing);
    let moving = false;
    cards.forEach((card, index) => {
      const aligned = Math.abs(rotation.value - rotationTarget) < 0.2;
      const target = index === selected && (aligned || card.openingStarted) ? 1 : 0;
      if (target && !card.openingStarted) { startPulse(card.pulse, false); card.openingStarted = true; }
      card.open = reducedMotion.matches ? target : THREE.MathUtils.lerp(card.open, target, 1 - Math.pow(0.97, dt * 60));
      if (Math.abs(card.open - target) < 0.0005) card.open = target;
      const targetScale = target ? selectedScale : 1;
      card.scale = reducedMotion.matches ? targetScale : THREE.MathUtils.lerp(card.scale, targetScale, 1 - Math.pow(target ? 0.965 : 0.98, dt * 60));
      if (Math.abs(card.scale - targetScale) < 0.001) card.scale = targetScale;
      card.group.position.copy(focusPosition).multiplyScalar(card.open);
      card.group.scale.setScalar(card.scale);
      if (reducedMotion.matches) { card.pulse.value = 0; card.pulse.phase = 'idle'; }
      else stepPulse(card.pulse, dt);
      moving ||= card.open !== target || card.pulse.phase !== 'idle' || Math.abs(card.scale - targetScale) > 0.001;
      const u = card.mesh.material.uniforms;
      const start = ribbon.start + index * ribbon.emergence / cards.length;
      const end = ribbon.start + (index + 1) * ribbon.emergence / cards.length;
      card.reveal = introFinished ? 1 : THREE.MathUtils.smootherstep(intro.progress, start, end);
      card.mesh.visible = card.reveal > 0.001;
      u.uTime.value = materialTime;
      u.uVelocity.value = reducedMotion.matches ? 0 : wind.value * (options.windStrength ?? 1);
      u.uProgress.value = card.pulse.value;
      u.uOffset.value = card.reveal; u.uOffsetTotal.value = intro.progress; u.uReveal.value = card.reveal;
    });
    controls.style.opacity = introFinished ? '1' : '0';
    controls.inert = !introFinished;
    // Always advance the text controller, including when a card is still moving.
    const titleMoving = titleEffect.update(dt, reducedMotion.matches);
    moving ||= titleMoving;
    renderer.info.reset(); renderer.clear();
    renderer.render(scene, camera);
    titleEffect.render(renderer);
    renderedFrames++;
    // Upgrade front-facing previews after they are visible; no global readiness gate.
    if (introFinished && elapsed - lastUpgrade > 0.25) {
      lastUpgrade = elapsed;
      for (let index = 0; index < cards.length; index++) {
        cards[index].mesh.getWorldPosition(worldPosition);
        if (worldPosition.z < -layout.radius * 0.55) upgrade(index);
      }
    }
    const autoRotating = options.autoRotate !== false && !reducedMotion.matches && !hovered && selected < 0 && (options.speed ?? 0.1) !== 0;
    if (!introFinished || gesture || moving || Math.abs(inertia.value) > 0.002 || Math.abs(rotation.value - rotationTarget) > 0.0001 || Math.abs(wind.value) > 0.001 || autoRotating) invalidate();
  }

  function hit(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / width) * 2 - 1, -((event.clientY - rect.top) / height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(cards.map(card => card.mesh))[0]?.object.userData.index as number | undefined;
  }
  let gesture: { id: number; startX: number; startY: number; lastX: number; time: number; dragged: boolean } | null = null;
  function down(event: PointerEvent) {
    if (!introFinished || !event.isPrimary || event.button !== 0) return;
    gesture = { id: event.pointerId, startX: event.clientX, startY: event.clientY, lastX: event.clientX, time: event.timeStamp, dragged: false };
    velocity = 0;
    canvas.setPointerCapture(event.pointerId);
    invalidate();
  }
  function move(event: PointerEvent) {
    if (!gesture) { hovered = event.pointerType === 'mouse' && hit(event) !== undefined; invalidate(); return; }
    if (gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.lastX;
    const totalX = event.clientX - gesture.startX;
    const totalY = event.clientY - gesture.startY;
    if (!gesture.dragged && Math.abs(totalY) > 10 && Math.abs(totalY) > Math.abs(totalX)) { cancel(); return; }
    gesture.dragged ||= Math.abs(totalX) > 6;
    if (gesture.dragged && selected < 0) {
      const delta = -dx / width * 2.4;
      rotationTarget += delta;
      velocity = THREE.MathUtils.clamp(delta * (5 / 1.2) / Math.max(0.008, (event.timeStamp - gesture.time) / 1000), -4, 4);
    }
    gesture.lastX = event.clientX; gesture.time = event.timeStamp;
    invalidate();
  }
  function up(event: PointerEvent) {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dragged = gesture.dragged;
    if (event.timeStamp - gesture.time > 120) { velocity = 0; inertia = { value: 0 }; }
    gesture = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (!dragged) { const index = hit(event); select(index === undefined || index === selected ? -1 : index); }
    invalidate();
  }
  function cancel() {
    if (!gesture) return;
    const id = gesture?.id;
    gesture = null; velocity = 0; inertia = { value: 0 };
    if (id !== undefined && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    invalidate();
  }
  function navigate(direction: number) { select((Math.max(0, selected) + direction + cards.length) % cards.length); }
  function key(event: KeyboardEvent) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); navigate(event.key === 'ArrowRight' ? 1 : -1); }
    if (event.key === 'Escape') select(-1);
  }
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', cancel);
  canvas.addEventListener('lostpointercapture', cancel);
  canvas.addEventListener('pointerleave', () => { hovered = false; invalidate(); });
  root.addEventListener('keydown', key);
  shadow.querySelector('.prev')!.addEventListener('click', () => navigate(-1));
  shadow.querySelector('.next')!.addEventListener('click', () => navigate(1));
  close.addEventListener('click', () => select(-1));
  const observer = new ResizeObserver(resize);
  observer.observe(root);
  const visibility = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; invalidate(); });
  visibility.observe(root);
  document.addEventListener('visibilitychange', invalidate);
  reducedMotion.addEventListener('change', invalidate);
  buildCards(); resize();

  return {
    replayIntro() {
      if (destroyed) return;
      const wasSelected = selected >= 0;
      cancel();
      selected = -1; introFinished = false; introElapsed = 0; elapsed = 0;
      rotationTarget = options.rotation ?? 0; velocity = currentSpeed = lastUpgrade = 0;
      rotation = { value: rotationTarget }; inertia = { value: 0 }; wind = { value: 0 };
      for (const card of cards) { card.open = 0; card.scale = 1; card.pulse = { value: 0, phase: 'idle', closing: false }; card.openingStarted = false; }
      title.textContent = options.title ?? 'Beautiful Designs\nAdvanced Interactions'; close.hidden = true; status.textContent = 'Drag to explore';
      titleEffect.reset(title.textContent!, !reducedMotion.matches);
      if (wasSelected) options.onSelect?.(null);
      invalidate();
    },
    select(id: string | null) { if (!destroyed) select(id === null ? -1 : options.items.findIndex(item => item.id === id)); },
    update(next: Partial<CarouselOptions>) {
      if (destroyed) return;
      if (next.items) validateItems(next.items);
      const nextOptions = { ...options, ...next, text: { ...options.text, ...next.text } };
      validateTuning(nextOptions);
      const nextLayout = layoutForCount(nextOptions.items.length, nextOptions.gapDegrees, nextOptions.cardWidth, nextOptions.cardHeight);
      const wasSelected = selected >= 0;
      const rebuildLayout = !!next.items || nextLayout.gapDegrees !== layout.gapDegrees || nextLayout.width !== layout.width || nextLayout.height !== layout.height;
      const rebuildRibbon = rebuildLayout || nextOptions.tilt !== options.tilt || JSON.stringify(nextOptions.orientation) !== JSON.stringify(options.orientation);
      options = nextOptions;
      const angles = orientation();
      ringBase.setFromEuler(new THREE.Euler(angles.x, angles.y, angles.z));
      rotationAxis.copy(options.rotationAxis ?? DEFAULT_AXIS).normalize();
      if (rebuildLayout) {
        layout = nextLayout;
        const previous = geometry;
        geometry = cardGeometry();
        for (let index = 0; index < cards.length; index++) {
          cards[index].mesh.geometry = geometry;
          positionCard(cards[index].mesh, index);
        }
        previous.dispose();
      }
      if (next.items) {
        cancel();
        selected = -1; rotationTarget = options.rotation ?? 0; velocity = currentSpeed = 0;
        rotation = { value: rotationTarget }; inertia = { value: 0 }; wind = { value: 0 };
        buildCards();
      }
      if (rebuildRibbon) {
        scene.remove(ribbon.mesh); ribbon.dispose();
        ribbon = createRibbon(options.items.length, layout.radius, orientation());
        scene.add(ribbon.mesh); ribbon.enhance(options.fabric);
      } else if (next.fabric) ribbon.enhance(next.fabric);
      if (next.rotation !== undefined) {
        cancel(); rotationTarget = next.rotation; rotation = { value: rotationTarget };
        inertia = { value: 0 }; velocity = 0;
      } else if (next.selectionAngle !== undefined && selected >= 0) {
        rotationTarget = shortestAngle(rotation.value, (cards.length - 1 - selected) * layout.step - Math.PI + next.selectionAngle);
      }
      if (next.intro === false) introFinished = true;
      if (selected < 0) { title.textContent = options.title ?? 'Beautiful Designs\nAdvanced Interactions'; close.hidden = true; status.textContent = 'Drag to explore'; }
      titleEffect.setText(title.textContent!);
      if (next.intro === false) titleEffect.reset(title.textContent!, false);
      resize();
      if (next.items && wasSelected) options.onSelect?.(null);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true; generation++; queue = [];
      cancel();
      cancelAnimationFrame(frameId);
      frameId = 0;
      observer.disconnect(); visibility.disconnect();
      document.removeEventListener('visibilitychange', invalidate);
      reducedMotion.removeEventListener('change', invalidate);
      for (const card of cards) card.mesh.material.dispose();
      for (const texture of textures) texture.dispose();
      geometry.dispose(); ribbon.dispose(); titleEffect.dispose(); dummy.dispose(); renderer.dispose();
      renderer.forceContextLoss();
      root.remove();
    },
    getStats() { return { introFinished, introElapsed, rotation: rotation.value, speed: currentSpeed, wind: wind.value, title: titleEffect.getState(), count: cards.length, radius: layout.radius, gapDegrees: layout.gapDegrees, cardDegrees: layout.cardAngle * 180 / Math.PI, width, height, triangles: renderer.info.render.triangles, textures: renderer.info.memory.textures, renderedFrames, pendingImages: activeLoads + queue.length, isAnimating: !!frameId, selected: selected < 0 ? null : options.items[selected].id }; },
  };
}

function validateTuning(options: CarouselOptions) {
  for (const key of ['tilt', 'rotation', 'speed', 'selectionAngle'] as const) {
    if (options[key] !== undefined && !Number.isFinite(options[key])) throw new RangeError(`${key} must be finite.`);
  }
  for (const key of ['cameraDistanceScale', 'selectedScale', 'releaseDamping'] as const) {
    if (options[key] !== undefined && (!Number.isFinite(options[key]) || options[key]! <= 0)) throw new RangeError(`${key} must be positive.`);
  }
  if (options.cameraFov !== undefined && (!Number.isFinite(options.cameraFov) || options.cameraFov <= 0 || options.cameraFov >= 180)) throw new RangeError('Camera FOV must be between 0 and 180 degrees.');
  for (const value of [options.orientation, options.rotationAxis, options.selectionOffset]) {
    if (value && ![value.x, value.y, value.z].every(Number.isFinite)) throw new RangeError('Vector components must be finite.');
  }
  if (options.rotationAxis && Math.hypot(options.rotationAxis.x, options.rotationAxis.y, options.rotationAxis.z) === 0) throw new RangeError('Rotation axis cannot be zero.');
  for (const [key, value] of Object.entries(options.text ?? {})) {
    if (!Number.isFinite(value) || (['scale', 'transitionSpeed'].includes(key) && value <= 0) || (key === 'waveStrength' && value < 0)) throw new RangeError(`Invalid text ${key}.`);
  }
}

function validateItems(items: CarouselItem[]) {
  layoutForCount(items.length);
  if (new Set(items.map(item => item.id)).size !== items.length || items.some(item => !item.id || !item.src)) {
    throw new Error('Carousel items need unique nonempty IDs and image URLs.');
  }
}
