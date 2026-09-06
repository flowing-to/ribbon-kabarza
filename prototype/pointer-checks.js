// Run on /prototype/: agent-browser --session ribbon-input eval --stdin < prototype/pointer-checks.js
(async () => {
  const { mountRibbonCarousel, items } = window.ribbonReview;
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function idle(instance) {
    const deadline = performance.now() + 12000;
    while (instance.getStats().isAnimating || instance.getStats().pendingImages) {
      if (performance.now() > deadline) throw new Error('Carousel did not settle');
      await delay(50);
    }
  }
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  check(!reducedMotion, 'Run this momentum check with reduced motion disabled');
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;inset:0 auto auto 0;z-index:99999;width:390px;height:500px;background:#ddd';
  document.body.append(host);
  const selections = [], passed = [];
  const instance = mountRibbonCarousel(host, { items: items(3), intro: false, autoRotate: false, onSelect: id => selections.push(id) });
  const canvas = host.firstElementChild.shadowRoot.querySelector('canvas');
  try {
    await idle(instance);
    if (!reducedMotion) {
      // Synthetic pointers cannot acquire native capture. Stub capture only;
      // exercise the actual canvas listeners, raycaster and animation loop.
      const capture = { set: canvas.setPointerCapture, has: canvas.hasPointerCapture, release: canvas.releasePointerCapture };
      let captured = false;
      canvas.setPointerCapture = () => { captured = true; };
      canvas.hasPointerCapture = () => captured;
      canvas.releasePointerCapture = () => { captured = false; };
      const pointer = (type, x, y) => canvas.dispatchEvent(new PointerEvent(type, {
        pointerId: 91, isPrimary: true, button: 0, pointerType: 'touch', clientX: x, clientY: y,
      }));
      try {
        const blank = { x: 4, y: 4 };
        let card;
        for (let y = 150; y <= 400 && !card; y += 25) for (let x = 50; x <= 350 && !card; x += 25) {
          pointer('pointerdown', x, y);
          if (captured) card = { x, y };
        }
        check(card, 'Could not find a card to start the release regression');
        const dragStart = instance.getStats().rotation;
        for (let step = 1; step <= 8; step++) {
          const frames = instance.getStats().renderedFrames;
          await delay(20); pointer('pointermove', card.x - step * 12, card.y);

          if (step === 1) {
            const deadline = performance.now() + 1000;
            while (instance.getStats().renderedFrames <= frames) {
              if (performance.now() > deadline) throw new Error('Dragging did not render');
              await delay(5);
            }
            // Observe a frame after the move, not a frame during the preceding delay.
            await delay(25);
            check(instance.getStats().wind > 0.1, 'Wind waited for the slow release-velocity filter');
          }
        }
        const activeWind = instance.getStats().wind;
        await delay(200);
        check(Math.abs(instance.getStats().rotation - dragStart - 96 / 390 * 9.6) < 0.02, 'Held tracking did not settle at four times the previous strength');
        check(instance.getStats().wind < activeWind * 0.7, 'Holding the pointer still retained stale drag wind');
        for (let step = 9; step <= 12; step++) {
          await delay(20); pointer('pointermove', card.x - step * 12, card.y);

        }
        await delay(20);
        const releaseSpeed = instance.getStats().speed;
        pointer('pointerup', card.x - 144, card.y);
        await delay(40);
        check(releaseSpeed > 0.05 && instance.getStats().speed > releaseSpeed * 0.85 && instance.getStats().speed <= releaseSpeed * 1.01, 'Release braked or reaccelerated instead of preserving actual drag speed');
        const before = instance.getStats();
        pointer('pointerdown', blank.x, blank.y);
        check(!captured, 'Empty space acquired drag capture');
        await delay(180);
        const held = instance.getStats();
        check(held.rotation > before.rotation + 0.001, 'Holding empty space froze coasting');
        pointer('pointerup', blank.x, blank.y);
        await delay(40);
        const after = instance.getStats();
        // Existing release easing can briefly increase speed while settling;
        // the regression is a new gesture/capture or a reset to zero.
        check(after.speed > held.speed * 0.8, 'Empty-space click stopped momentum');
        pointer('pointerdown', blank.x, blank.y);
        pointer('pointermove', 120, blank.y);
        pointer('pointerup', 120, blank.y);
        await delay(40);
        check(!captured && instance.getStats().speed > after.speed * 0.8, 'A drag beginning in empty space captured or stopped the ring');
        instance.select('card-1'); await idle(instance);
        pointer('pointerdown', blank.x, blank.y);
        pointer('pointerup', blank.x, blank.y);
        check(instance.getStats().selected === null, 'Click-away no longer closed the open card');
        await idle(instance);
        selections.length = 0;
        passed.push('Empty-space clicks/holds/drags preserve coasting; card drag and click-away still work');
        passed.push('Smoothed 4× tracking and continuous release speed');
        passed.push('Wind responds directly to a fast drag without waiting for coast momentum');
      } finally {
        canvas.setPointerCapture = capture.set; canvas.hasPointerCapture = capture.has; canvas.releasePointerCapture = capture.release;
      }
    }
    return passed;
  } finally { instance.destroy(); host.remove(); }
})();
