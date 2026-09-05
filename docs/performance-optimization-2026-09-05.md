# Standalone optimization follow-up — 2026-09-05

The direct browser component is now **529,237 bytes raw / 137,127 bytes gzip**, compared with **865,203 / 187,041** before this pass: **38.8% less raw JavaScript and 26.7% less compressed JavaScript**. Against the original application's 438,930-byte gzip artifact, the new browser file is 68.8% smaller.

Startup timing on the existing 45 ms latency/unlimited-bandwidth fixture remains approximately the same. The measured gains are download size, less title-fragment work, and removal of the first-frame black flash. This pass does not establish a significant first-paint improvement.

## Changes

- The library build also emits `ribbon-carousel.min.js`, a fully minified ESM artifact for direct browser imports. The existing `ribbon-carousel.js` retains Vite's annotations and formatting for downstream bundlers. Both export the same mount function, contain their runtime dependencies and exclude Tweakpane; consumers load one file. License comments are preserved.
- Transparent title-mask pixels return before reveal-noise work. At exactly `[1, 1, 1]` progress, the original fragment layers resolve to black with the mask's alpha, so the shader uses that result directly. Transition equations, geometry, title positioning and animation timing are unchanged.
- The renderer explicitly initializes its clear color to transparent before the first manual clear. This removes the opaque black canvas frame observed in the preceding visual recording.
- The standalone timing fixture imports the finished `.min.js` file. The runner accepts `RIBBON_PERF_OUTPUT` for separate result directories and rejects sessions that already have nonblank pages competing for GPU time.

[Vite documents](https://v5.vite.dev/config/build-options.html#build-minify) that ESM library mode intentionally skips whitespace minification to preserve pure annotations. The additional browser artifact runs the already bundled output through esbuild's full minification; it is not a replacement renderer or a reduction in animation quality.

## Measurements

Five accepted samples, cold HTTP cache, fresh browser context per navigation, 45 ms simulated latency, unlimited bandwidth, gzip level 9, desktop 1440 × 900 / DPR 1. Chrome 149.0.7827.155 with SwiftShader on the same VM. The dedicated browser starts at `about:blank`; an exploratory run with another carousel page active was discarded. Browser/shader caches may be warm. No mobile CPU or physical network route was simulated.

| Metric | Previous median | New median | New range |
| --- | ---: | ---: | ---: |
| First paint | 76 ms | 76 ms | 72–88 ms |
| First contentful paint | 288 ms | 296 ms | 292–308 ms |
| Library evaluated | 117.0 ms | 116.2 ms | 113.5–117.4 ms |
| Component mounted | 155.4 ms | 156.0 ms | 152.1–157.0 ms |
| First WebGL frame submitted | 185.7 ms | 189.5 ms | 184.5–190.3 ms |
| Intro complete | 4,524.2 ms | 4,529.2 ms | 4,508.2–4,536.9 ms |

These small timing differences do not establish a speed improvement; the main benefit is 49,914 fewer compressed bytes per cold component download. A bandwidth-limited connection was not benchmarked. In a separate recording, the last blank frame was at 449.0 ms and the first recognizable ribbon at 469.0 ms (previously approximately 474 ms). The early canvas frame at 297.6 ms was transparent/gray rather than black. FCP still precedes the recognizable ribbon, so it is reported separately.

## Validation

The old and optimized title renderers were compared in the same 640 × 400 WebGL buffer for hidden intro, partial intro, settled text, rotated settled text, exit and enter states. All six comparisons had **zero differing color/alpha channels**. This verifies the sampled visual states, not every possible shader input or GPU.

The standalone library's build guard passes. TypeScript and all 19 layout/motion/spatial tests pass. Browser lifecycle and interaction checks run against the actual minified browser artifact, including selection, resize, live tuning, rapid titles and disposal. The public playground was rebuilt with the rendering changes.

The [compact measurement evidence](./performance-optimization-2026-09-05.json) preserves every accepted timing sample, artifact sizes and visual-check summary. Raw resource timings and the filmstrip remain in ignored `dist/performance-optimized/`.

To reproduce, follow the [original benchmark instructions](./performance-2026-09-05.md#reproduce), using the current build and optionally `RIBBON_PERF_OUTPUT=dist/performance-optimized`. For the historical numbers and artifact, use source at `1ff6dd8`. The fixture contains no Tweakpane.
