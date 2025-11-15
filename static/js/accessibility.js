/**
 * Accessibility Features for Elliptic Curve Calculator
 * - Keyboard shortcuts
 * - Focus management
 * - ARIA live regions
 * - Screen reader support
 */

// =================== KEYBOARD SHORTCUTS =================== //

const keyboardShortcuts = {
    // Global shortcuts
    'alt+m': () => toggleMenu(),
    'alt+h': () => showKeyboardHelp(),
    'alt+t': () => toggleTheme(),
    'alt+/': () => showKeyboardHelp(),

    // Navigation
    'alt+1': () => selectCurveType('fpTab', 'Curve over Fp'),
    'alt+2': () => selectCurveType('realTab', 'Curve over ℝ'),
    'alt+3': () => selectEncryptionPane('encryptInitPane'),
    'alt+4': () => selectDemonstrationPane('dhDemoPane'),

    // Operations
    'alt+f': () => document.getElementById('findAllPointsBtn')?.click(),
    'alt+a': () => switchSubtab('fp', 'fpAddPane'),
    'alt+s': () => switchSubtab('fp', 'fpMulPane'),

    // Tutorials
    'alt+i': () => startTutorial('initialization'),
    'alt+p': () => startTutorial('point_addition'),
    'alt+k': () => startTutorial('scalar_multiplication'),

    // Utilities
    'alt+c': () => copyCurveParameters(),
    'alt+d': () => downloadPointList(),
    'alt+l': () => showPresetsLibrary(),

    // Escape
    'escape': () => closeAllModals(),
};

// Track modifier keys
const modifierKeys = {
    shift: false,
    ctrl: false,
    alt: false,
    meta: false
};

// Initialize keyboard navigation
function initKeyboardNavigation() {
    document.addEventListener('keydown', handleKeyboardShortcut);
    document.addEventListener('keyup', handleModifierKeyUp);

    // Add visible focus indicators
    addFocusIndicators();

    // Initialize skip links
    initSkipLinks();

    // Initialize focus trap for modals
    initModalFocusTraps();

    announceToScreenReader('Keyboard shortcuts enabled. Press Alt+H for help.');
}

function handleKeyboardShortcut(e) {
    // Update modifier key states
    modifierKeys.shift = e.shiftKey;
    modifierKeys.ctrl = e.ctrlKey;
    modifierKeys.alt = e.altKey;
    modifierKeys.meta = e.metaKey;

    // Build shortcut key
    const parts = [];
    if (e.ctrlKey || e.metaKey) parts.push('ctrl');
    if (e.altKey) parts.push('alt');
    if (e.shiftKey) parts.push('shift');
    parts.push(e.key.toLowerCase());

    const shortcut = parts.join('+');

    // Execute shortcut if found
    if (keyboardShortcuts[shortcut]) {
        e.preventDefault();
        keyboardShortcuts[shortcut]();
        announceShortcutAction(shortcut);
    }

    // Handle arrow key navigation in tutorials
    if (tutorialState.active) {
        handleTutorialNavigation(e);
    }
}

function handleModifierKeyUp(e) {
    modifierKeys.shift = e.shiftKey;
    modifierKeys.ctrl = e.ctrlKey;
    modifierKeys.alt = e.altKey;
    modifierKeys.meta = e.metaKey;
}

function handleTutorialNavigation(e) {
    if (e.key === 'ArrowRight' && !e.target.matches('input, textarea')) {
        e.preventDefault();
        nextTutorialStep();
    } else if (e.key === 'ArrowLeft' && !e.target.matches('input, textarea')) {
        e.preventDefault();
        prevTutorialStep();
    }
}

// =================== FOCUS MANAGEMENT =================== //

function addFocusIndicators() {
    // Add custom focus class on keyboard focus
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            document.body.classList.add('keyboard-nav');
        }
    });

    document.addEventListener('mousedown', () => {
        document.body.classList.remove('keyboard-nav');
    });
}

function initSkipLinks() {
    const skipLink = document.createElement('a');
    skipLink.href = '#main-content';
    skipLink.className = 'skip-link';
    skipLink.textContent = 'Skip to main content';
    skipLink.setAttribute('aria-label', 'Skip navigation and go to main content');

    document.body.insertBefore(skipLink, document.body.firstChild);
}

// Focus trap for modals
const focusTrap = {
    active: false,
    element: null,
    focusableElements: null,
    firstFocusable: null,
    lastFocusable: null
};

function initModalFocusTraps() {
    // Observe modal openings
    const modalObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'class') {
                const modal = mutation.target;
                if (modal.classList.contains('active')) {
                    activateFocusTrap(modal);
                } else {
                    deactivateFocusTrap();
                }
            }
        });
    });

    // Observe all modals
    document.querySelectorAll('.about-modal, .auth-overlay').forEach(modal => {
        modalObserver.observe(modal, { attributes: true });
    });
}

