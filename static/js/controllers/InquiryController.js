/**
 * @fileoverview InquiryController — Studio project inquiry modal.
 *
 * RESPONSIBILITIES:
 *   1. Intercept clicks on .studio-inquiry-trigger elements.
 *   2. Open the modal and pre-select the chip matching data-inquiry-tag.
 *   3. Manage chip multi-select state.
 *   4. Compute and display a live budget estimate as chips are toggled.
 *   5. Validate required fields and show inline errors.
 *   6. Show a success confirmation, then auto-close.
 *   7. Manage focus trap and ESC-close for accessibility.
 *
 * NOTE ON SUBMISSION:
 * The form currently shows a success state client-side and does not POST
 * to a backend endpoint. To wire up a real handler, replace the success
 * block in _handleSubmit() with a fetch() call.
 *
 * @module InquiryController
 */

// ---------------------------------------------------------------------------
// Service catalogue — budget ranges in USD per service category.
// Keys must exactly match the chip labels defined in CHIP_LABELS below.
// ---------------------------------------------------------------------------

/** @type {Readonly<Record<string, {min: number, max: number}>>} */
const BUDGET = Object.freeze({
    'Branding':         { min: 500,  max: 2000 },
    'Web Design':       { min: 800,  max: 3500 },
    'Packaging':        { min: 300,  max: 1200 },
    'Graphic Design':   { min: 200,  max: 1000 },
    'UI/UX':            { min: 1000, max: 4000 },
    'Video Production': { min: 500,  max: 2500 },
    'Experiential':     { min: 2000, max: 8000 },
    'Brand Assets':     { min: 400,  max: 1500 },
    'Decks':            { min: 200,  max: 800  },
    'Other':            { min: 300,  max: 1200 },
});

/** Ordered list of chip labels — order determines render order. */
const CHIP_LABELS = Object.keys(BUDGET);

/** Delay (ms) before auto-closing after a successful submission. */
const SUCCESS_CLOSE_DELAY_MS = 2600;

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Format an integer as a USD string without cents.
 * @param {number} n
 * @returns {string}
 */
function usd(n) {
    return '$' + n.toLocaleString('en-US');
}

/**
 * Compute the combined min/max budget for the current selection.
 * Returns null if nothing is selected.
 *
 * @param {Set<string>} selected
 * @returns {{ min: number, max: number } | null}
 */
function computeBudget(selected) {
    if (!selected.size) return null;
    let min = 0, max = 0;
    for (const label of selected) {
        const range = BUDGET[label];
        if (range) { min += range.min; max += range.max; }
    }
    return { min, max };
}

/**
 * Basic e-mail format check.
 * @param {string} value
 * @returns {boolean}
 */
function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

// ---------------------------------------------------------------------------
// DOM-mutating helpers (kept as small, single-purpose functions)
// ---------------------------------------------------------------------------

/**
 * Build chip <button> elements and append them to the container.
 *
 * WHY JAVASCRIPT NOT STATIC HTML:
 * The chip list is driven by the BUDGET map — a single source of truth.
 * Duplicating the list in HTML would mean two places to update when a
 * new service category is added.
 *
 * @param {HTMLElement} container
 * @returns {Map<string, HTMLButtonElement>} label → button reference
 */
function buildChips(container) {
    container.innerHTML = '';
    const map = new Map();

    for (const label of CHIP_LABELS) {
        const btn = document.createElement('button');
        btn.type         = 'button';
        btn.className    = 'inq-chip';
        btn.textContent  = label;
        btn.dataset.chip = label;
        btn.setAttribute('aria-pressed', 'false');
        container.appendChild(btn);
        map.set(label, btn);
    }

    return map;
}

/**
 * Re-render the budget display element to reflect the current selection.
 *
 * @param {HTMLElement} el
 * @param {Set<string>} selected
 */
