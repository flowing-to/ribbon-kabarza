# Current motion behavior

## Pointer interaction

A press starts a drag only when the card raycast hits. Pressing empty canvas space leaves rotation, momentum and pointer capture alone. A short empty-space click can dismiss an open card. Moving more than 6 pixels cancels that dismissal. A drag that starts on a card can continue outside it through pointer capture.

Horizontal travel must exceed 6 pixels to count as dragging. A primarily vertical movement exceeding 10 pixels cancels the gesture so touch scrolling remains available.

## Drag tracking and release

Pointer movement advances the target by `-dx / containerWidth × 9.6` radians (four times checkpoint 5). The ring follows with a short 35 ms maath smooth time using actual frame delta. This adds a little acceleration and braking while held, without limiting total travel. At 60 Hz, a stationary target is approximately 95% reached within 83 ms.

Each frame measures actual angular speed from the rotation change divided by frame delta. On release, that speed becomes the initial coast speed, and any remaining pointer-target offset is discarded. Coast uses the existing 1.3 smooth time and `frameDelta × 0.6`, with a fresh damping derivative. Position then integrates the eased speed directly, avoiding a second filter that would cause a pause and renewed acceleration. There is no release-speed clamp; wind alone is capped to the previous ±4 rad/s input envelope to preserve the deformation strength.

Holding the pointer still lets the short tracking filter settle and its measured speed approach zero, naturally reducing the subsequent coast. Selection alignment retains its separate 0.25 smooth time.

## Entrance spin

The original builds momentum by 0.02 per frame before the ribbon reaches the cards, then damps that momentum toward zero with smooth time 2.1 and reference delta 0.01. The rebuild reproduces the buildup as `0.02 × 60 × frameDelta`, capped at the original limit of 28, so refresh rate does not change the boost.

At the handoff, this separate momentum begins rotating the ring and decays with `damp(..., 2.1, frameDelta × 0.6)`. With twelve cards, browser checks observed roughly 2.65–2.68 rad/s of entrance momentum. Steady autoplay adds 0.1 rad/s. Replay starts a fresh buildup. Card interaction cancels it; empty-space clicks do not. Reduced motion, skipping the intro, disabling autoplay or setting its speed to zero suppresses the startup burst.

## Wind response

Wind reads actual ring speed during dragging and free coasting, capped to ±4 rad/s for deformation only. It follows the short drag response and naturally fades when held still.

```text
acceleration = abs(speed - previousSpeed) / frameDelta
speedTarget = max(0, abs(speed) - 0.1) × 0.28
accelerationTarget = min(0.28, acceleration × 0.006)
target = max(speedTarget, accelerationTarget)
tau = target > wind ? 0.012 : 0.12
wind += (target - wind) × (1 - exp(-frameDelta / tau))
```

The 12 ms attack reaches about 75% of a step within one 60 Hz frame; the 120 ms fade takes about 360 ms to lose 95% after its target becomes zero. The acceleration contribution is capped and combined with `max`, rather than added on top. This filter cannot overshoot its target through a carried damping derivative. The existing `windStrength` setting still multiplies the result sent to the original deformation shader. Selection fades wind out; reduced motion and replay reset it.

Regression checks: `prototype/pointer-checks.js` exercises empty-space clicks/holds/drags, card dragging, stationary-pointer wind decay and click-away dismissal. `prototype/intro-checks.js` checks load/replay spin and cancellation, including reduced motion. Unit checks compare the entrance and wind envelopes at 30/60/120 Hz.
