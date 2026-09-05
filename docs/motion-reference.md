# Motion reference and tracing

The initial standalone prototype is not yet motion-equivalent to the original. User review identified: selected cards became square-on and too large; opening lacked the original flowing wave; momentum settled too quickly; wind was excessive; the ribbon entrance was missing. Preserve the original equations before tuning geometry and loading independently.

## Applied alignment

The next review restores the original image vertex shader and 13.8×8 world-unit cards; selection moves/scales a parent group without flattening or making the card camera-facing. The pulse follows the original rise/fall easing in fixed 60 Hz reference steps. Drag sensitivity, maximum momentum, decay and wind damping now follow the original controller, with elapsed-time conversion for display rates. Camera fitting and narrow-screen focus distance remain responsive adaptations.

The ribbon uses the original approach/exit control points, count-dependent circular segment, 960 spatial samples, original shader deformation/shading and exported Bezier handles. A small numeric evaluator replaces Theatre playback. It starts without the old delay or an image readiness barrier. Exact pixel matching and the title's original shader transition are not claimed.

## Recording the original

Open `/?trace=1` on the development server. Recording starts at module load so the initial asset wait and ribbon entrance are included. The bottom-left panel offers **Stop & save**, **New take**, **Mark moment**, and saved frame-data/video links. Reload to capture another entrance. Each take stops automatically after three minutes.

Suggested take: let the intro finish; drag gently and release; drag faster and release; open one card and wait; click outside and wait; repeat once. Press **Stop & save** before leaving the page. Batches are saved every 500 ms to ignored local `motion-traces/<session>.ndjson` files. The trace endpoint and panel exist only in development, with the panel opt-in via the query parameter.

Each sample records:

- Relative timestamp; real last-frame delta; intro progress and shader time.
- Ring quaternion, target and continuously integrated quaternion.
- Camera position, orientation, FOV and aspect.
- Drag/default momentum, pointer velocity, smoothed pointer delta, carousel speed, hover and pointer-down states.
- Selected index, alignment state and click-animation state.
- Every card's animation phase, group position/scale/quaternion, mesh world matrix, opening progress, shader velocity, shader time and reveal offset.
- Pointer-down/up/cancel events and coordinates; resize and explicit user markers.

The current recorder captures after every rendered frame, including the completed world matrices and a contiguous frame index. The first tracer version sampled at 30 Hz; older files use `sample` rows rather than `frame` rows. Source callbacks read current refs without changing animation calculations. A canvas video includes frame-index/time captions and saves under the same session ID; browser encoding can drop video frames, so frame data is authoritative. Recording is not a zero-overhead hardware benchmark. Each frame includes the latest pointer coordinates, but individual pointer-move events are not retained, so this capture is for comparing motion values rather than exact input replay.

## Calculations to preserve

### Selected-card pose

`CarouselImage.tsx` translates/scales the card's parent group while retaining its card rotation and bent geometry. It targets parent world position `[0, -9, -5]` and scale `[1.2, 1.2, 1.2]`. The new prototype incorrectly flattened the geometry and interpolated to a camera-facing quaternion. Preserve the parent/card transform relationship, then fit the camera/container independently.

### Opening and closing wave

The original `uProgress` is a transient shader pulse, not the card's persistent open fraction. Opening uses `idle → damping-up → damping-down → scaledUp`; translation can continue while the wave decays. Alignment gates the start. Reproduce this distinct pulse and its easing, with explicit interruption handling to avoid the original repeated-click bug.

The vertex shader smoothsteps the pulse, offsets local Y by `2 * (0.5 + uv.x) * progress`, then applies world-space sine displacement proportional to `progress²`. Preserve frequencies, amplitudes, time scale and coordinate space. The shader also reads `vUv.y` before assigning `vUv`; this undefined value must be corrected to `uv.y`, not preserved as intentional motion.

### Wind

The material velocity is damped toward `(abs(carouselSpeed) - 0.1) * 0.28` with smoothTime `0.6` and original fixed delta `0.01`. When selected it damps toward zero with smoothTime `0.1`. The shader computes `smoothstep(0, 1, uVelocity²)` and uses this to control two wave families, evaluated in world and local coordinates. Preserve the equations and units; directly multiplying displacement by raw pointer velocity is not equivalent.

### Momentum and time

Original drag momentum damps with smoothTime `1.2`, default momentum with `2.1`, and ring orientation follows a separate damped target quaternion. Pointer coordinates are normalized by the viewport. Several calculations hardcode delta `0.01` while rotation uses real delta, so simply replacing the constants changes the perceived motion. Use measured frame rate and captured envelopes to establish a reference cadence, then preserve that cadence across refresh rates with a deliberate time conversion.

### Ribbon entrance

Preserve the Catmull–Rom path, sampled frames, ribbon cross-section, shader deformation and the exported Theatre Bezier keyframe handles. The exported JSON contains camera/look-at motion as well as progress and shader-time tracks. A generic linear tween or an unrelated ribbon path will not reproduce the entrance. Implement a small evaluator for those tracks rather than ship the Theatre editor/runtime. Image loading must not control timeline readiness, and the 2.5-second artificial wait must be removed in the replacement.

## Verification so far

An automated original-version take saved successfully and contains all thirteen sources (ring/camera plus twelve cards), a selected-card interval and a stop marker. Trace client/server TypeScript check is run separately from the existing application's unrelated type issues. The user's human-operated take remains the preferred reference for intended drag pacing.