function renderBudget(el, selected) {
    const budget = computeBudget(selected);
    if (!budget) {
        el.innerHTML = '';
        return;
    }
    el.innerHTML = `
        <p class="inq-budget-label">Dynamic estimate (based on selection)</p>
        <p class="inq-budget-range">${usd(budget.min)} &ndash; ${usd(budget.max)}</p>
    `;
}

/**
 * Collect all focusable elements inside a container for focus-trap management.
 * @param {HTMLElement} container
 * @returns {HTMLElement[]}
 */
function focusable(container) {
    return Array.from(container.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ));
}

// ---------------------------------------------------------------------------
// Public initialiser
// ---------------------------------------------------------------------------

/**
 * Initialise the Studio inquiry modal.
 * Safe to call on pages that don't have the modal markup — all element
 * lookups are guarded before any listeners are attached.
 *
 * @returns {void}
 */
export function initInquiryController() {
    // ── Element lookups ────────────────────────────────────────────────────
    const overlay   = document.getElementById('inquiry-modal');
    const modal     = overlay?.querySelector('.inq-modal');
    const closeBtn  = document.getElementById('inquiry-close');
    const form      = document.getElementById('inquiry-form');
    const chipsEl   = document.getElementById('inquiry-chips');
    const budgetEl  = document.getElementById('inquiry-budget');
    const successEl = document.getElementById('inquiry-success');
    const triggers  = document.querySelectorAll('.studio-inquiry-trigger');

    // Bail gracefully if the modal isn't in the DOM.
    if (!overlay || !modal || !form || !chipsEl) return;

    // ── Build chips ────────────────────────────────────────────────────────
    const chipMap = buildChips(chipsEl);

    /** @type {Set<string>} Currently selected service labels. */
    const selected = new Set();

    // ── Chip toggle ────────────────────────────────────────────────────────
    chipsEl.addEventListener('click', e => {
        const btn = /** @type {HTMLElement} */ (e.target).closest('.inq-chip');
        if (!btn) return;

        const label = btn.dataset.chip;
        if (selected.has(label)) {
            selected.delete(label);
            btn.classList.remove('is-active');
            btn.setAttribute('aria-pressed', 'false');
        } else {
            selected.add(label);
            btn.classList.add('is-active');
            btn.setAttribute('aria-pressed', 'true');
        }
        renderBudget(budgetEl, selected);
    });

    // ── Open / close ───────────────────────────────────────────────────────

    /**
     * Open the modal, reset its state, and pre-select one chip.
     * @param {string|null} preselectedTag
     */
    function openModal(preselectedTag) {
        // Reset form fields and error states.
        form.reset();
        form.style.display = '';
        form.querySelectorAll('.inq-field.has-error').forEach(f => f.classList.remove('has-error'));

        // Reset success panel.
        successEl.classList.remove('is-visible');
        successEl.setAttribute('aria-hidden', 'true');

        // Reset all chips.
        selected.clear();
        chipMap.forEach((btn, label) => {
            btn.classList.remove('is-active');
            btn.setAttribute('aria-pressed', 'false');
        });

        // Pre-select the tag that matches the clicked card.
        if (preselectedTag && chipMap.has(preselectedTag)) {
            selected.add(preselectedTag);
            const btn = chipMap.get(preselectedTag);
            btn.classList.add('is-active');
            btn.setAttribute('aria-pressed', 'true');
        }

        renderBudget(budgetEl, selected);

        // Open overlay.
        overlay.classList.add('is-open');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        // Move focus into the modal (close button is the first focusable target).
        requestAnimationFrame(() => closeBtn?.focus());
    }

    function closeModal() {
        overlay.classList.remove('is-open');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    // ── Trigger: Studio card click ─────────────────────────────────────────
    triggers.forEach(trigger => {
        trigger.addEventListener('click', e => {
            e.preventDefault();
            openModal(trigger.dataset.inquiryTag ?? null);
        });
    });

    // ── Close: button, backdrop, ESC ──────────────────────────────────────
    closeBtn?.addEventListener('click', closeModal);

    overlay.addEventListener('click', e => {
        if (e.target === overlay) closeModal();
    });

    document.addEventListener('keydown', e => {
        if (!overlay.classList.contains('is-open')) return;

        if (e.key === 'Escape') {
            closeModal();
            return;
        }

        // Focus trap — keeps Tab inside the modal.
        if (e.key === 'Tab') {
            const items = focusable(modal);
            if (!items.length) return;
            const first = items[0];
            const last  = items[items.length - 1];
            if (e.shiftKey) {
                if (document.activeElement === first) { e.preventDefault(); last.focus(); }
            } else {
                if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
            }
        }
    });

    // ── Form submission ────────────────────────────────────────────────────

    /**
     * Validate the form, POST to /api/inquiry, then on success show the
     * confirmation panel and auto-close.
     *
     * WHY ASYNC:
     * fetch() returns a Promise. Making the handler async lets us await it
     * with linear try/catch flow instead of chained .then()/.catch().
     * preventDefault() is called synchronously before any await so the
     * browser's default submit is always blocked regardless of async state.
     *
     * @param {SubmitEvent} e
     */
    async function handleSubmit(e) {
        e.preventDefault();

        const nameEl  = /** @type {HTMLInputElement}  */ (document.getElementById('inq-name'));
        const emailEl = /** @type {HTMLInputElement}  */ (document.getElementById('inq-email'));
        let valid = true;

        // Name — required, any non-empty string.
        const nameField = nameEl.closest('.inq-field');
        if (!nameEl.value.trim()) {
            nameField.classList.add('has-error');
            valid = false;
        } else {
            nameField.classList.remove('has-error');
        }

        // Email — required, must pass basic format check.
        const emailField = emailEl.closest('.inq-field');
        if (!emailEl.value.trim() || !isValidEmail(emailEl.value)) {
            emailField.classList.add('has-error');
            valid = false;
        } else {
            emailField.classList.remove('has-error');
        }

        if (!valid) return;

        // ── Loading state ─────────────────────────────────────────────────
        const submitBtn  = document.getElementById('inquiry-submit');
        const labelEl    = submitBtn?.querySelector('.inq-chevron-label');
        const origLabel  = labelEl?.textContent ?? 'Submit Studio Inquiry';

        if (labelEl)    labelEl.textContent = 'Sending…';
        if (submitBtn)  submitBtn.disabled  = true;

        // Remove any previous send-error message.
        form.querySelector('.inq-send-error')?.remove();

        // ── POST to backend ───────────────────────────────────────────────
        try {
            const payload = {
                name:        nameEl.value.trim(),
                email:       emailEl.value.trim(),
                message:     document.getElementById('inq-message').value.trim(),
                services:    [...selected],
                budget_fine: document.getElementById('inq-budget-fine').value.trim(),
            };

            const res = await fetch('/api/inquiry', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(payload),
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || 'Submission failed. Please try again.');
            }

            // ── Success ───────────────────────────────────────────────────
            form.style.display = 'none';
            successEl.classList.add('is-visible');
            successEl.setAttribute('aria-hidden', 'false');
            setTimeout(closeModal, SUCCESS_CLOSE_DELAY_MS);

        } catch (err) {
            // ── Error — restore button and show inline message ────────────
            if (labelEl)   labelEl.textContent = origLabel;
            if (submitBtn) submitBtn.disabled  = false;

            const errEl       = document.createElement('p');
            errEl.className   = 'inq-send-error';
            errEl.textContent = err.message || 'Something went wrong. Please try again.';
            submitBtn?.closest('.inq-submit-area')?.appendChild(errEl);
        }
    }

    form.addEventListener('submit', handleSubmit);

    // Clear individual field errors as the user corrects their input.
    form.addEventListener('input', e => {
        const field = /** @type {HTMLElement} */ (e.target).closest('.inq-field');
        if (field?.classList.contains('has-error')) field.classList.remove('has-error');
    });
}
