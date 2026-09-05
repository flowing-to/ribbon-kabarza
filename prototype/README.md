# Standalone carousel — motion and ribbon review

Open `/prototype/` on the existing Vite dev server. The original remains at `/`.

This is a new plain Three.js implementation, with no React, R3F or Theatre runtime imports. It supports 3–20 items, container resizing, the original ribbon entrance, curved cards, drag momentum and wind, click/keyboard selection and wave opening/closing. Its styles are isolated in an internal shadow root. Preview images load independently with concurrency three; selected and front-facing cards upgrade to full images.

The ribbon starts when the renderer is ready, without waiting for images. Its path, spatial deformation, material shading and exported Bezier animation curves come from the original. Optional small fabric maps enhance a procedural base and never block the intro. **Replay intro** on the review page restarts it.

The selected card retains its curved geometry and rotation. Alignment, translation/scale, and the transient opening/closing wave are separate stages. The original image vertex shader and maath damping are reused; the captured ~60 Hz cadence determines the wave reference step, so it behaves consistently at 30/60/120 Hz. Wind uses the original damped velocity and squared smoothstep response.

Ring pose and spin now have separate transforms. The outer group sits at the circle center and sets its tilt/axis; its child spins around local Y. Changing tilt cannot make the ring precess or move its center during rotation. The axis option orients the entire circle and defaults to `{ x: 0, y: -1, z: 0 }`; it no longer applies an off-plane world-space spin. Selection computes the front direction in that local frame. The ribbon's ring segment uses the same pose and pivot.

Titles default to `text: { anchor: 'ring', overlapPx: 15 }`. The top rim's foreground half is projected into CSS pixels independently of spin, gaps, transient wind and card expansion. The settled text's visible bounds are bottom-anchored to that rim plus the overlap, including text rotation; explicit line breaks and wrapping grow upward. Cards draw over the title where they overlap. **Anchor → Container top** restores manual percentage positioning. Shader entrance/exit waves can temporarily move letters away from their settled anchor. The overlap is an explicit pixel value, including on mobile; use **Overlap px** to tune it.

Titles now reuse the original wave vertex shader, three-layer noise fragment shader and exported timing curves. A canvas alpha mask replaces the Troika font runtime and is rasterized only when text or size changes; it uses the existing Arial appearance without a font download. The initial title reveals around 3.97–6.73 seconds; subsequent changes exit in about 0.69 seconds and enter in 1.5 seconds. An interrupted transition keeps its current progress and reveals the latest requested title. Reduced motion skips it. The DOM heading remains available to assistive technology.

Release coast time defaults to `1.3` and can be adjusted in Tweakpane. Higher values retain momentum longer. Direct drag response and wind equations are unchanged.

A custom-element wrapper, production fallbacks and final mobile art direction remain outside this review. The composition and motion are aligned with the reference, not guaranteed pixel-identical.

## Playground tuning

**Tune** shows/hides Tweakpane. Adjust radius/gap/card dimensions, XYZ ring tilt, spin and its axis, momentum/wind, selected-card facing angle/scale/position, camera framing, and text position/rotation/size/wave/timing. Increasing **Coast time** gives a longer release. **Set spin** pauses automatic rotation. Radius and gap are linked through the same arc budget; reducing radius below the circumference required by the fixed card width is clamped to prevent overlap.

**Copy settings** opens selectable JSON and copies it when clipboard access is available. The selectable fallback works over Tailscale HTTP. UI angles are in degrees; exported API angles are in radians. Export includes the current spin, selected card, derived radius and container size. **Reset defaults** restores the review values. Nothing is written to localStorage or the server; reload resets the panel.

