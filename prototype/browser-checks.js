// Run on /prototype/: agent-browser --session ribbon-audit eval --stdin < prototype/browser-checks.js
// Exercise the real renderer and public API; no browser testing dependency is bundled.
(async () => {
  const { mountRibbonCarousel, items } = window.ribbonReview;
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function until(predicate, message) {
    const deadline = performance.now() + 12000;
    while (!predicate()) {
      if (performance.now() > deadline) throw new Error(message);
      await delay(50);
    }
  }
  async function idle(instance) {
    await until(() => !instance.getStats().isAnimating && instance.getStats().pendingImages === 0, 'Rendering did not settle');
    const before = instance.getStats().renderedFrames;
    await delay(350);
    check(instance.getStats().renderedFrames === before, 'Idle carousel continued drawing');
  }
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;inset:0 auto auto 0;z-index:99999;width:390px;height:500px;background:#ddd';
  document.body.append(host);
  const selections = [];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let instance;
  const passed = [];
  try {
    instance = mountRibbonCarousel(host, { items: items(3), intro: false, autoRotate: false, onSelect: id => selections.push(id) });
    const canvas = host.firstElementChild.shadowRoot.querySelector('canvas');
    const context = canvas.getContext('webgl2');
    await idle(instance);
    passed.push('Static carousel stops drawing after image uploads');
    instance.update({ autoRotate: true, speed: 0 });
    await idle(instance);
    passed.push('Zero rotation speed does not keep a render loop alive');
    if (!reducedMotion) {
      instance.update({ speed: 0.1 });
      await until(() => instance.getStats().speed > 0, 'Auto rotation did not resume');
      let found = false;
      for (const y of [250, 275, 300, 325, 350]) {
        canvas.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', clientX: 195, clientY: y }));
        await delay(100);
        if (instance.getStats().speed === 0) { found = true; break; }
      }
      check(found, 'Could not hover the visible ring');
      await idle(instance);
      passed.push('Hover pauses rotation and drawing after settling');
      canvas.dispatchEvent(new PointerEvent('pointerleave'));
      await until(() => instance.getStats().speed > 0, 'Leaving the card did not resume rotation');
    }
    instance.update({ autoRotate: false });
    const selectedAt = performance.now();
    instance.select('card-2');
    await idle(instance);
    if (reducedMotion) {
      check(performance.now() - selectedAt < 1000, 'Reduced-motion selection still animates');
      passed.push('Reduced-motion selection settles immediately');
    }
    check(instance.getStats().selected === 'card-2', 'Selection was lost');
    check(instance.getStats().title.text === items(3)[1].title && instance.getStats().title.phase === 'idle', 'Shader title did not settle on the selected card');
    instance.select('card-2');
    check(selections.join(',') === 'card-2', 'Selecting the same card emitted duplicate callbacks');
    host.style.width = '260px'; host.style.height = '300px';
    await until(() => instance.getStats().width === 260 && instance.getStats().height === 300, 'Open card did not resize');
    check(instance.getStats().selected === 'card-2', 'Resize cleared selection');
    passed.push('Open selection survives container resize without restarting');
    const previousRadius = instance.getStats().radius;
    instance.update({ gapDegrees: 3 });
    check(instance.getStats().gapDegrees === 3 && instance.getStats().radius > previousRadius, 'Angular gap did not update the radius');
    check(instance.getStats().selected === 'card-2' && instance.getStats().pendingImages === 0, 'Gap update reset selection or reloaded images');
    let rejected = false;
    try { instance.update({ gapDegrees: 120 }); } catch { rejected = true; }
    check(rejected && instance.getStats().gapDegrees === 3, 'Invalid gap update corrupted the active layout');
    passed.push('Gap changes preserve selection and images; invalid budgets leave the layout intact');
    instance.update({ orientation: { x: 0.1, y: 0, z: -0.05 }, rotationAxis: { x: -0.05, y: -1, z: 0 },
      selectionAngle: 0, selectedScale: 1.1, text: { x: 0.45, y: 0.15, rotation: 0.1, waveStrength: 0.8 } });
    await idle(instance);
    check(instance.getStats().selected === 'card-2' && instance.getStats().title.text === items(3)[1].title, 'Live tuning reset the selected card or title');
    let rejectedAxis = false;
    try { instance.update({ rotationAxis: { x: 0, y: 0, z: 0 } }); } catch { rejectedAxis = true; }
    check(rejectedAxis && instance.getStats().selected === 'card-2', 'A zero rotation axis corrupted the scene');
    passed.push('Live orientation, axis, selected pose and text tuning preserve selection');
    instance.update({ items: items(20), tilt: -0.2 });
    check(selections.at(-1) === null, 'Replacing selected items did not notify the host');
    await idle(instance);
    check(instance.getStats().count === 20, 'Count update failed');
    passed.push('Count/tilt changes rebuild the scene and notify deselection');
    const textureCount = instance.getStats().textures;
    for (const id of ['card-1', 'card-2', null, 'card-3']) {
      instance.select(id); await delay(80);
    }
    await idle(instance);
    check(instance.getStats().title.text === items(20)[2].title, 'Interrupted shader transitions revealed a stale title');
    check(instance.getStats().textures === textureCount, 'Title changes retained old GPU textures');
    passed.push('Rapid title transitions settle on the latest selection without retaining textures');
    instance.select('card-1');
    instance.replayIntro();
    check(selections.at(-1) === null, 'Replay did not notify deselection');
    check(instance.getStats().wind === 0 && instance.getStats().speed === 0, 'Replay retained drag motion');
    instance.destroy(); instance.destroy();
    check(host.childElementCount === 0 && !instance.getStats().isAnimating, 'Destroy left a root or animation behind');
    check(context.isContextLost(), 'Destroy retained its WebGL context');
    passed.push('Replay resets motion; repeated destroy is safe');
    for (let cycle = 0; cycle < 3; cycle++) {
      instance = mountRibbonCarousel(host, { items: items(3), intro: false, autoRotate: false });
      instance.update({ items: items(12) });
      instance.destroy();
    }
    await delay(500);
    check(host.childElementCount === 0, 'Late image results restored a destroyed instance');
    passed.push('Immediate update/destroy tolerates pending image loads');
    return passed;
  } finally {
    instance?.destroy(); host.remove();
  }
})();
