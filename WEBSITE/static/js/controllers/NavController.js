/**
 * @fileoverview NavController — mobile menu open/close state management.
 *
 * STATE MODEL:
 * The mobile nav has exactly two states: open and closed. A single boolean
 * `isActive` is the source of truth. All DOM side-effects (class toggles,
 * icon swaps, ARIA attributes, scroll lock) derive from that boolean.
 * The toggleNav() function accepts an optional `force` parameter so callers
 * can set state explicitly rather than always toggling — this prevents state
 * de-sync when auto-closing from a link click or ESC key.
 *
 * SCROLL LOCK:
 * When the full-screen menu is open, body scroll is locked via
 * document.body.style.overflow. This prevents the page content from
 * scrolling "underneath" the overlay, which is disorienting.
 *
 * ACCESSIBILITY:
 * aria-expanded reflects the current menu state on the toggle button.
 * ESC key closes the menu — expected keyboard behaviour for modal overlays.
 *
 * @module NavController
 */

import { ICONS } from '../config.js';

/**
 * Initialise mobile menu open/close behaviour.
 *
 * @param {ReturnType<import('../config.js').buildDOM>} dom
 */
export function initNavController(dom) {
    if (!dom.mobileToggle || !dom.navWrapper) return;

    /** @type {boolean} */
    let isActive = false;

    /**
     * Transition the nav to a given state.
     *
     * @param {boolean} [force] - If provided, sets state directly. If omitted, toggles.
     */
    function setNavState(force) {
        isActive = (typeof force === 'boolean') ? force : !isActive;

        dom.navWrapper.classList.toggle('active', isActive);
        dom.mobileToggle.setAttribute('aria-expanded', String(isActive));

        // Scroll lock — prevent page scroll behind the full-screen overlay.
        document.body.style.overflow = isActive ? 'hidden' : '';

        // Inject the correct icon geometry.
        if (dom.menuIcon) {
            dom.menuIcon.innerHTML = isActive ? ICONS.CLOSE : ICONS.HAMBURGER;
        }
    }

    // Toggle button — explicit stopPropagation to prevent document click
    // handlers (if added later) from immediately re-closing the menu.
    dom.mobileToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        setNavState();
    });

    // Auto-close on nav link click — user has navigated, menu is no longer needed.
    dom.navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (isActive) setNavState(false);
        });
    });

    // ESC key — standard expected behaviour for any overlay/modal pattern.
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isActive) setNavState(false);
    });
}
