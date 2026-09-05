// Bun runner; connects to an isolated agent-browser session for CDP throttling.
// Build prototype/vite.config.ts first, then pass `agent-browser get cdp-url`.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { gzipSync } from 'node:zlib';

const endpoint = process.argv[2];
if (!endpoint?.startsWith('ws://127.0.0.1:')) throw new Error('Pass the local agent-browser CDP WebSocket URL.');
const root = resolve('dist/prototype');
const output = resolve('dist/performance');
await mkdir(output, { recursive: true });
const html = await readFile('prototype/standalone.html');
const cache = new Map();
const server = Bun.serve({ hostname: '127.0.0.1', port: 4182, async fetch(request) {
  const pathname = decodeURIComponent(new URL(request.url).pathname);
  const file = resolve(root, '.' + pathname);
  if (!file.startsWith(root + '/') && pathname !== '/') return new Response(null, { status: 404 });
  try {
    if (!cache.has(pathname)) {
      const body = pathname === '/' ? html : await readFile(file);
      const type = pathname === '/' ? 'text/html' : ({ '.js': 'text/javascript', '.webp': 'image/webp', '.jpg': 'image/jpeg' }[extname(file)] ?? 'application/octet-stream');
      cache.set(pathname, { body: gzipSync(body, { level: 9 }), type });
    }
    const { body, type } = cache.get(pathname);
    return new Response(body, { headers: { 'Content-Type': type, 'Content-Encoding': 'gzip', 'Cache-Control': 'no-store' } });
  } catch { return new Response(null, { status: 404 }); }
}});

const ws = new WebSocket(endpoint);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let nextId = 0;
const pending = new Map();
const listeners = new Map();
ws.onmessage = ({ data }) => {
  const message = JSON.parse(data);
  if (message.id) {
    const task = pending.get(message.id);
    pending.delete(message.id);
    clearTimeout(task.timer);
    if (message.error) task.reject(new Error(JSON.stringify(message.error))); else task.resolve(message.result);
  } else for (const listener of listeners.get(message.method) ?? []) listener(message.params, message.sessionId);
};
function send(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 30000);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
}
function on(method, listener) {
  if (!listeners.has(method)) listeners.set(method, new Set());
  listeners.get(method).add(listener);
  return () => listeners.get(method).delete(listener);
}
const metadata = { browser: await send('Browser.getVersion'), latencyMs: 45, bandwidth: 'unlimited', cpuSlowdown: 1,
  viewport: { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false },
  cache: 'disabled; fresh browser context per navigation', gzip: true,
  bundle: 'dist/prototype/ribbon-carousel.js', runs: [] };

