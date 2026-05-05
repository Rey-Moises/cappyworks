/**
 * @fileoverview ThemeController — dark/light theme state management.
 *
 * ARCHITECTURAL DECISION — CSS OWNS PRESENTATION:
 * This controller writes exactly ONE attribute: [data-theme] on <html>.
 * All visual transitions (colours, borders, surfaces) live in CSS
 * selectors that target that attribute. JS never writes inline colour
 * values. This means the entire visual theme can be redesigned in CSS
 * without touching a single line of JS.
 *
 * PERSISTENCE HIERARCHY (evaluated once on init, in priority order):
 *   1. Explicit user choice saved in localStorage
 *   2. OS-level preference via prefers-color-scheme media query
 *   3. Light (site default)
 *
 * localStorage is wrapped in try/catch because it throws in private
 * browsing modes and cross-origin iframes. Silent degradation is
 * intentional — a broken page is worse than a theme that doesn't persist.
 *
 * @module ThemeController
 */

import { ICONS } from '../config.js';

/** @typedef {'light' | 'dark'} Theme */

// ---------------------------------------------------------------------------
// Pure utility functions (no side effects, independently testable)
// ---------------------------------------------------------------------------

/**
 * Safely read the stored theme preference.
 * @returns {Theme|null}
 */
function readStoredTheme() {
    try { return /** @type {Theme|null} */ (localStorage.getItem('theme')); } catch { return null; }
}

/**
 * Safely persist the theme preference.
 * @param {Theme} theme
 */
function persistTheme(theme) {
    try { localStorage.setItem('theme', theme); } catch {}
}

/**
 * Determine which theme should be active on first paint.
 * @returns {Theme}
 */
function resolveInitialTheme() {
    const stored = readStoredTheme();
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// ---------------------------------------------------------------------------
// Controller initialiser
// ---------------------------------------------------------------------------

/**
 * Initialise theme toggling, icon swapping, and logo/favicon swaps.
 *
 * @param {ReturnType<import('../config.js').buildDOM>} dom
 * @param {boolean} prefersReducedMotion
 */
export function initThemeController(dom, prefersReducedMotion) {
    if (!dom.toggleBtn) return;

    // Read swap paths once from data attributes — they don't change at runtime.
    const logoPaths = Object.freeze({
        light: dom.logoImg?.getAttribute('data-logo-light') ?? '',
        dark:  dom.logoImg?.getAttribute('data-logo-dark')  ?? '',
    });

    /**
     * Apply a theme to all controlled surfaces.
     *
     * @param {Theme} theme
     * @param {boolean} [animate=false] - Play the toggle-icon spin animation.
     */
    function applyTheme(theme, animate = false) {
        // Single DOM write drives all CSS transitions via [data-theme] selectors.
        dom.html.setAttribute('data-theme', theme);
        persistTheme(theme);

        // Swap logo and favicon only when valid paths exist.
        if (dom.logoImg && logoPaths[theme]) dom.logoImg.src = logoPaths[theme];
        if (dom.favicon  && logoPaths[theme]) dom.favicon.href = logoPaths[theme];

        // Inject the correct SVG geometry into the icon element.
        if (dom.themeIcon) {
            dom.themeIcon.innerHTML = theme === 'dark' ? ICONS.SUN : ICONS.MOON;

            if (animate && !prefersReducedMotion) {
                // Class-driven animation: CSS defines the keyframes, JS only
                // adds/removes the trigger class. animationend auto-cleans.
                dom.themeIcon.classList.add('is-spinning');
                dom.themeIcon.addEventListener(
                    'animationend',
                    () => dom.themeIcon.classList.remove('is-spinning'),
                    { once: true }
                );
            }
        }

        // WHY body.classList.toggle:
        // Legacy third-party embeds (e.g. Fiverr widgets) may not respond to
        // [data-theme] — body.dark-mode provides a fallback hook for those cases.
        document.body.classList.toggle('dark-mode', theme === 'dark');
    }

    dom.toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        applyTheme(dom.html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark', true);
    });

    // Apply initial theme synchronously — the pre-paint inline script in <head>
    // already set the attribute to avoid FOUC, but this call also wires the icon
    // and logo to the correct state.
    applyTheme(resolveInitialTheme());
}
