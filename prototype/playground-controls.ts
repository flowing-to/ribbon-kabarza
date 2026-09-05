// This module is imported only by the review page, never by the library entry.
import { Pane } from 'tweakpane';
import type { CarouselItem, CarouselOptions, mountRibbonCarousel } from './carousel';
import { DEFAULT_AXIS, DEFAULT_SELECTION_OFFSET, DEFAULT_TITLE } from './config';
import { RELEASE_SMOOTH_TIME } from './motion';

const radians = (degrees: number) => degrees * Math.PI / 180;
const degrees = (value: number) => value * 180 / Math.PI;
const defaults = {
  count: 12, gap: 1, radius: 0, cardAngle: 29, cardWidth: 13.8, cardHeight: 8,
  tiltX: 0, tiltY: 0, tiltZ: degrees(-0.1), spin: 0,
  axisX: DEFAULT_AXIS.x, axisY: DEFAULT_AXIS.y, axisZ: DEFAULT_AXIS.z,
  autoRotate: true, speed: 0.1, wind: 1, coastTime: RELEASE_SMOOTH_TIME,
  fov: 50, cameraDistance: 1,
  selectionAngle: 5, selectedScale: 1.2,
  selectedX: DEFAULT_SELECTION_OFFSET.x, selectedY: DEFAULT_SELECTION_OFFSET.y, selectedZ: DEFAULT_SELECTION_OFFSET.z,
  textX: DEFAULT_TITLE.x * 100, textY: DEFAULT_TITLE.y * 100, textScale: 1, textRotation: 0, textWave: 1, textSpeed: 1,
};