function activateFocusTrap(element) {
    focusTrap.active = true;
    focusTrap.element = element;

    // Get all focusable elements
    const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    focusTrap.focusableElements = element.querySelectorAll(focusableSelector);
    focusTrap.firstFocusable = focusTrap.focusableElements[0];
    focusTrap.lastFocusable = focusTrap.focusableElements[focusTrap.focusableElements.length - 1];

    // Focus first element
    setTimeout(() => focusTrap.firstFocusable?.focus(), 100);

    // Add tab trap listener
    element.addEventListener('keydown', handleFocusTrap);
}

function deactivateFocusTrap() {
    if (focusTrap.element) {
        focusTrap.element.removeEventListener('keydown', handleFocusTrap);
    }
    focusTrap.active = false;
    focusTrap.element = null;
}

function handleFocusTrap(e) {
    if (!focusTrap.active || e.key !== 'Tab') return;

    if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === focusTrap.firstFocusable) {
            e.preventDefault();
            focusTrap.lastFocusable?.focus();
        }
    } else {
        // Tab
        if (document.activeElement === focusTrap.lastFocusable) {
            e.preventDefault();
            focusTrap.firstFocusable?.focus();
        }
    }
}

// =================== ARIA LIVE REGIONS =================== //

let ariaLiveRegion = null;

function initAriaLiveRegions() {
    // Create live region for announcements
    ariaLiveRegion = document.createElement('div');
    ariaLiveRegion.setAttribute('role', 'status');
    ariaLiveRegion.setAttribute('aria-live', 'polite');
    ariaLiveRegion.setAttribute('aria-atomic', 'true');
    ariaLiveRegion.className = 'sr-only';
    document.body.appendChild(ariaLiveRegion);

    // Create alert region for important messages
    const alertRegion = document.createElement('div');
    alertRegion.setAttribute('role', 'alert');
    alertRegion.setAttribute('aria-live', 'assertive');
    alertRegion.setAttribute('aria-atomic', 'true');
    alertRegion.className = 'sr-only';
    alertRegion.id = 'aria-alert-region';
    document.body.appendChild(alertRegion);
}

function announceToScreenReader(message, assertive = false) {
    const region = assertive ?
        document.getElementById('aria-alert-region') :
        ariaLiveRegion;

    if (!region) return;

    // Clear and announce
    region.textContent = '';
    setTimeout(() => {
        region.textContent = message;
    }, 100);
}

function announceShortcutAction(shortcut) {
    const descriptions = {
        'alt+m': 'Menu toggled',
        'alt+h': 'Keyboard help opened',
        'alt+t': 'Theme switched',
        'alt+1': 'Switched to Curve over Fp',
        'alt+2': 'Switched to Curve over ℝ',
        'alt+c': 'Curve parameters copied',
        'escape': 'Modals closed'
    };

    const message = descriptions[shortcut] || 'Action performed';
    announceToScreenReader(message);
}

// =================== CANVAS ACCESSIBILITY =================== //

function makeCanvasAccessible(canvasId, description) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    // Add ARIA attributes
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', description);
    canvas.setAttribute('tabindex', '0');

    // Add keyboard navigation for canvas
    canvas.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
            });
            canvas.dispatchEvent(clickEvent);
            announceToScreenReader('Canvas activated');
        }
    });

    // Announce when canvas updates
    const observer = new MutationObserver(() => {
        announceToScreenReader(`${description} updated`);
    });

    observer.observe(canvas, {
        attributes: true,
        attributeFilter: ['width', 'height']
    });
}

// =================== KEYBOARD HELP MODAL =================== //

