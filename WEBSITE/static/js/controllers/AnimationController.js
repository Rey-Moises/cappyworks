/**
 * @fileoverview AnimationController — all page animation orchestration.
 *
 * RESPONSIBILITIES:
 *   A. Character-split hero title reveal
 *   B. Word-split hero subtext reveal
 *   C. IntersectionObserver scroll reveals
 *   D. 3D card tilt on hover (replaced scroll parallax)
 *   E. Magnetic button follow
 *   F. Nav link text scramble
 *
 * PREFERS-REDUCED-MOTION CONTRACT:
 * Every animation in this controller is gated behind the prefersReducedMotion
 * flag. When true, content is shown immediately with no animation. This is
 * not optional — users who have set this preference have medical or
 * accessibility reasons for it.
 *
 * WHY CARD TILT REPLACED SCROLL PARALLAX:
 * Scroll parallax on card elements required calling getBoundingClientRect()
 * and writing style.transform in the same forEach loop — mixed reads and
 * writes cause forced synchronous reflow on every card per scroll tick.
 * With 3+ cards that is 3+ forced layout recalculations per rAF frame.
 * 3D mouse-follow tilt reads the rect once on mousemove (a user-driven,
 * low-frequency event) and writes once — no layout thrashing.
 *
 * @module AnimationController
 */

import { TIMING, PHYSICS, BREAKPOINTS, SCRAMBLE_CHARS } from '../config.js';

// ---------------------------------------------------------------------------
// A + B: Hero title and subtext reveal
// ---------------------------------------------------------------------------

/**
 * Split hero title into per-character <span>s and animate them in.
 * Text content is read from aria-label so a copywriter can change the
 * heading without the delay math ever needing to be updated.
 *
 * @param {HTMLElement} titleEl
 * @param {boolean} prefersReducedMotion
 * @returns {number} Total animation duration in ms (used to sequence subtext).
 */
function initHeroTitle(titleEl, prefersReducedMotion) {
    const text = titleEl.getAttribute('aria-label') || 'Cappyworks.';
    titleEl.innerHTML = '';

    if (prefersReducedMotion) {
        titleEl.textContent = text;
        return 0;
    }

    const easing = 'cubic-bezier(0.19, 1, 0.22, 1)';

    [...text].forEach((char, i) => {
        const span = document.createElement('span');
        span.textContent  = char;
        span.className    = 'char';
        span.style.transition = [
            `transform 1.1s ${easing} ${i * TIMING.CHAR_STAGGER_MS}ms`,
            `opacity 0.7s ${easing} ${i * TIMING.CHAR_STAGGER_MS}ms`,
        ].join(', ');
        titleEl.appendChild(span);
    });

    setTimeout(() => {
        titleEl.querySelectorAll('.char').forEach(span => {
            span.style.transform = 'translateY(0) rotateX(0deg)';
            span.style.opacity   = '1';
        });
    }, TIMING.HERO_CHAR_DELAY_MS);

    return text.length * TIMING.CHAR_STAGGER_MS + TIMING.HERO_CHAR_DELAY_MS;
}

/**
 * Split hero subtext into per-word <span>s and animate them in after the
 * title animation completes.
 *
 * @param {HTMLElement} subtextEl
 * @param {number} titleDuration - ms returned by initHeroTitle().
 * @param {boolean} prefersReducedMotion
 */
function initHeroSubtext(subtextEl, titleDuration, prefersReducedMotion) {
    const text = subtextEl.textContent.trim();
    subtextEl.innerHTML = '';

    if (prefersReducedMotion) {
        subtextEl.textContent = text;
        return;
    }

    const easing = 'cubic-bezier(0.19, 1, 0.22, 1)';

    text.split(' ').forEach((word, i) => {
        const span = document.createElement('span');
        span.textContent  = word + ' '; // non-breaking space preserves word spacing
        span.className    = 'word';
        span.style.transition = [
            `opacity 0.6s ${easing} ${i * TIMING.WORD_STAGGER_MS}ms`,
            `transform 0.9s ${easing} ${i * TIMING.WORD_STAGGER_MS}ms`,
        ].join(', ');
        subtextEl.appendChild(span);
    });

    setTimeout(() => {
        subtextEl.querySelectorAll('.word').forEach(w => {
            w.style.opacity   = '1';
            w.style.transform = 'translateY(0)';
        });
    }, titleDuration + TIMING.HERO_SUBTEXT_EXTRA_MS);
}

