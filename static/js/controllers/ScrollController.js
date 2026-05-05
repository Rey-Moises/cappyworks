/**
 * @fileoverview ScrollController — nav shrink on scroll + active link tracking.
 *
 * ARCHITECTURAL DECISION — IntersectionObserver OVER scroll events:
 * Tracking which section is "active" via scroll position math (comparing
 * scrollY to element offsets) requires getBoundingClientRect() on every
 * scroll event, which forces synchronous layout. IntersectionObserver
 * runs off the main thread and only fires when a threshold is crossed —
 * zero layout cost at idle scroll speed.
 *
 * WHY { passive: true } ON SCROLL:
 * Passive listeners signal to the browser that the handler will never
 * call preventDefault(), enabling the compositor to scroll without
 * waiting for JS execution. Not using passive on scroll handlers is the
 * single most common cause of non-60fps scrolling.
 *
 * @module ScrollController
 */

/**
 * Initialise nav shrink on scroll and IntersectionObserver-based
 * active link highlighting.
 *
 * @param {ReturnType<import('../config.js').buildDOM>} dom
 */
export function initScrollController(dom) {
    if (!dom.nav) return;

    // ── Nav shrink ─────────────────────────────────────────────────────────
    window.addEventListener('scroll', () => {
        dom.nav.classList.toggle('is-scrolled', window.scrollY > 60);
    }, { passive: true });

    // ── Active link tracking ───────────────────────────────────────────────
    if (!dom.sections.length || !dom.navLinks.length) return;

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const id = entry.target.getAttribute('id');
            dom.navLinks.forEach(link => {
                link.classList.toggle('is-active', link.getAttribute('href') === `#${id}`);
            });
        });
    }, {
        // 0.4 threshold means a section must be 40% visible before it's
        // considered "active". Lower = triggers earlier (better for long sections).
        threshold: 0.4,
    });

    dom.sections.forEach(section => observer.observe(section));
}