`playground-controls.ts` is dynamically imported only by `review.ts`, after mounting the carousel. Tweakpane and its type package are development dependencies. The library entry remains `carousel.ts`; its build fails if a Tweakpane/playground module enters the output. Plain numeric options are usable without the panel. Tweakpane setup follows its [official installation documentation](https://tweakpane.github.io/docs/getting-started/).

For a static shareable playground, run `bunx vite build --config prototype/share.vite.config.ts`. This writes the review page, controls and public assets to `dist/share`; serve that directory and open `/prototype/`. Rebuild after changes to update the shared copy. On this machine, Tailscale Funnel serves it at `https://codingvm.tail48c94d.ts.net:8443/prototype/`; disable that endpoint with `tailscale funnel --https=8443 off`.

For standalone production timing without Tweakpane, use `standalone.html` and `measure-performance.mjs` with the built library. See the [45 ms latency measurements and bundle comparison](../docs/performance-2026-09-05.md) for results and reproduction commands.

```ts
import { mountRibbonCarousel } from './carousel';

const instance = mountRibbonCarousel(element, {
  items, // 3–20 { id, title, previewSrc, src } objects
  title: 'Beautiful Designs\nAdvanced Interactions',
  intro: true,
  gapDegrees: 1,
  orientation: { x: 0, y: 27.4 * Math.PI / 180, z: -0.1 }, // radians; supersedes legacy tilt
  rotationAxis: { x: 0, y: -1, z: 0 },
  text: { anchor: 'ring', overlapPx: 15, x: 0.5, scale: 1.57, rotation: 0, waveStrength: 1, transitionSpeed: 1 },
  fabric: { color: '/previews/linen/color.jpg', normal: '/previews/linen/normal.jpg' },
  onSelect: id => console.log(id),
});
instance.update({ items: replacementItems });
instance.update({ gapDegrees: 3 }); // Retains loaded images and the open selection.
instance.select(items[0].id);
instance.replayIntro();
instance.destroy();
```

The host element must have a defined width and height. `destroy()` is idempotent; late texture results are discarded and the owned WebGL context is explicitly released. State is local to each instance. Images are external static assets, not embedded into the script.

Spacing is an angular budget: `cardDegrees = (360 - count * gapDegrees) / count`, then `radius = cardWidth / radians(cardDegrees)`. Card width is the arc length of the curved card, held at 13.8 world units to preserve shader scale. Card centers remain `360 / count` degrees apart. The default 1° gap therefore gives twelve 29° cards and twelve 1° spaces, including the closing seam. Gaps must be finite and nonnegative, with `count * gapDegrees < 360`. The review page provides a gap selector. The radius drives the card curvature, placement, ribbon path and camera fit together; wind and selection still deform the cards during animation.

Idle and hovered carousels stop rendering after motion settles. Reduced motion skips the entrance and wave and applies selection immediately. Replay resets all damping state; replay and item replacement notify `onSelect(null)` when they clear a selection. Updating `tilt` rebuilds the matching ribbon path. `getStats()` includes frame count, pending images and animation activity for verification.

## Checks

```sh
./node_modules/.bin/tsc -p prototype/tsconfig.json
bun test prototype/layout.test.ts prototype/motion.test.ts prototype/title-motion.test.ts prototype/spatial.test.ts
./node_modules/.bin/vite build --config prototype/vite.config.ts

# With the dev server and agent-browser running:
agent-browser --session ribbon-audit open http://127.0.0.1:5174/prototype/
agent-browser --session ribbon-audit eval --stdin < prototype/browser-checks.js
# Repeat with reduced motion:
agent-browser --session ribbon-audit set media reduced-motion
agent-browser --session ribbon-audit eval --stdin < prototype/browser-checks.js
agent-browser --session ribbon-audit set media light
```

The build includes Three.js and maath, excluding image files and Tweakpane. The reviewed build is **865.18 kB / 187.96 kB gzip**. Twelve cards render **32,256 triangles**, compared with 480,000 card triangles in the original. The ribbon adds 7,216 triangles only while visible; the shader title adds 2,560 triangles and one draw call. These are bundle/geometry measurements, not real-phone performance results.

Browser checks cover count changes, container resizing, desktop/mobile intro and selected pose, and a complete intro/carousel reveal with all card-image requests blocked. The repeatable browser script checks idle rendering, hover pause/resume, immediate reduced-motion selection, resizing an open card, selection callbacks, replay reset, context release and destruction with image loads pending. Layout/motion tests cover all supported counts, invalid counts, camera fit, rotation wrapping, exported curve values, pulse cadence across refresh rates and interrupted pulse recovery. Real-phone performance and production cold-load timing remain to be assessed.

Previews were generated ahead of time from the repository's existing local WebP sample images at 240px width using ffmpeg. No image resizing occurs at runtime.
