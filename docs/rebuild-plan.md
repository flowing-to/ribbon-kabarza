# Ribbon carousel rebuild — working plan

Status: motion-aligned carousel and initial ribbon are available at `/prototype/` for visual review. The original shader equations, world units and exported intro curves are reused; the user's trace informs motion timing. See `prototype/README.md` for checks and limitations.

## Agreed requirements

- Preserve the tilted circular carousel, curved cards, drag rotation with momentum and wind deformation.
- Preserve the flowing ribbon entrance and the wave transition that enlarges a selected card; clicking away returns it to the ring.
- Mount into any supplied element and use its bounding box. No Webflow dependency or global page styling.
- Support 3–20 supplied cards. Derive count and layout from the data.
- Accept separate preview and full-size image URLs, prepared ahead of time.
- Make meaningful content visible quickly and load each card independently.
- Initially preserve a 3D mobile composition, with layout variants possible later.
- Review working stages together before completing all visual polish.
- Start the intro immediately on mount as soon as the renderer is ready; no visibility trigger or image-readiness barrier.
- Reproduce the animation in code; Theatre timeline editing is not required.

## Observations from the current version

Inspected the source on `aykut-changes` and ran it locally with agent-browser at 1440×1000 and 390×844. Captured ribbon entrance, ring, drag deformation, selected card, and closing transition.

- The scene waits 2.5 seconds after a global loading condition before starting the intro. It requires `total > 13` and 100% loading progress. This is not an actual measure of first paint.
- All carousel images and two fabric maps participate in startup loading; font loading follows when the experience mounts.
- A resize from 390×844 to 700×390 leaves the canvas at 390×844. Crossing into the desktop breakpoint updates canvas dimensions, but does not validate the composition or all cached camera values.
- Cards use 200×100 subdivisions: 40,000 triangles each, 480,000 for twelve cards before the ribbon. This is geometry count, not measured GPU execution time.
- The scene starts at DPR 2, preserves the drawing buffer, and continuously renders. Animation code mixes real delta time with fixed 0.01 values.
- Theatre subscriptions are registered during component rendering without cleanup. Several store writes occur every frame. Curve sample arrays are recreated on render, defeating downstream memoization.
- Current code takes the first twelve sorted DOM items and assumes those textures exist. Loading hooks occur inside loops and a conditional memo callback.
- A fresh production build produces 1,494.06 kB JavaScript / 440.25 kB gzip. The older checked-in artifact is 2,471,246 bytes / approximately 532 kB gzip. Use the fresh build for subsequent comparisons.
- Direct imports of `maath` and `zustand` are absent from package.json. For inspection only, local ignored node_modules links expose already-installed transitive versions. Source and lockfiles were not altered.

Browser captures are visual references, not mobile hardware benchmarks. Local development timing is not a production performance baseline. No claim yet that Theatre is the primary bottleneck.

## Proposed implementation

A TypeScript + Three.js library, with a plain mount function and optional custom-element wrapper. React is unnecessary for the proposed public API; avoiding it here is a packaging choice, not a claim that React inherently makes WebGL slow. Retain Vite for building and the review page.

Separate responsibilities:

1. **Host and lifecycle:** container measurement through ResizeObserver, visibility tracking, scoped DOM, update and destroy methods, resource cleanup.
2. **Layout:** calculate card angles, radius, curvature, camera framing and selected-card bounds from count and available space. Stable perspective plus calculated camera distance; no table of phone widths.
3. **Interaction:** pointer capture, drag threshold, velocity, momentum, selection and dismissal. Time-based damping; explicit states for intro, idle, dragging, settling, opening, selected and closing. Interrupted transitions must remain valid.
4. **Rendering:** shared low-density geometry where possible, bounded pixel count, reusable temporary vectors, shader uniforms updated in one animation loop. Benchmark subdivision reductions against the wave silhouette.
5. **Assets:** independent image requests, limited concurrency, visibility priority, cache and texture ownership, placeholders and failure handling.
6. **Ribbon:** independent path and progress controller; derive the ring section from card layout rather than hardcoding twelve card positions. Keep shader styling, simplify only after visual comparison.

Proposed API shape (subject to review):