async function run(index, trace = false) {
  const { browserContextId } = await send('Target.createBrowserContext');
  let stopErrors;
  try {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const cdp = (method, params) => send(method, params, sessionId);
    await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Network.enable');
    await cdp('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp('Network.setBypassServiceWorker', { bypass: true });
    await cdp('Network.emulateNetworkConditions', { offline: false,
      latency: 45, downloadThroughput: -1, uploadThroughput: -1 });
    await cdp('Emulation.setDeviceMetricsOverride', metadata.viewport);
    const errors = [];
    stopErrors = on('Runtime.exceptionThrown', (event, session) => { if (session === sessionId) errors.push(event.exceptionDetails); });
    const events = [];
    const frames = [];
    let stopTrace;
    let stopFrames;
    if (trace) {
      stopTrace = on('Tracing.dataCollected', event => events.push(...event.value));
      await send('Tracing.start', { categories: 'devtools.timeline,blink.user_timing,disabled-by-default-devtools.screenshot', transferMode: 'ReportEvents' });
      stopFrames = on('Page.screencastFrame', (event, session) => {
        if (session !== sessionId) return;
        frames.push({ timestamp: event.metadata.timestamp, data: event.data });
        void cdp('Page.screencastFrameAck', { sessionId: event.sessionId });
      });
      await cdp('Page.startScreencast', { format: 'jpeg', quality: 75, maxWidth: 720, maxHeight: 450, everyNthFrame: 1 });
    }
    await cdp('Page.navigate', { url: 'http://127.0.0.1:4182/' });
    const { result, exceptionDetails } = await cdp('Runtime.evaluate', {
      expression: `new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Carousel did not finish intro')), 18000);
        function check() {
          const app = window.ribbonBenchmark;
          if (!app?.getStats().introFinished || performance.now() < 5500) return setTimeout(check, 100);
          clearTimeout(timeout);
          const gl = document.querySelector('#carousel').firstElementChild.shadowRoot.querySelector('canvas').getContext('webgl2');
          const info = gl.getExtension('WEBGL_debug_renderer_info');
          resolve({ timeOrigin: performance.timeOrigin, paints: performance.getEntriesByType('paint').map(e => ({ name: e.name, ms: e.startTime })),
            marks: performance.getEntriesByType('mark').map(e => ({ name: e.name, ms: e.startTime })),
            navigation: performance.getEntriesByType('navigation')[0].toJSON(),
            resources: performance.getEntriesByType('resource').map(e => ({ url: e.name, startMs: e.startTime, endMs: e.responseEnd,
              ttfbMs: e.responseStart - e.requestStart, transferBytes: e.transferSize, encodedBytes: e.encodedBodySize, decodedBytes: e.decodedBodySize })),
            stats: app.getStats(), gpu: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'unavailable',
            hasTweakpane: Boolean(window.ribbonTuning || document.querySelector('.tp-dfwv')) });
        }
        check();
      })`, awaitPromise: true, returnByValue: true,
    });
    if (exceptionDetails) throw new Error(JSON.stringify(exceptionDetails));
    const data = { run: index, ...result.value, errors };
    const script = data.resources.find(resource => resource.url.endsWith('/ribbon-carousel.js'));
    // Chromium's timing fields can retain the upstream localhost TTFB while
    // emulation delays delivery. Check completed request duration instead.
    if (data.navigation.responseEnd - data.navigation.requestStart < 40 || !script || script.endMs - script.startMs < 40) {
      throw new Error(`Network latency was not applied: ${JSON.stringify({ documentDuration: data.navigation.responseEnd - data.navigation.requestStart, script })}`);
    }
    if (data.hasTweakpane || data.resources.some(r => /tweakpane|playground|review\.ts/.test(r.url))) throw new Error('Debug UI contaminated the benchmark');
    if (errors.length) throw new Error(JSON.stringify(errors));
    if (trace) {
      await cdp('Page.stopScreencast'); stopFrames();
      const filmstrip = [];
      for (const [index, frame] of frames.entries()) {
        const file = `frame-${index}.jpg`;
        await writeFile(resolve(output, file), Buffer.from(frame.data, 'base64'));
        filmstrip.push({ file, ms: frame.timestamp * 1000 - data.timeOrigin });
      }
      await writeFile(resolve(output, 'filmstrip.json'), JSON.stringify(filmstrip, null, 2));
      const complete = new Promise(resolve => {
        const off = on('Tracing.tracingComplete', () => { off(); resolve(); });
      });
      await send('Tracing.end'); await complete; stopTrace();
      await writeFile(resolve(output, 'filmstrip-trace.json'), JSON.stringify({ traceEvents: events }));
      await writeFile(resolve(output, 'filmstrip-run.json'), JSON.stringify(data, null, 2));
      const shot = await cdp('Page.captureScreenshot', { format: 'png' });
      await writeFile(resolve(output, 'standalone.png'), Buffer.from(shot.data, 'base64'));
    } else metadata.runs.push(data);
    console.log(JSON.stringify({ run: index, trace, paints: data.paints, marks: data.marks, gpu: data.gpu }));
  } finally {
    stopErrors?.();
    await send('Target.disposeBrowserContext', { browserContextId });
  }
}

try {
  if (!process.argv.includes('--visual-only')) {
    for (let index = 1; index <= 5; index++) await run(index);
    await writeFile(resolve(output, 'results.json'), JSON.stringify(metadata, null, 2));
  }
  await run('visual', true);
} finally { ws.close(); server.stop(true); }
