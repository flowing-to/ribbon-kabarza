type ReadSource = () => unknown;
type TraceRow = { t: number; type: string; [key: string]: unknown };
const enabled = import.meta.env.DEV && new URLSearchParams(location.search).has('trace');
const sources = new Map<string, ReadSource>();
const engine = location.pathname.startsWith('/prototype') ? 'prototype' : 'original';
let session = '';
let recording = false;
let started = 0;
let rows: TraceRow[] = [];
let saved = 0;
let sending: Promise<void> | null = null;
let panel: HTMLDivElement | null = null;
let status: HTMLSpanElement | null = null;
let frame = 0;
let lastFrameTime = 0;
let captureCanvas: HTMLCanvasElement | null = null;
let videoRecorder: MediaRecorder | null = null;
let videoStream: MediaStream | null = null;
let videoTrack: CanvasCaptureMediaStreamTrack | null = null;
let videoCanvas: HTMLCanvasElement | null = null;
let videoContext: CanvasRenderingContext2D | null = null;
let videoChunks: Blob[] = [];
let videoDone: Promise<void> | null = null;
let videoAttempted = false;
let stopping = false;
let videoError = '';
let pointer: { x: number; y: number; buttons: number } | null = null;

export function setMotionTraceCanvas(canvas: HTMLCanvasElement) {
  if (enabled) captureCanvas = canvas;
}

/** Call once after the renderer has updated world matrices and drawn the frame. */
export function recordMotionFrame() {
  if (!enabled || !recording) return;
  const now = performance.now();
  const state: Record<string, unknown> = {};
  for (const [name, read] of sources) state[name] = read();
  const row = { t: now - started, type: 'frame', frame: frame++, dt: lastFrameTime ? (now - lastFrameTime) / 1000 : 0, pointer, state };
  rows.push(row);
  lastFrameTime = now;
  if (!videoAttempted && captureCanvas) startVideo();
  if (videoContext && videoCanvas && captureCanvas && videoRecorder?.state === 'recording') {
    videoContext.fillStyle = '#d8d8d8';
    videoContext.fillRect(0, 0, videoCanvas.width, videoCanvas.height);
    videoContext.drawImage(captureCanvas, 0, 0, videoCanvas.width, videoCanvas.height);
    videoContext.fillStyle = '#14231fe6';
    videoContext.fillRect(0, videoCanvas.height - 30, videoCanvas.width, 30);
    videoContext.fillStyle = 'white'; videoContext.font = '14px monospace';
    videoContext.fillText(`${engine} | frame ${row.frame} | ${(row.t / 1000).toFixed(3)}s`, 10, videoCanvas.height - 10);
    videoTrack?.requestFrame();
  }
}

function startVideo() {
  videoAttempted = true;
  if (!captureCanvas) return;
  try {
    if (typeof MediaRecorder === 'undefined') throw new Error('MediaRecorder unavailable');
    videoCanvas = document.createElement('canvas');
    const scale = Math.min(1, 1280 / captureCanvas.width, 900 / captureCanvas.height);
    videoCanvas.width = Math.max(2, Math.round(captureCanvas.width * scale));
    videoCanvas.height = Math.max(2, Math.round(captureCanvas.height * scale));
    videoContext = videoCanvas.getContext('2d');
    videoStream = videoCanvas.captureStream(0);
    videoTrack = videoStream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
    const mimeType = ['video/webm;codecs=vp8', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type));
    if (!mimeType) throw new Error('WebM recording unavailable');
    const recorder = new MediaRecorder(videoStream, { mimeType, videoBitsPerSecond: 2_500_000 });
    videoRecorder = recorder; videoChunks = [];
    const target = session;
    recorder.addEventListener('dataavailable', event => { if (event.data.size) videoChunks.push(event.data); });
    videoDone = new Promise(resolve => {
      recorder.addEventListener('stop', async () => {
        const blob = new Blob(videoChunks, { type: mimeType });
        try {
          if (!blob.size) throw new Error('No video frames');
          const result = await fetch(`/__ribbon-trace?session=${target}&video=1`, { method: 'POST', headers: { 'Content-Type': mimeType }, body: blob });
          if (!result.ok) throw new Error('Video upload failed');
          const link = panel?.querySelector<HTMLAnchorElement>('[data-link="video"]');
          if (link) { link.href = `/__ribbon-trace?session=${target}&video=1`; link.hidden = false; }
        } catch {
          videoError = 'Video save failed; frame data retained';
          const link = panel?.querySelector<HTMLAnchorElement>('[data-link="video"]');
          if (link && blob.size) { link.href = URL.createObjectURL(blob); link.download = `${target}.webm`; link.textContent = 'Download unsaved video'; link.hidden = false; }
        } finally {
          videoStream?.getTracks().forEach(track => track.stop());
          videoChunks = []; resolve();
        }
      }, { once: true });
    });
    recorder.start(1000);
    record('video-start', { frame, size: [videoCanvas.width, videoCanvas.height], mimeType });
  } catch {
    videoError = 'Video unavailable; frame data is recording';
    videoStream?.getTracks().forEach(track => track.stop());
    videoContext = null;
  }
}