```ts
const carousel = mountRibbonCarousel(element, {
  items: [{ id: 'one', title: 'Example', previewSrc: 'small.webp', src: 'large.webp', width: 1200, height: 800 }],
  intro: { enabled: true, start: 'immediate' },
  layout: { variant: 'ring', tilt: -0.1 },
  motion: { autoRotate: true, speed: 0.1, windStrength: 1 },
  onSelect: (id) => {},
});
// Actual input must contain 3–20 items; example shows one item only for brevity.
carousel.update({ items: nextItems });
carousel.destroy();
```

Do not embed full images in the JavaScript bundle by default: separate files permit independent caching and priority. Provide a standalone script build for embeds and an ESM build for bundlers. Multiple instances must not share mutable selection or callbacks. Define whether concurrent contexts need limits after measuring the intended usage.

## Loading sequence

1. Render an HTML title/poster or preview immediately, before the rendering library finishes loading. Reserve container space. A WebGL ribbon itself cannot appear before its renderer is available.
2. Initialize geometry and a simple ribbon material as soon as the renderer is ready. Load small fabric maps independently or enhance a procedural base when they arrive.
3. Run the ribbon while card previews load. Reveal the ring on its animation schedule even if some cards still use placeholders.
4. Prioritize cards about to appear, then other previews. Request full images for the selected/front-facing cards as appropriate to their projected size.
5. Decode and upload upgrades in a controlled manner. Retain the preview until the replacement is ready; texture swaps must not reset motion or dimensions.
6. Failed images never freeze the scene. Keep a usable placeholder, report the asset error, and continue interaction.

Keep image loading readiness separate from intro completion and input readiness. Pause offscreen/hidden animation; use demand rendering only when rotation and deformation have actually settled. Provide reduced-motion and non-WebGL fallbacks.

## Delivery and review stages

1. **Reference and baseline:** preserve screenshots; measure a production-served version with cold cache and agreed throttling. Record bytes, first content, first ribbon frame, first carousel frame, interaction readiness, frame times and renderer memory.
2. **Carousel prototype:** create a separate implementation alongside the reference. Deliver container mounting, 3/12/20-card examples, tilt, drag, and coherent responsive camera framing. Review proportions together.
3. **Loading and interaction:** previews/full images, failure handling, wind shader, opening/closing wave, interruption handling. Review motion together.
4. **Ribbon integration:** reproduce the entrance, interpolate its handoff into the count-dependent ring, and decide timeline runtime based on the editing requirement. Review the full experience.
5. **Packaging and validation:** export API/custom element, demo configurations, accessibility, cleanup, performance tuning and documentation.

## Acceptance checks

- No arbitrary startup sleep or whole-carousel image barrier.
- Delaying/failing any single image does not prevent the ribbon, other cards, or eventual carousel interaction.
- Preview upgrades preserve card size, selection and rotation.
- Validate 3, 12 and 20 cards; invalid counts fail clearly. Updating items handles removed selection safely.
- Validate narrow portrait, landscape, desktop and a small nested container; resize without remounting. Test real touch scrolling, pointer cancellation and orientation changes.
- Repeated drag/open/close interruptions do not leave cards detached or freeze input. Keyboard navigation, Escape dismissal and reduced motion work.
- Repeated mount/destroy releases owned GPU resources and listeners; late image results do not update destroyed instances.
- Capture deterministic animation positions for comparisons, alongside actual interaction recordings.
- Tentative targets to confirm on a named phone and fixed network profile: first useful content within 1 second, first moving ribbon within 1.5 seconds, approximately 60 FPS while dragging on the target phone. These are proposed budgets, not measured promises. Track first interaction separately from artistic intro duration.

## Pending decisions

- Confirm target phone/network and text-transition fidelity during the first prototype review.

## Technical references

- Three.js responsive sizing: https://threejs.org/manual/en/responsive.html
- R3F frame-loop pitfalls: https://r3f.docs.pmnd.rs/advanced/pitfalls
- Theatre production setup distinguishes Studio from runtime playback: https://www.theatrejs.com/docs/latest/getting-started/with-html-svg

Theatre Studio is an authoring tool; the source inspected imports the playback runtime. Replacing that runtime may simplify this small component, but must preserve easing and timing and should not be sold as a proven performance fix without measurement.
