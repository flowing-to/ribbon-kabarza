// Run on /prototype/: agent-browser --session ribbon-input eval --stdin < prototype/intro-checks.js
(async () => {
  const { mountRibbonCarousel, items } = window.ribbonReview;
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function until(predicate) {
    const deadline = performance.now() + 10000;
    while (!predicate()) {
      if (performance.now() > deadline) throw new Error('Entrance did not reach the expected state');
      await delay(20);
    }
  }
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;inset:0;z-index:99999;width:700px;height:600px;background:#ddd';
  document.body.append(host);
  const app = mountRibbonCarousel(host, { items: items(12), intro: true });
  try {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      await until(() => app.getStats().introFinished);
      check(app.getStats().speed === 0 && app.getStats().introSpeed === 0, 'Reduced motion retained the entrance spin');
      app.replayIntro(); await until(() => app.getStats().introFinished);
      check(app.getStats().speed === 0 && app.getStats().introSpeed === 0, 'Reduced-motion replay spun the ring');
      return ['Reduced motion skips the startup burst on mount and replay'];
    }
    async function sampleEntrance() {
      check(app.getStats().introSpeed === 0, 'Entrance started with stale momentum');
      await until(() => app.getStats().introSpeed > 0);
      const first = app.getStats();
      check(first.introSpeed > 1.5 && !first.introFinished, 'Fast spin did not start as the cards emerged');
      await delay(2000);
      const later = app.getStats();
      check(later.rotation > first.rotation + 0.5, 'Cards did not rotate during the entrance');
      check(later.introSpeed > 0 && later.introSpeed < first.introSpeed * 0.85, 'Entrance momentum did not ease down');
      await until(() => app.getStats().introFinished);
      return { first: first.introSpeed, later: later.introSpeed };
    }
    const initial = await sampleEntrance();
    app.replayIntro();
    const replay = await sampleEntrance();
    check(Math.abs(initial.first - replay.first) < 0.12, 'Replay used a different startup boost');
    app.select('card-1');
    check(app.getStats().introSpeed === 0, 'Selecting a card retained startup momentum');
    app.replayIntro(); app.update({ intro: false });
    await delay(50);
    check(app.getStats().introFinished && app.getStats().introSpeed === 0, 'Skipping the intro retained its boost');
    app.update({ autoRotate: false }); app.replayIntro();
    await delay(50);
    check(app.getStats().introSpeed === 0, 'Paused autoplay regained startup momentum');
    return { initial, replay, checks: 'Startup burst, decay, replay, selection cancellation, skipped intro and paused autoplay passed' };
  } finally { app.destroy(); host.remove(); }
})();