function showKeyboardHelp() {
    const modal = document.getElementById('aboutModal');
    const modalBody = modal.querySelector('.about-modal-body');

    const shortcuts = [
        { category: 'Navigation', items: [
            { keys: 'Alt + M', action: 'Toggle menu' },
            { keys: 'Alt + 1', action: 'Switch to Curve over Fp' },
            { keys: 'Alt + 2', action: 'Switch to Curve over ℝ' },
            { keys: 'Alt + 3', action: 'Switch to Encryption' },
            { keys: 'Alt + 4', action: 'Switch to Demonstrations' },
        ]},
        { category: 'Operations', items: [
            { keys: 'Alt + F', action: 'Find all points' },
            { keys: 'Alt + A', action: 'Point addition' },
            { keys: 'Alt + S', action: 'Scalar multiplication' },
        ]},
        { category: 'Tutorials', items: [
            { keys: 'Alt + I', action: 'Initialization tutorial' },
            { keys: 'Alt + P', action: 'Point addition tutorial' },
            { keys: 'Alt + K', action: 'Scalar multiplication tutorial' },
            { keys: '← →', action: 'Navigate tutorial steps' },
        ]},
        { category: 'Utilities', items: [
            { keys: 'Alt + C', action: 'Copy curve parameters' },
            { keys: 'Alt + D', action: 'Download point list' },
            { keys: 'Alt + L', action: 'Open presets library' },
            { keys: 'Alt + T', action: 'Toggle dark/light theme' },
        ]},
        { category: 'General', items: [
            { keys: 'Alt + H or Alt + /', action: 'Show this help' },
            { keys: 'Esc', action: 'Close modals/dialogs' },
            { keys: 'Tab', action: 'Navigate between elements' },
            { keys: 'Shift + Tab', action: 'Navigate backwards' },
        ]}
    ];

    let html = `
        <div class="keyboard-help">
            <h2><i class="fa-solid fa-keyboard"></i> Keyboard Shortcuts</h2>
            <p style="color: #888; margin-bottom: 20px;">Use these shortcuts to navigate the calculator quickly</p>
    `;

    shortcuts.forEach(category => {
        html += `
            <div class="shortcut-category">
                <h3>${category.category}</h3>
                <table class="shortcuts-table">
        `;

        category.items.forEach(item => {
            html += `
                <tr>
                    <td class="shortcut-keys"><kbd>${item.keys.replace(/\+/g, '</kbd> + <kbd>')}</kbd></td>
                    <td class="shortcut-description">${item.action}</td>
                </tr>
            `;
        });

        html += `
                </table>
            </div>
        `;
    });

    html += `
            <div class="help-note">
                <i class="fa-solid fa-info-circle"></i>
                <strong>Tip:</strong> Most interactive elements can be activated with <kbd>Enter</kbd> or <kbd>Space</kbd> when focused.
            </div>
        </div>
    `;

    modalBody.innerHTML = html;
    modal.classList.add('active');
    announceToScreenReader('Keyboard shortcuts help opened');
}

function closeAllModals() {
    document.querySelectorAll('.about-modal.active, .auth-overlay.visible').forEach(modal => {
        modal.classList.remove('active', 'visible');
    });
    announceToScreenReader('All modals closed');
}

// =================== SCREEN READER ENHANCEMENTS =================== //

function enhanceForScreenReaders() {
    // Add labels to unlabeled form elements
    document.querySelectorAll('input:not([aria-label]):not([id])').forEach((input, i) => {
        input.setAttribute('aria-label', input.placeholder || `Input field ${i + 1}`);
    });

    // Add aria-labels to buttons without text
    document.querySelectorAll('button:not([aria-label])').forEach(button => {
        const icon = button.querySelector('i');
        if (icon && !button.textContent.trim()) {
            const iconClass = icon.className;
            button.setAttribute('aria-label', `Button with ${iconClass}`);
        }
    });

    // Make canvases accessible
    makeCanvasAccessible('additionCanvas', 'Point addition visualization showing curve points and operations');
    makeCanvasAccessible('multiplicationCanvas', 'Scalar multiplication visualization');
    makeCanvasAccessible('realAdditionCanvas', 'Real curve addition visualization');
    makeCanvasAccessible('realMultiplicationCanvas', 'Real curve scalar multiplication');

    // Add progress announcements
    const progressObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.target.classList.contains('progress-fill')) {
                const progress = mutation.target.style.width;
                announceToScreenReader(`Progress: ${progress}`);
            }
        });
    });

    document.querySelectorAll('.progress-fill').forEach(el => {
        progressObserver.observe(el, { attributes: true, attributeFilter: ['style'] });
    });
}

// =================== HIGH CONTRAST MODE =================== //

function initHighContrastMode() {
    // Detect system preference
    const prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches;

    if (prefersHighContrast) {
        document.body.classList.add('high-contrast');
        announceToScreenReader('High contrast mode enabled');
    }

    // Listen for changes
    window.matchMedia('(prefers-contrast: high)').addEventListener('change', (e) => {
        if (e.matches) {
            document.body.classList.add('high-contrast');
            announceToScreenReader('High contrast mode enabled');
        } else {
            document.body.classList.remove('high-contrast');
            announceToScreenReader('High contrast mode disabled');
        }
    });
}

// =================== REDUCED MOTION =================== //

function handleReducedMotion() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
        document.body.classList.add('reduced-motion');
        // Disable animations
        document.querySelectorAll('.anim-controls').forEach(control => {
            const playBtn = control.querySelector('#playBtn, #dhPlayBtn');
            if (playBtn) {
                playBtn.disabled = true;
                playBtn.title = 'Animations disabled (reduced motion preference)';
            }
        });
        announceToScreenReader('Animations reduced for accessibility');
    }
}

// =================== INITIALIZATION =================== //

function initAccessibility() {
    initKeyboardNavigation();
    initAriaLiveRegions();
    enhanceForScreenReaders();
    initHighContrastMode();
    handleReducedMotion();

    console.log('✅ Accessibility features initialized');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAccessibility);
} else {
    initAccessibility();
}
