/**
 * @fileoverview VelocityController — scroll-velocity skew effect on <main>.
 *
 * TECHNIQUE — LERP (Linear Interpolation):
 * Rather than snapping the skew directly to the delta on each scroll event,
 * we LERP from currentSkew toward targetSkew each animation frame. This
 * produces the characteristic "elastic" feel — the page distorts quickly
 * as you scroll and settles slowly after you stop.
 *
 *   currentSkew += (targetSkew - currentSkew) * LERP_COEFFICIENT
 *
 * LERP_COEFFICIENT (0.05) controls spring stiffness:
 *   0.01 = very slow, dreamy  |  0.1 = fast, snappy  |  1.0 = instant
 *
 * DECAY (0.96) gradually reduces targetSkew each frame even with no new
 * scroll input, ensuring the page returns to flat after a fast flick.
 *
 * PERFORMANCE GUARDS:
 * - rAF loop is gated behind `animating` flag to avoid multiple parallel loops.
 * - Loop exits when |currentSkew| < THRESHOLD, releasing the CPU.
 * - Guard against mobile: skew on touch devices causes visible pixel rounding
 *   artefacts and provides no UX benefit.
 * - Guard against prefers-reduced-motion: skew is vestibular-triggering for
 *   users with motion sensitivity.
 *
 * @module VelocityController
 */

import { PHYSICS, BREAKPOINTS } from '../config.js';

/**
 * Initialise the scroll-skew effect on the <main> element.
 *
 * @param {boolean} prefersReducedMotion
 */
export function initVelocityController(prefersReducedMotion) {
    // Hard gates — bail completely rather than attaching dead listeners.
    if (prefersReducedMotion || window.innerWidth <= BREAKPOINTS.MOBILE) return;

    const main = document.querySelector('main');
    if (!main) return;

    let lastScrollY  = window.scrollY;
    let currentSkew  = 0;
    let targetSkew   = 0;
    let isAnimating  = false;

    window.addEventListener('scroll', () => {
        const delta = window.scrollY - lastScrollY;
        // Clamp to prevent extreme skew on momentum scrolling.
        targetSkew = Math.max(
            -PHYSICS.SKEW_MAX_DEG,
            Math.min(PHYSICS.SKEW_MAX_DEG, delta * PHYSICS.SKEW_SENSITIVITY)
        );
        lastScrollY = window.scrollY;

        if (!isAnimating) {
            isAnimating = true;
            requestAnimationFrame(tick);
        }
    }, { passive: true });

    /** Single rAF tick — lerp toward target, then decay target toward zero. */
    function tick() {
        currentSkew  += (targetSkew - currentSkew) * PHYSICS.SKEW_LERP;
        targetSkew   *= PHYSICS.SKEW_DECAY;

        if (Math.abs(currentSkew) > PHYSICS.SKEW_THRESHOLD) {
            main.style.transform = `skewY(${currentSkew.toFixed(4)}deg)`;
            requestAnimationFrame(tick);
        } else {
            // Reset cleanly — avoid leaving a near-zero transform that
            // creates unnecessary compositing layer overhead.
            main.style.transform = '';
            isAnimating = false;
        }
    }
}
