# Current motion behavior

## Pointer interaction

A press starts a drag only when the card raycast hits. Pressing empty canvas space leaves rotation, momentum and pointer capture alone. A short empty-space click can dismiss an open card. Moving more than 6 pixels cancels that dismissal. A drag that starts on a card can continue outside it through pointer capture.

Horizontal travel must exceed 6 pixels to count as dragging. A primarily vertical movement exceeding 10 pixels cancels the gesture so touch scrolling remains available.

## Drag tracking and release

For a horizontal pointer step `dx`, container width `W`, and event interval `dtEvent`:

```text
angleStep = -dx / W × 2.4
rotationTarget += angleStep
velocityInput = clamp(angleStep × (5 / 1.2) / max(0.008, dtEvent), -4, 4)
```

A full-container-width drag changes the target by 2.4 radians (137.5°). The velocity input used for release and wind is capped at ±4 rad/s (±229°/s). This does not cap direct pointer travel or guarantee a hard cap on the filtered release speed. The 8 ms event-interval floor stabilizes velocity estimation; it is not an 8 ms tracking delay.

The current maath filters receive frame delta multiplied by 0.6:

| Filter | Configured smooth time | Approximate wall-clock response scale |
| --- | ---: | ---: |
| Ring follows dragged position | 0.1 | 167 ms |
| Drag velocity estimate rises | 0.12 | 200 ms |
| Release velocity decays | 1.3 | 2.17 s |
| Selected card alignment | 0.25 | 417 ms |

These are smoothing scales, not fixed delays or exact stop times. For example, an isolated position step takes roughly 0.4 seconds to reach 95% of its target with the current position filter. There is no separate hard acceleration limit. The position filter explains the visible trailing during a quick drag.

During a drag, pointer steps advance the target directly; filtered velocity supplies release momentum and no longer delays wind. After release, angular speed is steady autoplay (default 0.1 rad/s) plus release momentum and any remaining entrance momentum. The target advances by `speed × frameDelta`. Holding still for over 120 ms before releasing a card clears release momentum. The maath derivative carried from drag into release can briefly increase filtered momentum as its smoothing time changes.

**Suggested next tuning, not applied yet:** use near-direct position tracking or approximately 6–8 ms smoothing while held, then capture the recent pointer velocity and decay it separately after release. This would preserve a long coast without using the slow position filter to follow the pointer. A 60 Hz display still presents frames about every 16.7 ms.

## Entrance spin

The original builds momentum by 0.02 per frame before the ribbon reaches the cards, then damps that momentum toward zero with smooth time 2.1 and reference delta 0.01. The rebuild reproduces the buildup as `0.02 × 60 × frameDelta`, capped at the original limit of 28, so refresh rate does not change the boost.

At the handoff, this separate momentum begins rotating the ring and decays with `damp(..., 2.1, frameDelta × 0.6)`. With twelve cards, browser checks observed roughly 2.65–2.68 rad/s of entrance momentum. Steady autoplay adds 0.1 rad/s. Replay starts a fresh buildup. Card interaction cancels it; empty-space clicks do not. Reduced motion, skipping the intro, disabling autoplay or setting its speed to zero suppresses the startup burst.

## Wind response

Wind now reads the current raw drag velocity while the pointer moves, and the actual combined rotational speed during free coasting. A held pointer with no movement for 50 ms supplies zero velocity, so stale input cannot keep the wind active.

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