// ---------------------------------------------------------------------------
// C: Scroll reveals via IntersectionObserver
// ---------------------------------------------------------------------------

/**
 * Observe all .reveal-item elements and add .is-visible when they enter
 * the viewport. Unobserves after the first intersection — the reveal
 * plays once and the observer is discarded to free memory.
 *
 * @param {NodeListOf<Element>} revealItems
 * @param {boolean} prefersReducedMotion
 */
function initScrollReveals(revealItems, prefersReducedMotion) {
    if (!revealItems.length) return;

    if (prefersReducedMotion) {
        revealItems.forEach(el => el.classList.add('is-visible'));
        return;
    }

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            obs.unobserve(entry.target);
        });
    }, { threshold: 0.15 });

    revealItems.forEach(el => observer.observe(el));
}

// ---------------------------------------------------------------------------
// D: 3D card tilt (mouse-follow, desktop only)
// ---------------------------------------------------------------------------

/**
 * Apply a 3D perspective tilt to each card on mousemove.
 *
 * WHY getBoundingClientRect() ON EVERY MOUSEMOVE:
 * The card's position can change (e.g. window resize, layout shift).
 * Caching the rect outside the handler would give stale coordinates.
 * mousemove is user-driven and fires at ~60hz max, so the reflow cost
 * is acceptable here (unlike scroll, which fires continuously).
 *
 * @param {NodeListOf<Element>} cardLinks
 * @param {boolean} prefersReducedMotion
 */
function initCardTilt(cardLinks, prefersReducedMotion) {
    if (!cardLinks.length || window.innerWidth <= BREAKPOINTS.MOBILE || prefersReducedMotion) return;

    const TRACKING_TRANSITION  = `transform 0.08s linear, box-shadow 0.3s ease, border-color 0.25s ease`;
    const SPRINGBACK_TRANSITION = `transform 0.5s cubic-bezier(0.34, 1.4, 0.64, 1), box-shadow 0.3s ease, border-color 0.25s ease`;
    const MAX = PHYSICS.CARD_TILT_MAX_DEG;
    const P   = PHYSICS.CARD_PERSPECTIVE_PX;

    cardLinks.forEach(link => {
        const card = link.querySelector('.card');
        if (!card) return;

        link.addEventListener('mousemove', (e) => {
            const rect    = card.getBoundingClientRect();
            const x       = e.clientX - rect.left;
            const y       = e.clientY - rect.top;
            const rotateX = ((y - rect.height / 2) / (rect.height / 2)) * -MAX;
            const rotateY = ((x - rect.width  / 2) / (rect.width  / 2)) *  MAX;

            card.style.transition = TRACKING_TRANSITION;
            card.style.transform  = `perspective(${P}px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-5px) translateZ(0)`;
        });

        link.addEventListener('mouseleave', () => {
            card.style.transition = SPRINGBACK_TRANSITION;
            card.style.transform  = `perspective(${P}px) rotateX(0deg) rotateY(0deg) translateY(0) translateZ(0)`;
        });
    });
}

// ---------------------------------------------------------------------------
// E: Magnetic buttons
// ---------------------------------------------------------------------------

/**
 * Apply a subtle magnetic pull toward the cursor on hover.
 *
 * WHY INLINE style.transition ON MOUSELEAVE:
 * The spring-back easing is only desirable on leave — if set in CSS it
 * would also apply while tracking the cursor, creating a noticeable lag
 * behind the mouse. Setting it inline on mouseleave, then clearing it
 * after the animation completes, gives a tracking→spring feel.
 *
 * @param {NodeListOf<Element>} buttons
 * @param {boolean} prefersReducedMotion
 */
