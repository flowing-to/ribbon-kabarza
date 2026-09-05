# Standalone carousel — motion and ribbon review

Open `/prototype/` on the existing Vite dev server. The original remains at `/`.

This is a new plain Three.js implementation, with no React, R3F or Theatre runtime imports. It supports 3–20 items, container resizing, the original ribbon entrance, curved cards, drag momentum and wind, click/keyboard selection and wave opening/closing. Its styles are isolated in an internal shadow root. Preview images load independently with concurrency three; selected and front-facing cards upgrade to full images.

The ribbon starts when the renderer is ready, without waiting for images. Its path, spatial deformation, material shading and exported Bezier animation curves come from the original. Optional small fabric maps enhance a procedural base and never block the intro. **Replay intro** on the review page restarts it.

The selected card retains its curved geometry and rotation. Alignment, translation/scale, and the transient opening/closing wave are separate stages. The original image vertex shader and maath damping are reused; the captured ~60 Hz cadence determines the wave reference step, so it behaves consistently at 30/60/120 Hz. Wind uses the original damped velocity and squared smoothstep response.

Exact title shader transitions, a custom-element wrapper, production fallbacks and final mobile art direction remain outside this review. The composition and motion are aligned with the reference, not guaranteed pixel-identical.

```ts
import { mountRibbonCarousel } from './carousel';

const instance = mountRibbonCarousel(element, {
  items, // 3–20 { id, title, previewSrc, src } objects
  title: 'Beautiful Designs\nAdvanced Interactions',
  intro: true,
  fabric: { color: '/previews/linen/color.jpg', normal: '/previews/linen/normal.jpg' },
  onSelect: id => console.log(id),
});
instance.update({ items: replacementItems });
instance.select(items[0].id);
instance.replayIntro();
instance.destroy();
```

The host element must have a defined width and height. `destroy()` is idempotent; late texture results are discarded. State is local to each instance. Images are external static assets, not embedded into the script.

## Checks

```sh
./node_modules/.bin/tsc -p prototype/tsconfig.json
bun test prototype/layout.test.ts prototype/motion.test.ts
./node_modules/.bin/vite build --config prototype/vite.config.ts
```

The build includes Three.js and maath, excluding image files. The reviewed build is **846.42 kB / 181.81 kB gzip**. Twelve cards render **32,256 triangles**, compared with 480,000 card triangles in the original. The ribbon adds 7,216 triangles only while visible. These are bundle/geometry measurements, not real-phone performance results.

Browser checks cover count changes, container resizing, desktop/mobile intro and selected pose, and a complete intro/carousel reveal with all card-image requests blocked. Layout/motion tests cover all supported counts, invalid counts, camera fit, rotation wrapping, exported curve values, pulse cadence across refresh rates and interrupted pulse recovery. Real-phone performance and production cold-load timing remain to be assessed.

Previews were generated ahead of time from the repository's existing local WebP sample images at 240px width using ffmpeg. No image resizing occurs at runtime.
