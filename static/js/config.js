/**
 * @fileoverview config.js — Single Source of Truth for all JS constants.
 *
 * WHY A SEPARATE CONFIG MODULE:
 * Magic numbers scattered through controller files are the primary source of
 * "why does this feel off" bugs that are hard to locate. Centralising them
 * here means a timing or physics change is a one-line edit with a documented
 * intent next to it.
 *
 * NAMING CONVENTION:
 * SCREAMING_SNAKE_CASE distinguishes compile-time values from runtime
 * variables at a glance, regardless of IDE support.
 *
 * Object.freeze() prevents accidental mutation. In a vanilla ES module
 * environment without a linter enforcing const-of-object, this is the
 * cheapest runtime guard.
 *
 * @module config
 */

// ---------------------------------------------------------------------------
// Timing — all values in milliseconds unless annotated
// ---------------------------------------------------------------------------

/**
 * Animation timing constants.
 * @readonly
 */
export const TIMING = Object.freeze({
    /** Stagger delay between each hero title character entering */
    CHAR_STAGGER_MS:         65,
    /** Stagger delay between each hero subtext word entering */
    WORD_STAGGER_MS:         45,
    /** Delay before hero characters begin animating (creates loader overlap) */
    HERO_CHAR_DELAY_MS:      1000,
    /** Extra pause after last char before subtext words appear */
    HERO_SUBTEXT_EXTRA_MS:   200,
    /** Minimum loader visible time — long enough to read the brand wordmark */
    LOADER_MIN_VISIBLE_MS:   900,
    /** setInterval tick rate for nav scramble effect */
    SCRAMBLE_TICK_MS:        30,
    /** Spring-back duration on magnetic button mouseleave (ms) */
    MAGNETIC_SPRING_MS:      600,
});

// ---------------------------------------------------------------------------
// Physics — dimensionless ratios unless annotated
// ---------------------------------------------------------------------------

/**
 * Physics constants for LERP and 3D interaction.
 * @readonly
 */
export const PHYSICS = Object.freeze({
    /** Multiplier applied to scroll delta to derive target skew angle */
    SKEW_SENSITIVITY:    0.035,
    /** Maximum skew in degrees, clamped symmetrically */
    SKEW_MAX_DEG:        1.5,
    /** LERP coefficient per frame (0 = frozen, 1 = instant snap) */
    SKEW_LERP:           0.05,
    /** Decay applied to targetSkew each frame — creates natural settling */
    SKEW_DECAY:          0.96,
    /** Minimum |skew| before the rAF loop is stopped to save CPU */
    SKEW_THRESHOLD:      0.003,
    /** Maximum card tilt in degrees for rotateX and rotateY */
    CARD_TILT_MAX_DEG:   4,
    /** CSS perspective for card 3D tilt (px) */
    CARD_PERSPECTIVE_PX: 900,
    /** Magnetic button pull strength (lower = subtler) */
    MAGNETIC_FACTOR:     0.25,
});

// ---------------------------------------------------------------------------
// Breakpoints — mirrors CSS to keep JS/CSS in sync without a build pipeline
// ---------------------------------------------------------------------------

/**
 * Responsive breakpoints.
 *
 * WHY NOT READ FROM CSS getComputedStyle():
 * Reading CSS custom properties requires a live element reference and
 * returns a string that must be parsed. A co-located constant is zero
 * overhead and easier to read.
 *
 * @readonly
 */
export const BREAKPOINTS = Object.freeze({
    MOBILE: 768,
});

// ---------------------------------------------------------------------------
// Strings
// ---------------------------------------------------------------------------

/**
 * Character pool for the nav scramble effect.
 * Defined here so adjusting the aesthetic requires one edit, not a search.
 * @type {string}
 */
export const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * SVG path geometry for the theme toggle icon.
 *
 * WHY STORED HERE NOT INLINE:
 * Defining these inside a function that is called on every theme change
 * allocates a new string on every call. Constants are allocated once.
 *
 * @readonly
 */
export const ICONS = Object.freeze({
    SUN: [
        '<circle cx="12" cy="12" r="5"/>',
        '<line x1="12" y1="1" x2="12" y2="3"/>',
        '<line x1="12" y1="21" x2="12" y2="23"/>',
        '<line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>',
        '<line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>',
        '<line x1="1" y1="12" x2="3" y2="12"/>',
        '<line x1="21" y1="12" x2="23" y2="12"/>',
        '<line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>',
        '<line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
    ].join(''),
    MOON:      '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    HAMBURGER: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
    CLOSE:     '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
});

// ---------------------------------------------------------------------------
// DOM cache factory
// ---------------------------------------------------------------------------

/**
 * Build and return a frozen DOM reference map.
 *
 * WHY A FUNCTION RATHER THAN A MODULE-LEVEL OBJECT:
 * A bare export object would be evaluated at import time (before the DOM
 * is ready). A factory function is called explicitly from main.js after
 * DOMContentLoaded. It also makes controllers independently testable —
 * pass in a mock DOM, no real browser required.
 *
 * @returns {Readonly<Object>} Frozen map of element references.
 */
export function buildDOM() {
    return Object.freeze({
        html:         /** @type {HTMLElement}            */ (document.documentElement),
        favicon:      /** @type {HTMLLinkElement|null}   */ (document.getElementById('dynamic-favicon')),
        logoImg:      /** @type {HTMLImageElement|null}  */ (document.getElementById('main-logo')),
        toggleBtn:    /** @type {HTMLButtonElement|null} */ (document.getElementById('dark-toggle')),
        themeIcon:    /** @type {SVGElement|null}        */ (document.getElementById('theme-icon')),
        mobileToggle: /** @type {HTMLButtonElement|null} */ (document.getElementById('mobile-toggle')),
        menuIcon:     /** @type {SVGElement|null}        */ (document.getElementById('menu-icon')),
        navWrapper:   /** @type {HTMLElement|null}       */ (document.getElementById('nav-wrapper')),
        navLinks:     /** @type {NodeListOf<Element>}    */ (document.querySelectorAll('.nav-link-item')),
        heroTitle:    /** @type {HTMLElement|null}       */ (document.getElementById('hero-title')),
        heroSubtext:  /** @type {HTMLElement|null}       */ (document.querySelector('.hero-subtext')),
        revealItems:  /** @type {NodeListOf<Element>}    */ (document.querySelectorAll('.reveal-item')),
        magneticBtns: /** @type {NodeListOf<Element>}    */ (document.querySelectorAll('.magnetic-btn')),
        nav:          /** @type {HTMLElement|null}       */ (document.querySelector('.nav')),
        sections:     /** @type {NodeListOf<Element>}    */ (document.querySelectorAll('section[id], footer[id]')),
        cardLinks:    /** @type {NodeListOf<Element>}    */ (document.querySelectorAll('.card-link')),
    });
}
