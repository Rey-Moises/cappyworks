/**
 * @fileoverview MarqueeController — GPU-accelerated, scroll-reactive, seamlessly looping marquee.
 *
 * LOOPING MECHANISM:
 * Each track contains two identical content tiles side-by-side in HTML.
 * When the drift offset reaches one tile's pixel width, the second tile
 * is at the exact position the first started — visually seamless.
 * Modulo-wrapping the per-track drift accumulator at that boundary
 * creates an infinite loop at constant speed.
 *
 *   ┌──────────────────┬──────────────────┐
 *   │   TILE A (orig)  │   TILE B (clone) │  ← .marquee-track
 *   └──────────────────┴──────────────────┘
 *   |← tileWidth ─────→|
 *   drift = tileWidth → snap to 0 → second tile is now where first started.
 *
 * WHY SPEED IS DERIVED FROM TILE WIDTH (not a fixed px/s constant):
 * The text font-size is `clamp(5rem, 14vw, 14rem)`. At desktop widths a
 * single .bg-text span can be 6,000–9,000px wide. A fixed BASE_SPEED of
 * 30px/s would take 3–5 minutes per loop — functionally invisible.
 * The CSS `animation: marquee-scroll 45s linear` was immune to this because
 * `translate(-50%)` is relative to the element's own width.
 * We replicate that by computing: speed = tileWidth / LOOP_PERIOD_S.
 * This guarantees one full loop always takes LOOP_PERIOD_S seconds,
 * regardless of font size, viewport width, or content length.
 *
 * WHY rAF INSIDE fonts.ready:
 * `document.fonts.ready` fires after fonts are loaded but potentially before
 * the browser has completed a layout pass with those fonts. Calling
 * offsetWidth at that exact moment can return stale (fallback font) values.
 * Wrapping `start()` in requestAnimationFrame ensures we're measuring in
 * a fresh layout frame with the correct painted font metrics.
 *
 * FRAME-RATE INDEPENDENCE:
 * All motion is normalised by deltaTime. Speed is identical at 30, 60,
 * 120, and 144Hz.
 *
 * @module MarqueeController
 */

/**
 * Target seconds for one full loop cycle on the base track (index 0).
 * Equivalent to the CSS `animation-duration`. Higher tracks complete faster
 * because of SPEED_STEP, but the base cadence is set here.
 * @type {number}
 */
const LOOP_PERIOD_S = 40;

/** LERP smoothing factor for scroll influence, calibrated at 60fps. @type {number} */
const SCROLL_LERP_60FPS = 0.075;

/** Per-track speed multiplier increment — track 0 = 1×, track 1 = 1.15×, etc. @type {number} */
const SPEED_STEP = 0.15;

/** How much the smoothed scroll position influences track offset. @type {number} */
const SCROLL_COEFF = 0.3;

/**
 * Frame-rate-independent LERP coefficient via exponential decay.
 * @param {number} alpha60 - Desired factor at exactly 60fps.
 * @param {number} deltaMs - Elapsed ms since last frame.
 * @returns {number}
 */
function adaptiveLerp(alpha60, deltaMs) {
    return 1 - Math.pow(1 - alpha60, deltaMs / 16.667);
}

/**
 * Measure the pixel width of one content tile (the first .bg-text span).
 *
 * Must be called from within a requestAnimationFrame after fonts.ready so
 * layout reflects the actual web font, not the fallback serif.
 *
 * @param {NodeListOf<Element>} tracks
 * @returns {number[]} Per-track tile widths in pixels.
 */
function measureTileWidths(tracks) {
    return Array.from(tracks).map(track => {
        const span  = track.querySelector('.bg-text');
        const width = span?.offsetWidth ?? 0;
        // Graceful fallback: if the element has no layout (e.g. display:none),
        // use a safe estimate so the loop still runs at a reasonable rate.
        return width > 0 ? width : 4000;
    });
}

/**
 * Compute per-track drift speeds in px/s so each track loops in LOOP_PERIOD_S.
 * Track i loops faster than track 0 by the SPEED_STEP multiplier, giving
 * the depth effect of multiple tracks moving at different rates.
 *
 * @param {number[]} tileWidths - From measureTileWidths().
 * @returns {number[]} Speed in px/s for each track.
 */
function computeSpeeds(tileWidths) {
    return tileWidths.map((w, i) => (w / LOOP_PERIOD_S) * (1 + i * SPEED_STEP));
}

/**
 * Initialise the scroll-reactive marquee.
 *
 * @param {NodeListOf<Element>} tracks
 * @returns {() => void} Cleanup — cancels the rAF loop.
 */
export function initMarqueeController(tracks) {
    if (!tracks.length) return () => {};

    // Disable CSS animation so JS owns the transform property exclusively.
    // Both active simultaneously = compositor receives conflicting instructions.
    tracks.forEach(track => { track.style.animation = 'none'; });

    /** @type {number[]} Tile widths in px, measured after font load. */
    let tileWidths   = [];
    /** @type {number[]} Drift speed in px/s per track. */
    let speedsPerS   = [];
    /** @type {number[]} Per-track positive drift accumulator, wrapped at tileWidth. */
    let driftOffsets = [];

    let currentScroll = 0;
    let targetScroll  = window.scrollY;
    let lastTimestamp = 0;
    let rafId         = null;

    // Capture scroll outside rAF — fires at input rate, smoothed in tick().
    window.addEventListener('scroll', () => {
        targetScroll = window.scrollY;
    }, { passive: true });

    /**
     * Core animation loop.
     * @param {DOMHighResTimeStamp} timestamp
     */
    function tick(timestamp) {
        // Cap at 100ms to absorb tab-resume spikes.
        const deltaMs = lastTimestamp
            ? Math.min(timestamp - lastTimestamp, 100)
            : 16.667;
        lastTimestamp = timestamp;

        // Smooth scroll influence (frame-rate independent).
        currentScroll += (targetScroll - currentScroll) * adaptiveLerp(SCROLL_LERP_60FPS, deltaMs);

        tracks.forEach((track, i) => {
            const direction = i % 2 === 0 ? -1 : 1;
            const speed     = 1 + (i * SPEED_STEP);
            const tileW     = tileWidths[i];

            // Advance drift at the track's computed speed.
            driftOffsets[i] += (speedsPerS[i] / 1000) * deltaMs;

            // Wrap to [0, tileWidth) — this is the loop.
            // When drift hits tileWidth and snaps to ~0, tile B occupies
            // the same screen position tile A started at. Seamless.
            if (tileW > 0) driftOffsets[i] %= tileW;

            const driftX  = driftOffsets[i] * direction;
            const scrollX = currentScroll * SCROLL_COEFF * speed * direction;

            track.style.transform = `translate3d(${driftX + scrollX}px, 0, 0)`;
        });

        rafId = requestAnimationFrame(tick);
    }

    /**
     * Measure, compute speeds, then start the loop.
     * Called from within a rAF so layout is fresh with actual font metrics.
     */
    function start() {
        tileWidths   = measureTileWidths(tracks);
        speedsPerS   = computeSpeeds(tileWidths);
        driftOffsets = new Array(tracks.length).fill(0);
        rafId        = requestAnimationFrame(tick);
    }

    // Wait for fonts, then wait one more rAF for a clean layout frame.
    if (typeof document.fonts?.ready === 'object') {
        document.fonts.ready.then(() => requestAnimationFrame(start));
    } else {
        window.addEventListener('load', () => requestAnimationFrame(start), { once: true });
    }

    return () => { if (rafId !== null) cancelAnimationFrame(rafId); };
}