export function registerMotionSource(name: string, read: ReadSource) {
  if (!enabled) return () => {};
  sources.set(name, read);
  return () => { if (sources.get(name) === read) sources.delete(name); };
}

function record(type: string, data: Record<string, unknown>) {
  if (recording) rows.push({ t: performance.now() - started, type, ...data });
}

async function flush() {
  if (sending) await sending;
  if (!rows.length) return;
  const batch = rows.splice(0, 300);
  const target = session;
  sending = fetch(`/__ribbon-trace?session=${target}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(batch),
  }).then(response => {
    if (!response.ok) throw new Error('Save failed');
    saved += batch.length;
    if (status) status.textContent = `${recording ? 'Recording' : 'Data saved'} · ${frame} frames · ${videoError || (videoRecorder ? 'video + data' : 'data')}`;
  }).catch(() => {
    rows.unshift(...batch);
    if (status) status.textContent = 'Save failed — retrying; keep this tab open';
  }).finally(() => { sending = null; });
  await sending;
}

function start() {
  if (recording || stopping || rows.length || sending) return;
  started = performance.now(); saved = 0; frame = 0; lastFrameTime = 0;
  videoAttempted = false; videoRecorder = null; videoDone = null; videoError = ''; pointer = null;
  panel?.querySelectorAll<HTMLAnchorElement>('a').forEach(link => { if (link.href.startsWith('blob:')) URL.revokeObjectURL(link.href); link.hidden = true; link.removeAttribute('download'); });
  session = `${engine}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  recording = true;
  record('start', { engine, viewport: [innerWidth, innerHeight], dpr: devicePixelRatio, sampling: 'every-rendered-frame-after-draw', date: new Date().toISOString() });
  if (status) status.textContent = 'Recording · includes intro';
}

async function stop() {
  if (stopping || !recording) return;
  stopping = true;
  record('stop', {}); recording = false;
  if (videoRecorder?.state === 'recording') videoRecorder.stop();
  await flush();
  while (rows.length && !status?.textContent?.startsWith('Save failed')) await flush();
  await videoDone;
  const link = panel?.querySelector<HTMLAnchorElement>('[data-link="trace"]');
  if (link) { link.href = `/__ribbon-trace?session=${session}`; link.hidden = false; }
  if (status && !rows.length) status.textContent = `Saved ${frame} frames · ${videoError || 'video + data ready'}`;
  stopping = false;
}

if (enabled) {
  panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;bottom:8px;left:8px;z-index:2147483647;background:#17241fee;color:white;padding:10px 12px;border-radius:8px;font:12px/1.4 Arial;display:flex;gap:10px;align-items:center;flex-wrap:wrap;max-width:calc(100vw - 16px)';
  panel.innerHTML = '<span></span><button data-action="stop">Stop & save</button><button data-action="start">New take</button><button data-action="mark">Mark moment</button><a data-link="trace" hidden target="_blank" style="color:#caffda">Frame data</a><a data-link="video" hidden target="_blank" style="color:#caffda">Video</a>';
  status = panel.querySelector('span');
  document.body.append(panel);
  panel.querySelector('[data-action="stop"]')!.addEventListener('click', () => void stop());
  panel.querySelector('[data-action="start"]')!.addEventListener('click', start);
  panel.querySelector('[data-action="mark"]')!.addEventListener('click', () => record('mark', {}));
  const saveTimer = setInterval(() => {
    void flush();
    if (recording && performance.now() - started > 180_000) void stop();
  }, 500);
  const onPointer = (event: PointerEvent) => {
    if (panel?.contains(event.target as Node)) return;
    record(event.type, { x: event.clientX, y: event.clientY, pointerType: event.pointerType, buttons: event.buttons });
  };
  const onResize = () => record('resize', { viewport: [innerWidth, innerHeight] });
  const onMove = (event: PointerEvent) => { pointer = { x: event.clientX, y: event.clientY, buttons: event.buttons }; };
  const onKey = (event: KeyboardEvent) => {
    if (['ArrowLeft', 'ArrowRight', 'Escape'].includes(event.key)) record('key', { key: event.key });
  };
  for (const type of ['pointerdown', 'pointerup', 'pointercancel'] as const) window.addEventListener(type, onPointer, true);
  window.addEventListener('resize', onResize);
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('keydown', onKey);
  start();
  import.meta.hot?.dispose(() => {
    void stop(); clearInterval(saveTimer);
    for (const type of ['pointerdown', 'pointerup', 'pointercancel'] as const) window.removeEventListener(type, onPointer, true);
    window.removeEventListener('resize', onResize); window.removeEventListener('keydown', onKey); window.removeEventListener('pointermove', onMove);
    panel?.remove(); sources.clear();
  });
}
