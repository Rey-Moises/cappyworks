/**
 * @fileoverview main.js — Engine entry point and loader orchestration.
 *
 * ROLE OF THIS FILE:
 * main.js is intentionally thin. Its only jobs are:
 *   1. Build the DOM reference map (once, after the DOM is ready).
 *   2. Detect the reduced-motion preference (once, at startup).
 *   3. Call each controller's init function in the correct order.
 *   4. Dismiss the page loader after the minimum brand-display window.
 *
 * ADDING A NEW CONTROLLER:
 *   1. Create static/js/controllers/YourController.js
 *   2. Export initYourController(dom, prefersReducedMotion)
 *   3. Import and call it here — no other file changes required.
 *
 * ES MODULE NOTE:
 * This script is loaded with type="module" in index.html, which means:
 *   - It is deferred automatically (no defer attribute needed).
 *   - It runs in strict mode automatically.
 *   - It has module scope (no global leakage).
 *
 * @module main
 */

import { initMarqueeController }     from './controllers/MarqueeController.js';
import { buildDOM }                  from './config.js';
import { initThemeController }       from './controllers/ThemeController.js';
import { initScrollController }      from './controllers/ScrollController.js';
import { initNavController }         from './controllers/NavController.js';
import { initVelocityController }    from './controllers/VelocityController.js';
import { initAnimationController }   from './controllers/AnimationController.js';
import { TIMING }                    from './config.js';

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Dismiss the page loader after the minimum brand-display window.
 *
 * WHY DOMContentLoaded INSTEAD OF window.load:
 * window.load fires after ALL external resources (Google Fonts, Font Awesome
 * CDN, all images). On a slow connection this could be 3–5 seconds. Users
 * would see the loader for the entire duration with no page content.
 * DOMContentLoaded fires as soon as the HTML is parsed, which is typically
 * < 100ms. The minimum visible timer (LOADER_MIN_VISIBLE_MS) ensures the
 * brand wordmark is still readable before the loader slides away.
 *
 * WHY transitionend INSTEAD OF setTimeout FOR display:none:
 * A blind setTimeout for display:none runs on a fixed offset that may not
 * align with the actual CSS transition duration. transitionend fires exactly
 * when the slide-up finishes, regardless of duration changes in CSS.
 *
 * @param {number} delayMs - Minimum loader display time in ms.
 */
function dismissLoader(delayMs) {
    setTimeout(() => {
        const loader = document.getElementById('page-loader');
        if (!loader) return;

        loader.classList.add('loaded');
        loader.addEventListener(
            'transitionend',
            () => { loader.style.display = 'none'; },
            { once: true }
        );
    }, delayMs);
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

/**
 * Initialise all controllers.
 * Called once from DOMContentLoaded — order matters where controllers
 * depend on DOM state established by a prior controller (e.g. ThemeController
 * must run before animations to avoid a frame where the wrong theme flashes).
 */
function init() {
    const dom = buildDOM();
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ThemeController first — syncs [data-theme] before any paint.
    initThemeController(dom, prefersReducedMotion);

    initScrollController(dom);
    initNavController(dom);
    initVelocityController(prefersReducedMotion);
    initAnimationController(dom, prefersReducedMotion);
    initMarqueeController(document.querySelectorAll('.marquee-track'));

    console.log('✅ CappyWorksEngine ready.');
}

// DOMContentLoaded is the earliest safe point to query the DOM.
document.addEventListener('DOMContentLoaded', () => {
    try {
        init();
    } catch (err) {
        // Fail-open: log the error but never leave the user staring at the loader.
        console.error('CappyWorksEngine init failed:', err);
    } finally {
        dismissLoader(TIMING.LOADER_MIN_VISIBLE_MS);
    }
});