export function mountPlaygroundControls(container: HTMLElement, carousel: ReturnType<typeof mountRibbonCarousel>, createItems: (count: number) => CarouselItem[], onChange: (state: typeof defaults) => void) {
  const params = { ...defaults };
  const pane = new Pane({ title: 'Tune the carousel', container });
  let refreshing = false;
  let disposed = false;
  let lastGood = { ...params };
  const message = document.createElement('p'); message.className = 'tuning-note';
  message.textContent = 'Angles are in degrees. Radius and gap are linked, keeping card width fixed. Changes last until reload.';
  container.append(message);
  const exportDialog = document.createElement('dialog');
  exportDialog.className = 'settings-dialog';
  exportDialog.innerHTML = '<h2>Carousel settings</h2><p>Select and copy these values to send them back.</p><textarea aria-label="Carousel settings JSON" readonly></textarea><form method="dialog"><button>Close</button></form>';
  document.body.append(exportDialog);
  const exported = exportDialog.querySelector('textarea')!;

  function orientation() { return { x: radians(params.tiltX), y: radians(params.tiltY), z: radians(params.tiltZ) }; }
  function axis() { return { x: params.axisX, y: params.axisY, z: params.axisZ }; }
  function selectedOffset() { return { x: params.selectedX, y: params.selectedY, z: params.selectedZ }; }
  function textOptions() { return { x: params.textX / 100, y: params.textY / 100, scale: params.textScale, rotation: radians(params.textRotation), waveStrength: params.textWave, transitionSpeed: params.textSpeed }; }
  function options(): Partial<CarouselOptions> {
    return { gapDegrees: params.gap, cardWidth: params.cardWidth, cardHeight: params.cardHeight,
      orientation: orientation(), rotationAxis: axis(), rotation: radians(params.spin),
      autoRotate: params.autoRotate, speed: params.speed, windStrength: params.wind, releaseDamping: params.coastTime,
      cameraFov: params.fov, cameraDistanceScale: params.cameraDistance,
      selectionAngle: radians(params.selectionAngle), selectedScale: params.selectedScale, selectionOffset: selectedOffset(), text: textOptions() };
  }
  // Tweakpane may round displayed bindings to their step when refreshed. Export
  // the values actually applied to the renderer, not those rounded UI values.
  let appliedOptions = options();
  function refresh() {
    const stats = carousel.getStats();
    params.radius = stats.radius; params.cardAngle = stats.cardDegrees;
    refreshing = true;
    try { pane.refresh(); } finally { refreshing = false; }
    lastGood = { ...params };
    onChange({ ...params });
  }
  function apply(patch: Partial<CarouselOptions>) {
    if (refreshing || disposed) return;
    try {
      carousel.update(patch);
      appliedOptions = { ...appliedOptions, ...patch, text: { ...appliedOptions.text, ...patch.text } };
      delete appliedOptions.items;
      message.textContent = 'Angles are in degrees. Radius and gap are linked, keeping card width fixed. Changes last until reload.';
    }
    catch (error) { Object.assign(params, lastGood); message.textContent = error instanceof Error ? error.message : 'Invalid setting'; }
    refresh();
  }
  function setCount(count: number) {
    params.count = count;
    params.gap = Math.min(carousel.getStats().gapDegrees, 360 / count - 0.5);
    apply({ items: createItems(count), gapDegrees: params.gap });
  }
  function setGap(gap: number) { params.gap = gap; apply({ gapDegrees: gap }); }
  function setAutoRotate(enabled: boolean) { params.autoRotate = enabled; apply({ autoRotate: enabled }); }

  const shape = pane.addFolder({ title: 'Circle and cards', expanded: false });
  shape.addBinding(params, 'count', { label: 'Cards', min: 3, max: 20, step: 1 }).on('change', () => { if (!refreshing) setCount(params.count); });
  shape.addBinding(params, 'gap', { label: 'Gap °', min: 0, step: 0.1 }).on('change', () => apply({ gapDegrees: params.gap }));
  shape.addBinding(params, 'radius', { label: 'Radius (linked)', min: 0.1, step: 0.1 }).on('change', () => {
    if (refreshing) return;
    const minimum = params.count * params.cardWidth / (2 * Math.PI);
    const radius = Math.max(minimum * 1.000001, params.radius);
    params.gap = 360 / params.count - degrees(params.cardWidth / radius);
    apply({ gapDegrees: params.gap });
  });
  shape.addBinding(params, 'cardAngle', { label: 'Card arc °', readonly: true, format: value => value.toFixed(2) });
  shape.addBinding(params, 'cardWidth', { label: 'Card width', min: 5, max: 25, step: 0.1 }).on('change', () => apply({ cardWidth: params.cardWidth }));
  shape.addBinding(params, 'cardHeight', { label: 'Card height', min: 3, max: 16, step: 0.1 }).on('change', () => apply({ cardHeight: params.cardHeight }));

  const tilt = pane.addFolder({ title: 'Ring tilt and spin', expanded: true });
  for (const key of ['tiltX', 'tiltY', 'tiltZ'] as const) {
    tilt.addBinding(params, key, { label: `Tilt ${key.at(-1)} °`, min: -45, max: 45, step: 0.1 }).on('change', () => apply({ orientation: orientation() }));
  }
  tilt.addBinding(params, 'spin', { label: 'Set spin °', min: -180, max: 180, step: 0.1 }).on('change', () => {
    if (refreshing) return;
    params.autoRotate = false;
    apply({ rotation: radians(params.spin), autoRotate: false });
  });
  const spinAxis = pane.addFolder({ title: 'Spin axis', expanded: false });
  for (const key of ['axisX', 'axisY', 'axisZ'] as const) {
    spinAxis.addBinding(params, key, { label: `Axis ${key.at(-1)}`, min: -1, max: 1, step: 0.01 }).on('change', () => apply({ rotationAxis: axis() }));
  }
  const motion = pane.addFolder({ title: 'Motion', expanded: false });
  motion.addBinding(params, 'autoRotate', { label: 'Auto rotate' }).on('change', () => apply({ autoRotate: params.autoRotate }));
  motion.addBinding(params, 'speed', { label: 'Rotation speed', min: -0.5, max: 0.5, step: 0.01 }).on('change', () => apply({ speed: params.speed }));
  motion.addBinding(params, 'wind', { label: 'Wind strength', min: 0, max: 2, step: 0.05 }).on('change', () => apply({ windStrength: params.wind }));
  motion.addBinding(params, 'coastTime', { label: 'Coast time', min: 0.3, max: 3, step: 0.05 }).on('change', () => apply({ releaseDamping: params.coastTime }));

  const selected = pane.addFolder({ title: 'Selected card', expanded: false });
  selected.addBinding(params, 'selectionAngle', { label: 'Facing offset °', min: -25, max: 25, step: 0.1 }).on('change', () => apply({ selectionAngle: radians(params.selectionAngle) }));
  selected.addBinding(params, 'selectedScale', { label: 'Scale', min: 1, max: 2, step: 0.01 }).on('change', () => apply({ selectedScale: params.selectedScale }));
  for (const key of ['selectedX', 'selectedY', 'selectedZ'] as const) {
    selected.addBinding(params, key, { label: `Position ${key.at(-1)}`, min: -25, max: 15, step: 0.1 }).on('change', () => apply({ selectionOffset: selectedOffset() }));
  }

  const text = pane.addFolder({ title: 'Text placement and effect', expanded: true });
  for (const [key, label, min, max, step] of [
    ['textX', 'Horizontal %', 10, 90, 0.5], ['textY', 'Top %', -10, 60, 0.5], ['textScale', 'Size', 0.4, 2, 0.01],
    ['textRotation', 'Rotation °', -45, 45, 0.1], ['textWave', 'Wave strength', 0, 2, 0.05], ['textSpeed', 'Transition speed', 0.25, 3, 0.05],
  ] as const) text.addBinding(params, key, { label, min, max, step }).on('change', () => apply({ text: textOptions() }));
  const camera = pane.addFolder({ title: 'Camera', expanded: false });
  camera.addBinding(params, 'fov', { label: 'Field of view °', min: 25, max: 80, step: 1 }).on('change', () => apply({ cameraFov: params.fov }));
  camera.addBinding(params, 'cameraDistance', { label: 'Distance scale', min: 0.6, max: 1.8, step: 0.01 }).on('change', () => apply({ cameraDistanceScale: params.cameraDistance }));

  function exportSettings() {
    const stats = carousel.getStats();
    return { version: 1, count: stats.count, options: { ...appliedOptions, rotation: stats.rotation }, selected: stats.selected,
      derived: { radius: stats.radius, cardDegrees: stats.cardDegrees }, viewport: { width: stats.width, height: stats.height } };
  }
  pane.addButton({ title: 'Replay intro' }).on('click', () => carousel.replayIntro());
  pane.addButton({ title: 'Copy settings' }).on('click', async () => {
    exported.value = JSON.stringify(exportSettings(), null, 2);
    exportDialog.showModal(); exported.focus(); exported.select();
    if (navigator.clipboard) {
      try { await navigator.clipboard.writeText(exported.value); } catch { /* The selected text works on HTTP/Tailscale too. */ }
    }
  });
  pane.addButton({ title: 'Reset defaults' }).on('click', () => {
    Object.assign(params, defaults);
    apply({ ...options(), items: createItems(params.count) });
  });
  // Associate Tweakpane's visible labels with its numeric inputs for keyboard/AT use.
  pane.element.querySelectorAll<HTMLElement>('.tp-lblv').forEach(row => {
    const label = row.querySelector('.tp-lblv_l')?.textContent;
    if (label) row.querySelectorAll('input').forEach(input => input.setAttribute('aria-label', label));
  });
  refresh();
  return {
    setCount, setGap, setAutoRotate, exportSettings,
    dispose() { disposed = true; pane.dispose(); message.remove(); exportDialog.remove(); },
  };
}