function initMagneticButtons(buttons, prefersReducedMotion) {
    if (!buttons.length || prefersReducedMotion) return;

    buttons.forEach(btn => {
        btn.addEventListener('mousemove', (e) => {
            if (window.innerWidth <= BREAKPOINTS.MOBILE) return;
            const pos = btn.getBoundingClientRect();
            const x   = ((e.clientX - pos.left  - pos.width  / 2) * PHYSICS.MAGNETIC_FACTOR).toFixed(2);
            const y   = ((e.clientY - pos.top   - pos.height / 2) * PHYSICS.MAGNETIC_FACTOR).toFixed(2);
            btn.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        });

        btn.addEventListener('mouseleave', () => {
            // WHY NO MOBILE GUARD HERE:
            // The mousemove handler skips applying a transform on narrow
            // viewports, but mouseleave must always reset — without this,
            // a transform applied at a wider viewport (before the window
            // was resized or devtools were opened) would be permanently
            // stuck on the element with no mechanism to clear it.
            btn.style.transition = `transform ${TIMING.MAGNETIC_SPRING_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1)`;
            btn.style.transform  = 'translate3d(0, 0, 0)';
            setTimeout(() => { btn.style.transition = ''; }, TIMING.MAGNETIC_SPRING_MS);
        });
    });
}

// ---------------------------------------------------------------------------
// F: Nav link text scramble
// ---------------------------------------------------------------------------

/**
 * On hover, scramble a nav link's text then resolve back to the original.
 *
 * The interval ref is stored per-link so rapid mouseenter/mouseleave
 * events don't stack up multiple simultaneous intervals (interval leak).
 * On mouseleave, the interval is cleared and text is reset immediately
 * so the nav never gets stuck mid-scramble.
 *
 * @param {NodeListOf<Element>} navLinks
 * @param {boolean} prefersReducedMotion
 */
function initNavScramble(navLinks, prefersReducedMotion) {
    if (prefersReducedMotion) return;

    navLinks.forEach(link => {
        const original = link.textContent;
        /** @type {ReturnType<typeof setInterval>|null} */
        let interval = null;

        link.addEventListener('mouseenter', () => {
            if (window.innerWidth <= BREAKPOINTS.MOBILE) return;

            clearInterval(interval);
            let progress = 0;

            interval = setInterval(() => {
                link.textContent = original.split('').map((_, i) =>
                    i < progress
                        ? original[i]
                        : SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]
                ).join('');

                progress += 0.5;

                if (progress >= original.length) {
                    link.textContent = original;
                    clearInterval(interval);
                    interval = null;
                }
            }, TIMING.SCRAMBLE_TICK_MS);
        });

        link.addEventListener('mouseleave', () => {
            if (interval !== null) {
                clearInterval(interval);
                interval = null;
                link.textContent = original;
            }
        });
    });
}

// ---------------------------------------------------------------------------
// Public initialiser
// ---------------------------------------------------------------------------

/**
 * Initialise all animation controllers.
 *
 * @param {ReturnType<import('../config.js').buildDOM>} dom
 * @param {boolean} prefersReducedMotion
 */
export function initAnimationController(dom, prefersReducedMotion) {
    if (dom.heroTitle) {
        const titleDuration = initHeroTitle(dom.heroTitle, prefersReducedMotion);
        if (dom.heroSubtext) {
            initHeroSubtext(dom.heroSubtext, titleDuration, prefersReducedMotion);
        }
    }

    initScrollReveals(dom.revealItems,   prefersReducedMotion);
    initCardTilt(dom.cardLinks,          prefersReducedMotion);
    initMagneticButtons(dom.magneticBtns, prefersReducedMotion);
    initNavScramble(dom.navLinks,         prefersReducedMotion);
}
