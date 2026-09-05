# Standalone carousel performance — 2026-09-05

The standalone component reaches first contentful paint at a median **288 ms** with **45 ms simulated network latency**. The recognizable ribbon first enters the viewport at approximately **474 ms** in a separate visual recording. Its downloadable JavaScript is **187 kB gzip**, about **57% smaller** than the original bundle.

## What was measured

The production ESM library built by `prototype/vite.config.ts`, mounted by `prototype/standalone.html`. It contains Three.js and the component, with no Tweakpane, playground, React, or Vite development client. The library build rejects inclusion of playground modules. The fixture uses twelve cards, the ribbon intro, local preview/full images and fabric textures, Y tilt 27.4°, text scale 1.57 and coast time 1.3.

Five navigations in fresh browser contexts with HTTP cache disabled and service workers bypassed. Headless Chrome 149.0.7827.155 on the development Linux VM, 1440 × 900 CSS pixels, DPR 1, no CPU throttling, SwiftShader software rendering. The browser process and shader caches can be warm; these are cold HTTP-cache loads, not five fresh-machine boots.

The local static server serves gzip-compressed production files. Chrome DevTools Protocol applies 45 ms latency, with unlimited download/upload throughput. Document deliveries measured 47.0–47.9 ms and bundle requests 49.3–50.5 ms. The runner checks that the delay applies to both before accepting a sample. This models the requested delay, not an actual German hosting route: it excludes real DNS/TLS establishment, server load, packet loss and limited bandwidth. The public Tailscale playground was not the benchmark target.

## Results

All times are milliseconds from navigation start.

| Metric | Median | Range across five runs |
| --- | ---: | ---: |
| First paint (page background) | 76 | 68–84 |
| First contentful paint (browser metric) | 288 | 284–296 |
| Library evaluated | 117.0 | 114.9–118.9 |
| Component mounted | 155.4 | 151.0–160.1 |
| First WebGL frame submitted | 185.7 | 180.4–191.2 |
| Ribbon intro complete / interaction enabled | 4,524.2 | 4,509.9–4,532.7 |

FCP can count canvas presentation before the recognizable ribbon appears; neither the background paint nor a submitted WebGL frame is a claim that the ribbon is already visible. A separate recording showed a blank background at 453 ms and visible ribbon at approximately 474 ms. That recording also captured a brief dark canvas frame around 299 ms under SwiftShader; treat the filmstrip as evidence from this environment, not a physical-device rendering guarantee. Recording overhead is excluded from the five timing samples.

The roughly 4.5-second completion time includes the intentionally preserved 4.267-second entrance choreography. It is not an image-download barrier. No runtime exceptions occurred, and no Tweakpane/playground resources loaded.

## Mountable bundle comparison

Original source comes from commit `1c66386`, immediately before the rebuild checkpoints, built in a separate extracted directory with its original Vite configuration and the installed dependency set. New source uses the standalone library configuration. Both outputs include their bundled runtime dependencies; image/font files and host-provided dependencies are excluded. The original artifact is UMD; the new one is an importable ESM component.

Sizes use decimal kB and identical gzip level 9 compression.

| JavaScript artifact | Raw bytes | Gzip bytes |
| --- | ---: | ---: |
| Original `main.js` | 1,494,062 | 438,930 |
| New `ribbon-carousel.js` | 865,203 | 187,041 |
| Reduction | 42.1% | 57.4% |

Vite's console uses its own gzip defaults and reports approximately 440.25 kB and 187.97 kB respectively. The benchmark server transferred 187,041 compressed bytes for the new bundle. Compression and runtime format differences are explicit; this is a comparison of the actual deliverable configurations, not a source-code-only comparison. The original first-paint time was not remeasured, so the earlier reported 2.5 seconds is not an apples-to-apples baseline for these timings.

## Reproduce

From the repository root:

```sh
bunx vite build --config prototype/vite.config.ts
agent-browser --session ribbon-perf --executable-path /usr/bin/google-chrome open about:blank
agent-browser --session ribbon-perf get cdp-url
# Pass the returned local WebSocket URL:
bun prototype/measure-performance.mjs ws://127.0.0.1:PORT/devtools/browser/ID
agent-browser --session ribbon-perf close
```

The runner starts a localhost-only static server on port 4182, runs five samples and a separate visual recording, then stops the server and disposes its browser contexts. It writes raw timings, resource sizes, screenshots and a trace into ignored `dist/performance/`. Use `--visual-only` to repeat just the recording. A compact copy of the measured evidence is committed in [performance-2026-09-05.json](./performance-2026-09-05.json).

Metric and emulation definitions: [First Contentful Paint](https://web.dev/articles/fcp), [Chrome DevTools network emulation](https://chromedevtools.github.io/devtools-protocol/tot/Network/#method-emulateNetworkConditions).
