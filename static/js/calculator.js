            // Ensure overlay is shown immediately if forced, before any other JS runs
            (function(){
                try {
                    var force = (localStorage.getItem('force_login') === '1') || (new URLSearchParams(location.search).get('login') === '1');
                    if (force) {
                        var ov = document.getElementById('authOverlay');
                        if (ov) ov.classList.add('visible');
                    }
                } catch(_) {}
            })();

        // =================== ANIMATION EASING FUNCTIONS =================== //

        const Easing = {
            // Smooth ease in-out (cubic)
            easeInOutCubic: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,

            // Smooth ease out (cubic)
            easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),

            // Smooth ease in (cubic)
            easeInCubic: (t) => t * t * t,

            // Elastic bounce effect
            easeOutElastic: (t) => {
                const c4 = (2 * Math.PI) / 3;
                return t === 0 ? 0 : t === 1 ? 1 :
                    Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
            },

            // Bounce effect
            easeOutBounce: (t) => {
                const n1 = 7.5625;
                const d1 = 2.75;
                if (t < 1 / d1) {
                    return n1 * t * t;
                } else if (t < 2 / d1) {
                    return n1 * (t -= 1.5 / d1) * t + 0.75;
                } else if (t < 2.5 / d1) {
                    return n1 * (t -= 2.25 / d1) * t + 0.9375;
                } else {
                    return n1 * (t -= 2.625 / d1) * t + 0.984375;
                }
            },

            // Back easing (overshoot)
            easeOutBack: (t) => {
                const c1 = 1.70158;
                const c3 = c1 + 1;
                return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
            },

            // Smooth sine easing
            easeInOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,

            // Exponential easing
            easeOutExpo: (t) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),

            // Circular easing
            easeOutCirc: (t) => Math.sqrt(1 - Math.pow(t - 1, 2))
        };

        // =================== DARK MODE THEME TOGGLE =================== //

        // Initialize theme from localStorage or system preference
        (function initTheme() {
            const savedTheme = localStorage.getItem('theme');
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const theme = savedTheme || (prefersDark ? 'dark' : 'light');

            if (theme === 'dark') {
                document.documentElement.setAttribute('data-theme', 'dark');
                updateThemeIcon('dark');
            } else {
                updateThemeIcon('light');
            }
        })();

        function toggleTheme() {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateThemeIcon(newTheme);

            // Redraw canvases after theme change to update colors
            setTimeout(() => {
                redrawAllCurves();
                redrawRealCanvases();
            }, 100);
        }

        function updateThemeIcon(theme) {
            document.querySelectorAll('.theme-icon i, .theme-icon').forEach(el => {
                const icon = el.tagName === 'I' ? el : el.querySelector('i');
                if (icon) {
                    icon.className = `fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`;
                }
            });
        }

        // Listen to system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem('theme')) {
                const newTheme = e.matches ? 'dark' : 'light';
                document.documentElement.setAttribute('data-theme', newTheme);
                updateThemeIcon(newTheme);
                redrawAllCurves();
                redrawRealCanvases();
            }
        });

        // =================== PRESET CURVES =================== //

        const curvePresets = {
            secp256k1: {
                a: 0,
                b: 7,
                p: 23,
                description: 'secp256k1-like: y² = x³ + 7 (mod 23). Bitcoin uses same equation with p = 2²⁵⁶ - 2³² - 977.'
            },
            p256: {
                a: -3,
                b: 1,
                p: 97,
                description: 'P-256-like: y² = x³ - 3x + 1 (mod 97). NIST uses same form with 256-bit prime.'
            },
            e23: {
                a: 1,
                b: 1,
                p: 23,
                description: 'E₂₃(1,1) - Tiny curve for quick demonstrations. Fast computation.'
            },
            e31: {
                a: 2,
                b: 3,
                p: 31,
                description: 'E₃₁(2,3) - Small educational example. Fast computation.'
            },
            e47: {
                a: 5,
                b: 7,
                p: 47,
                description: 'E₄₇(5,7) - Medium-sized example with good visual clarity.'
            },
            e97: {
                a: 2,
                b: 3,
                p: 97,
                description: 'E₉₇(2,3) - Default curve. Balanced size for demonstrations.'
            },
            e127: {
                a: 1,
                b: 2,
                p: 127,
                description: 'E₁₂₇(1,2) - Larger example showing more complex structure.'
            }
        };

        function loadCurvePreset(presetKey) {
            const descEl = document.getElementById('curveDescription');

            if (presetKey === 'custom') {
                descEl.textContent = 'Enter custom curve parameters';
                return;
            }

            const preset = curvePresets[presetKey];
            if (preset) {
                document.getElementById('paramA').value = preset.a;
                document.getElementById('paramB').value = preset.b;
                document.getElementById('paramP').value = preset.p;
                descEl.textContent = preset.description;

                // Show warning for very large primes
                if (preset.p > 10000) {
                    showToast('⚠️ Large prime detected: computation may take significant time', 'warning');
                }
            }
        }

        // Monitor parameter changes to switch to custom
        function initPresetMonitor() {
            const inputs = ['paramA', 'paramB', 'paramP'];
            inputs.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.addEventListener('input', () => {
                        const curveSelect = document.getElementById('curvePreset');
                        if (curveSelect && curveSelect.value !== 'custom') {
                            const a = parseInt(document.getElementById('paramA').value);
                            const b = parseInt(document.getElementById('paramB').value);
                            const p = parseInt(document.getElementById('paramP').value);

                            // Check if values match current preset
                            const currentPreset = curvePresets[curveSelect.value];
                            if (currentPreset && (a !== currentPreset.a || b !== currentPreset.b || p !== currentPreset.p)) {
                                curveSelect.value = 'custom';
                                document.getElementById('curveDescription').textContent = 'Custom curve parameters';
                            }
                        }
                    });
                }
            });
        }

        // =================== TOAST NOTIFICATION SYSTEM =================== //

        function showToast(message, type = 'info', duration = 3000) {
            const container = document.getElementById('toastContainer');
            if (!container) return;

            const icons = {
                success: '✓',
                error: '✕',
                warning: '⚠',
                info: 'ℹ'
            };

            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.innerHTML = `
                <span class="toast-icon">${icons[type] || icons.info}</span>
                <span class="toast-message">${message}</span>
                <span class="toast-close">×</span>
            `;

            container.appendChild(toast);

            // Close on click
            toast.addEventListener('click', () => removeToast(toast));

            // Auto-dismiss
            const timeoutId = setTimeout(() => removeToast(toast), duration);

            // Store timeout ID for potential manual dismissal
            toast._timeoutId = timeoutId;

            return toast;
        }

        function removeToast(toast) {
            if (!toast || toast.classList.contains('hiding')) return;

            clearTimeout(toast._timeoutId);
            toast.classList.add('hiding');

            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }

        // =================== COPY TO CLIPBOARD SYSTEM =================== //

        async function copyToClipboard(text, successMessage = 'Copied to clipboard!') {
            try {
                await navigator.clipboard.writeText(text);
                showToast(successMessage, 'success');
                return true;
            } catch (err) {
                showToast('Failed to copy to clipboard', 'error');
                return false;
            }
        }

        function copyResultAsJSON(data, label = 'Result') {
            const json = JSON.stringify(data, null, 2);
            copyToClipboard(json, `${label} copied as JSON!`);
        }

        function copyResultAsText(text, label = 'Result') {
            copyToClipboard(text, `${label} copied as text!`);
        }

        function copyResultAsLaTeX(data) {
            let latex = '';
            if (Array.isArray(data)) {
                latex = data.map(pt => pt.display === 'O' ? '\\mathcal{O}' : `(${pt.x}, ${pt.y})`).join(', ');
            } else if (data.display) {
                latex = data.display === 'O' ? '\\mathcal{O}' : `(${data.x}, ${data.y})`;
            } else {
                latex = JSON.stringify(data);
            }
            copyToClipboard(latex, 'Copied as LaTeX!');
        }

        // =================== KEYBOARD SHORTCUTS =================== //

        document.addEventListener('keydown', (e) => {
            // Check if user is typing in an input field
            const isInputField = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT';

            // Ctrl/Cmd + D: Toggle dark mode
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                e.preventDefault();
                toggleTheme();
                return;
            }

            // Ctrl/Cmd + Enter: Calculate/Submit current operation
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                const activePane = document.querySelector('.subtab-pane.active');
                if (activePane) {
                    const paneId = activePane.id;
                    if (paneId === 'fpInitPane') {
                        findAllPoints();
                    } else if (paneId === 'fpAddPane') {
                        addPoints();
                    } else if (paneId === 'fpMulPane') {
                        scalarMultiply();
                    } else if (paneId === 'realInitPane') {
                        initRealCurve();
                    } else if (paneId === 'realAddPane') {
                        addPointsReal();
                    } else if (paneId === 'realMulPane') {
                        scalarMultiplyReal();
                    }
                }
                return;
            }

            // Ctrl/Cmd + K: Clear current form (only if not in input)
            if ((e.ctrlKey || e.metaKey) && e.key === 'k' && !isInputField) {
                e.preventDefault();
                const activePane = document.querySelector('.subtab-pane.active');
                if (activePane) {
                    const inputs = activePane.querySelectorAll('input[type="number"]');
                    inputs.forEach(input => input.value = '');
                }
                showToast('Form cleared', 'info');
                return;
            }

            // Ctrl/Cmd + H: Toggle history panel
            if ((e.ctrlKey || e.metaKey) && e.key === 'h' && !isInputField) {
                e.preventDefault();
                toggleHistoryPanel();
                return;
            }

            // Escape: Close modals/panels
            if (e.key === 'Escape') {
                hideProfileMenu();

                // Close history panel if open
                const historyPanel = document.getElementById('historyPanel');
                if (historyPanel && historyPanel.classList.contains('open')) {
                    closeHistoryPanel();
                    return;
                }

                // Close auth overlay if visible
                const authOverlay = document.getElementById('authOverlay');
                if (authOverlay && authOverlay.classList.contains('visible')) {
                    authOverlay.classList.remove('visible');
                }
                return;
            }

            // ? key: Show keyboard shortcut help
            if (e.key === '?' && !isInputField) {
                e.preventDefault();
                showKeyboardHelp();
                return;
            }

            // F key: Show formula reference
            if (e.key === 'f' && !isInputField) {
                e.preventDefault();
                showFormulaReference();
                return;
            }
        });

        function showKeyboardHelp() {
            const helpMessage = `
                <strong>Keyboard Shortcuts</strong><br>
                <code>Ctrl/Cmd + Enter</code>: Calculate/Submit<br>
                <code>Ctrl/Cmd + D</code>: Toggle dark mode<br>
                <code>Ctrl/Cmd + K</code>: Clear form<br>
                <code>Ctrl/Cmd + H</code>: Toggle history<br>
                <code>F</code>: Formula reference<br>
                <code>Esc</code>: Close modals<br>
                <code>?</code>: Show this help
            `;

            const helpToast = showToast(helpMessage, 'info', 8000);
            if (helpToast) {
                helpToast.style.minWidth = '320px';
            }
        }

        // About Modal Functions
        function toggleAboutModal() {
            const modal = document.getElementById('aboutModal');
            if (modal.classList.contains('active')) {
                closeAboutModal();
            } else {
                openAboutModal();
            }
        }

        function openAboutModal() {
            const modal = document.getElementById('aboutModal');
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }

        function closeAboutModal() {
            const modal = document.getElementById('aboutModal');
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }

        // Close modal with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const aboutModal = document.getElementById('aboutModal');
                if (aboutModal && aboutModal.classList.contains('active')) {
                    closeAboutModal();
                }
            }
        });

        function showFormulaReference() {
            const formulaMessage = `
                <div style="max-height: 400px; overflow-y: auto; text-align: left;">
                    <strong style="font-size: 1.2em;">📐 Formula Reference</strong><br><br>

                    <strong style="color: var(--accent-secondary);">Curve Equations</strong><br>
                    • Fp: <code>y² ≡ x³ + ax + b (mod p)</code><br>
                    • ℝ: <code>y² = x³ + ax + b</code><br>
                    • Valid: <code>Δ = 4a³ + 27b² ≠ 0</code><br><br>

                    <strong style="color: var(--accent-secondary);">Point Addition (P + Q)</strong><br>
                    <em>When P ≠ Q:</em><br>
                    • Slope: <code>m = (y₂ - y₁) / (x₂ - x₁)</code><br>
                    • Result: <code>x₃ = m² - x₁ - x₂</code><br>
                    • Result: <code>y₃ = m(x₁ - x₃) - y₁</code><br><br>

                    <em>When P = Q (doubling):</em><br>
                    • Slope: <code>m = (3x₁² + a) / (2y₁)</code><br>
                    • Result: <code>x₃ = m² - 2x₁</code><br>
                    • Result: <code>y₃ = m(x₁ - x₃) - y₁</code><br><br>

                    <strong style="color: var(--accent-secondary);">Scalar Multiplication (k × P)</strong><br>
                    • Uses double-and-add algorithm<br>
                    • Complexity: <code>O(log k)</code><br>
                    • Binary decomposition of k<br><br>

                    <strong style="color: var(--accent-secondary);">Special Cases</strong><br>
                    • Identity: <code>P + O = P</code><br>
                    • Inverse: <code>P + (-P) = O</code><br>
                    • Negation: <code>-P = (x, -y)</code><br>
                    • Doubling at y=0: <code>2P = O</code>
                </div>
            `;

            const formulaToast = showToast(formulaMessage, 'info', 15000);
            if (formulaToast) {
                formulaToast.style.minWidth = '450px';
                formulaToast.style.maxWidth = '500px';
            }
        }

        // =================== STEP-BY-STEP DISPLAY =================== //

        function toggleStep(header) {
            const toggle = header.querySelector('.step-toggle');
            const content = header.nextElementSibling;

            if (content && content.classList.contains('step-content')) {
                content.classList.toggle('collapsed');
                toggle.classList.toggle('expanded');
            } else {
                // If no content, just toggle the arrow for visual feedback
                toggle.classList.toggle('expanded');
            }
        }

        // =================== SMART VALIDATION =================== //

        function isPrime(n) {
            if (n <= 1) return false;
            if (n <= 3) return true;
            if (n % 2 === 0 || n % 3 === 0) return false;
            const limit = Math.min(Math.sqrt(n), 10000);
            for (let i = 5; i <= limit; i += 6) {
                if (n % i === 0 || n % (i + 2) === 0) return false;
            }
            return true;
        }

        function findNearbyPrimes(n, count = 3) {
            const primes = [];
            for (let i = Math.max(2, n - 50); i < n + 50 && primes.length < count; i++) {
                if (isPrime(i) && i !== n) primes.push(i);
            }
            return primes.sort((a, b) => Math.abs(a - n) - Math.abs(b - n)).slice(0, count);
        }

        function validateCurveParams() {
            const aInput = document.getElementById('paramA');
            const bInput = document.getElementById('paramB');
            const pInput = document.getElementById('paramP');

            const a = parseInt(aInput.value);
            const b = parseInt(bInput.value);
            const p = parseInt(pInput.value);

            let allValid = true;

            if (isNaN(a)) {
                setValidationState(aInput, 'invalid', 'Enter a number');
                allValid = false;
            } else {
                setValidationState(aInput, 'valid', '');
            }

            if (isNaN(b)) {
                setValidationState(bInput, 'invalid', 'Enter a number');
                allValid = false;
            } else {
                setValidationState(bInput, 'valid', '');
            }

            if (isNaN(p) || p <= 2) {
                setValidationState(pInput, 'invalid', 'Enter prime > 2');
                allValid = false;
            } else if (!isPrime(p)) {
                const nearby = findNearbyPrimes(p);
                setValidationState(pInput, 'invalid', `Not prime. Try: ${nearby.join(', ')}`);
                allValid = false;
            } else {
                setValidationState(pInput, 'valid', 'Valid prime ✓');
                if (!isNaN(a) && !isNaN(b)) {
                    const disc = (4 * Math.pow(a, 3) + 27 * Math.pow(b, 2)) % p;
                    if (disc === 0) {
                        setValidationState(aInput, 'warning', 'Discriminant = 0 (singular curve)');
                        allValid = false;
                    }
                }
            }
            return allValid;
        }

        function setValidationState(input, state, message) {
            input.classList.remove('valid', 'invalid', 'warning');
            if (state) input.classList.add(state);

            let messageEl = input.parentElement.querySelector('.validation-message');
            if (!messageEl) {
                messageEl = document.createElement('div');
                messageEl.className = 'validation-message';
                input.parentElement.appendChild(messageEl);
            }
            messageEl.textContent = message;
            messageEl.className = 'validation-message ' + (state === 'warning' ? 'warning' : state === 'invalid' ? 'error' : state === 'valid' ? 'success' : 'info');
        }

        function initValidation() {
            // Fp curve validation
            ['paramA', 'paramB', 'paramP'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.addEventListener('input', validateCurveParams);
            });

            // Real curve validation
            ['realParamA', 'realParamB'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.addEventListener('input', validateRealCurveParams);
            });

            validateCurveParams();
        }

        function validateRealCurveParams() {
            const aInput = document.getElementById('realParamA');
            const bInput = document.getElementById('realParamB');

            if (!aInput || !bInput) return true;

            const a = parseFloat(aInput.value);
            const b = parseFloat(bInput.value);

            let allValid = true;

            if (isNaN(a)) {
                setValidationState(aInput, 'invalid', 'Enter a number');
                allValid = false;
            } else {
                setValidationState(aInput, 'valid', '');
            }

            if (isNaN(b)) {
                setValidationState(bInput, 'invalid', 'Enter a number');
                allValid = false;
            } else {
                setValidationState(bInput, 'valid', '');
            }

            if (!isNaN(a) && !isNaN(b)) {
                const disc = 4 * Math.pow(a, 3) + 27 * Math.pow(b, 2);
                if (Math.abs(disc) < 1e-10) {
                    setValidationState(aInput, 'warning', '⚠️ Discriminant ≈ 0 (singular curve)');
                    setValidationState(bInput, 'warning', 'Try different values');
                    allValid = false;
                } else {
                    setValidationState(aInput, 'valid', 'Valid curve ✓');
                    setValidationState(bInput, 'valid', 'Valid curve ✓');
                }
            }

            return allValid;
        }

        // =================== LOADING INDICATORS =================== //

        let loadingStartTime = 0;

        function showLoading(message = 'Calculating...', details = '') {
            const overlay = document.getElementById('loadingOverlay');
            const loadingText = overlay.querySelector('.loading-text');
            const loadingDetails = overlay.querySelector('.loading-details');

            if (loadingText) loadingText.textContent = message;
            if (loadingDetails) loadingDetails.textContent = details;

            overlay.classList.add('visible');
            loadingStartTime = Date.now();

            // Disable all buttons while loading
            document.querySelectorAll('button').forEach(btn => {
                if (!btn.classList.contains('header-btn') && !btn.classList.contains('theme-toggle')) {
                    btn.disabled = true;
                }
            });
        }

        function hideLoading() {
            const overlay = document.getElementById('loadingOverlay');
            overlay.classList.remove('visible');

            // Re-enable buttons
            document.querySelectorAll('button').forEach(btn => {
                btn.disabled = false;
            });

            // Show calculation time if took more than 500ms
            if (loadingStartTime > 0) {
                const duration = ((Date.now() - loadingStartTime) / 1000).toFixed(2);
                if (duration > 0.5) {
                    showToast(`Calculated in ${duration}s`, 'info', 2000);
                }
                loadingStartTime = 0;
            }
        }

        // NO IMPLEMENTATION CODE HERE!
        // All calculations are done by the backend

        let currentPoints = [];
        let currentCurve = {a: 2, b: 3, p: 97};
        let scalarSteps = [];
        let currentStep = 0;
        let animationInterval = null;
        let selectedAdditionIndex = null;
        let selectedMultiplicationIndex = null;

        // Tab switching
        // Defer a redraw until after the tab becomes visible and layout settles
        function _deferRedraw(fn){
            // Two RAFs to cross a paint boundary after style/class changes
            requestAnimationFrame(() => requestAnimationFrame(() => fn && fn()));
        }

        function switchTab(tabId) {
            document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');

            // Defer redraw so canvases have non-zero size once visible
            _deferRedraw(() => { redrawAllCurves(); redrawRealCanvases(); });
        }

        function selectCurveType(tabId, label) {
            // Update active state in dropdown (only in the curve type dropdown)
            const curveDropdown = document.getElementById('curveSelectorBtn').parentElement;
            curveDropdown.querySelectorAll('.curve-dropdown-item').forEach(item => {
                item.classList.remove('active');
            });
            event.target.classList.add('active');

            // Switch to the selected tab
            switchTab(tabId);
        }

        function selectEncryptionPane(paneId, evt) {
            // Update active state in encryption dropdown
            const encryptDropdownEl = document.getElementById('encryptionSelectorBtn');
            const encryptDropdown = encryptDropdownEl?.parentElement;
            if (encryptDropdown) {
                encryptDropdown.querySelectorAll('.curve-dropdown-item').forEach(item => {
                    item.classList.remove('active');
                });
                const targetItem = evt?.target;
                if (targetItem) {
                    targetItem.classList.add('active');
                }
            }

            // Switch to encryption tab
            document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
            document.getElementById('encryptionTab').classList.add('active');

            // Switch to the selected encryption pane
            const encryptionTab = document.getElementById('encryptionTab');
            encryptionTab.querySelectorAll('.subtab-pane').forEach(p => p.classList.remove('active'));
            const pane = document.getElementById(paneId);
            if (pane) pane.classList.add('active');

            // Redraw encryption canvases
            _deferRedraw(() => redrawEncryptionCanvases());
        }

        function switchSubtab(group, paneId){
            let container;
            if (group === 'real') {
                container = document.getElementById('realTab');
            } else if (group === 'encrypt') {
                container = document.getElementById('encryptionTab');
            } else {
                container = document.getElementById('fpTab');
            }
            if (!container) return;
            container.querySelectorAll('.subtab-pane').forEach(p => p.classList.remove('active'));
            const pane = document.getElementById(paneId);
            if (pane) pane.classList.add('active');
            if (group === 'real') {
                _deferRedraw(() => redrawRealCanvases());
            } else if (group === 'encrypt') {
                _deferRedraw(() => redrawEncryptionCanvases());
            } else {
                _deferRedraw(() => redrawAllCurves());
            }
            // Load history when switching to history pane
            if (paneId === 'fpHistoryPane') loadHistory('fp');
            if (paneId === 'realHistoryPane') loadHistory('real');
        }

        // Setup canvas for HiDPI and return drawing context in CSS pixel units
        function setupCanvas(canvas) {
            if (!canvas) return null;

            const dpr = window.devicePixelRatio || 1;
            const cssWidth = canvas.clientWidth || canvas.width;
            const cssHeight = canvas.clientHeight || canvas.height;

            const targetWidth = Math.round(cssWidth * dpr);
            const targetHeight = Math.round(cssHeight * dpr);

            // Only resize if dimensions changed
            if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
                canvas.width = targetWidth;
                canvas.height = targetHeight;
            }

            const ctx = canvas.getContext('2d', { alpha: false });
            // Work in CSS pixels
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            // Add roundRect polyfill if not supported
            if (!ctx.roundRect) {
                ctx.roundRect = function(x, y, w, h, r) {
                    if (w < 2 * r) r = w / 2;
                    if (h < 2 * r) r = h / 2;
                    this.beginPath();
                    this.moveTo(x + r, y);
                    this.arcTo(x + w, y, x + w, y + h, r);
                    this.arcTo(x + w, y + h, x, y + h, r);
                    this.arcTo(x, y + h, x, y, r);
                    this.arcTo(x, y, x + w, y, r);
                    this.closePath();
                    return this;
                };
            }

            return { ctx, cssWidth, cssHeight, dpr };
        }

        // Clear canvas with theme-aware background color
        function clearCanvas(ctx, width, height) {
            const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--canvas-bg').trim();
            ctx.fillStyle = bgColor || '#ffffff';
            ctx.fillRect(0, 0, width, height);
        }

        // Debounce function for canvas redraws
        function debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }

        // Optimized redraw using requestAnimationFrame
        let redrawScheduled = false;
        function scheduleRedraw(redrawFunc) {
            if (!redrawScheduled) {
                redrawScheduled = true;
                requestAnimationFrame(() => {
                    redrawFunc();
                    redrawScheduled = false;
                });
            }
        }

        // Find all points - calls API
        async function findAllPoints() {
            const a = parseInt(document.getElementById('paramA').value);
            const b = parseInt(document.getElementById('paramB').value);
            const p = parseInt(document.getElementById('paramP').value);

            currentCurve = {a, b, p};
            const curveInfo = document.getElementById('curveInfo');

            // Show loading indicator
            showLoading('Finding all points...', `Curve: y² = x³ + ${a}x + ${b} (mod ${p})`);

            try {
                const response = await fetch('/api/find_points', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({a, b, p})
                });

                const data = await response.json();
                hideLoading();

                if (data.success) {
                    currentPoints = data.points;

                    curveInfo.innerHTML = `
                        <div class="curve-info">
                            <strong>Curve:</strong> <code>y² = x³ + ${a}x + ${b} (mod ${p})</code><br>
                            <strong>Total Points:</strong> ${data.count}
                        </div>
                    `;

                    let html = '<div class="result-box">';
                    html += '<div class="result-header">';
                    html += '<h3>All Points on Curve</h3>';
                    html += '</div>';
                    data.points.forEach((point, index) => {
                        const className = point.display === 'O' ? 'point-item point-at-infinity' : 'point-item';
                        html += `<div class="${className}">${index + 1}. ${point.display}</div>`;
                    });
                    html += '<div class="copy-btn-group">';
                    html += `<button class="copy-btn" onclick="copyResultAsText('${data.points.map(p => p.display).join(', ')}', 'Points')">📋 Copy Text</button>`;
                    html += `<button class="copy-btn" onclick='copyResultAsJSON(${JSON.stringify(data.points)}, "Points")'>📄 Copy JSON</button>`;
                    html += `<button class="copy-btn" onclick='copyResultAsLaTeX(${JSON.stringify(data.points)})'>🎓 Copy LaTeX</button>`;
                    html += '</div>';
                    html += '</div>';
                    document.getElementById('pointsList').innerHTML = html;

                    populateSelectors();
                    // Animate points appearing
                    startFpInitializationAnimation();
                } else {
                    curveInfo.innerHTML = `<div class="error">${data.error}</div>`;
                }
            } catch (error) {
                hideLoading();
                curveInfo.innerHTML = `<div class="error">Connection error. Is the server running?</div>`;
            }
        }

        // Redraw helper to refresh both canvases with current points
        function redrawAllCurves() {
            scheduleRedraw(() => {
                const addCanvas = document.getElementById('additionCanvas');
                if (addCanvas && addCanvas.offsetParent !== null) { // Check if canvas is visible
                    const canvasData = setupCanvas(addCanvas);
                    if (canvasData) {
                        const { ctx, cssWidth, cssHeight } = canvasData;
                        clearCanvas(ctx, cssWidth, cssHeight);
                        drawAxesGrid(ctx, addCanvas);
                        // Always draw base points without labels; labels for P,Q,R handled separately
                        drawCurvePoints(ctx, addCanvas, '#8a8a8a', false);
                        if (selectedAdditionIndex !== null && currentPoints[selectedAdditionIndex]) {
                            drawSelectedHighlight(ctx, addCanvas, currentPoints[selectedAdditionIndex]);
                        }
                    }
                }

                const mulCanvas = document.getElementById('multiplicationCanvas');
                if (mulCanvas && mulCanvas.offsetParent !== null) { // Check if canvas is visible
                    const canvasData = setupCanvas(mulCanvas);
                    if (canvasData) {
                        const { ctx, cssWidth, cssHeight } = canvasData;
                        clearCanvas(ctx, cssWidth, cssHeight);
                        drawAxesGrid(ctx, mulCanvas);
                        drawCurvePoints(ctx, mulCanvas, '#8a8a8a', false);
                        if (selectedMultiplicationIndex !== null && currentPoints[selectedMultiplicationIndex]) {
                            drawSelectedHighlight(ctx, mulCanvas, currentPoints[selectedMultiplicationIndex]);
                        }
                    }
                }
            });
        }

        // Redraw the addition canvas specifically (used when toggling labels)
        function redrawAdditionCanvas() {
            scheduleRedraw(() => {
                // If we have a last computed addition, redraw with them; otherwise just base grid + points
                if (window._lastAdditionP && window._lastAdditionQ && window._lastAdditionR) {
                    visualizeAddition(window._lastAdditionP, window._lastAdditionQ, window._lastAdditionR);
                } else {
                    const canvas = document.getElementById('additionCanvas');
                    if (canvas && canvas.offsetParent !== null) {
                        const canvasData = setupCanvas(canvas);
                        if (canvasData) {
                            const { ctx, cssWidth, cssHeight } = canvasData;
                            clearCanvas(ctx, cssWidth, cssHeight);
                            drawAxesGrid(ctx, canvas);
                            // Always draw base points without labels; labels are applied only to P,Q,R
                            drawCurvePoints(ctx, canvas, '#8a8a8a', false);
                            if (selectedAdditionIndex !== null && currentPoints[selectedAdditionIndex]) {
                                drawSelectedHighlight(ctx, canvas, currentPoints[selectedAdditionIndex]);
                            }
                        }
                    }
                }
            });
        }

        function populateSelectors() {
            const selectors = ['point1Select', 'point2Select', 'scalarPointSelect'];

            selectors.forEach(id => {
                const select = document.getElementById(id);
                if (!select) return;
                select.innerHTML = '<option value="">Select a point</option>';

                currentPoints.forEach((point, index) => {
                    const option = document.createElement('option');
                    option.value = index;
                    option.textContent = point.display;
                    select.appendChild(option);
                });
            });
        }

        const OPERATION_RESULT_MAP = {
            addition: 'additionResult',
            scalar: 'scalarResult',
            realAddition: 'realAdditionResult',
            realScalar: 'realScalarResult',
            encryption: 'encryptionStepsDisplay',
            decryption: 'decryptionStepsDisplay',
        };

        function getOperationResultContainer(operation) {
            const id = OPERATION_RESULT_MAP[operation];
            if (!id) return null;
            return document.getElementById(id);
        }

        function applyStepsVisibility(operation, visible) {
            const container = getOperationResultContainer(operation);
            if (!container) return;

            // For encryption/decryption, toggle the entire steps display div
            if (operation === 'encryption' || operation === 'decryption') {
                container.style.display = visible ? '' : 'none';
            } else {
                // For other operations, toggle steps-container inside result
                container.querySelectorAll('.steps-container').forEach(el => {
                    el.style.display = visible ? '' : 'none';
                });
            }
        }

        function toggleStepsDisplay(operation) {
            const btn = document.getElementById(`${operation}ToggleStepsBtn`);
            if (!btn) return;
            const currentlyVisible = btn.getAttribute('data-visible') !== 'false';
            const nextVisible = !currentlyVisible;
            btn.setAttribute('data-visible', nextVisible ? 'true' : 'false');
            btn.textContent = nextVisible ? 'Hide steps' : 'Show steps';
            applyStepsVisibility(operation, nextVisible);
        }

        // Add points - calls API
        async function addPoints() {
            const p1Index = document.getElementById('point1Select').value;
            const p2Index = document.getElementById('point2Select').value;
            const resultDiv = document.getElementById('additionResult');

            if (!p1Index || !p2Index) {
                resultDiv.innerHTML = '<div class="error">Please select both points</div>';
                return;
            }

            showLoading('Adding points...', `P + Q`);

            try {
                const response = await fetch('/api/add_points', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        a: currentCurve.a,
                        b: currentCurve.b,
                        p: currentCurve.p,
                        p1: currentPoints[p1Index],
                        p2: currentPoints[p2Index]
                    })
                });

                const data = await response.json();
                hideLoading();

                if (data.success) {
                    const resultText = `P = ${currentPoints[p1Index].display}, Q = ${currentPoints[p2Index].display}, P + Q = ${data.result.display}`;

                    // Build steps HTML
                    let stepsHtml = '';
                    if (data.steps && data.steps.length > 0) {
                        stepsHtml = `
                            <div class="steps-container">
                                <h4>Calculation Steps</h4>
                                ${data.steps.map((step, i) => `
                                    <div class="step-item">
                                        <div class="step-header">
                                            <span>${step}</span>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        `;
                    }

                    resultDiv.innerHTML = `
                        <div class="operation-result">
                            <strong>P</strong> = ${currentPoints[p1Index].display}<br>
                            <strong>Q</strong> = ${currentPoints[p2Index].display}<br>
                            <strong>P + Q</strong> = ${data.result.display}
                        </div>
                        ${stepsHtml}
                        <div class="copy-btn-group">
                            <button class="copy-btn" onclick="copyResultAsText('${resultText}', 'Addition result')">📋 Copy Text</button>
                            <button class="copy-btn" onclick='copyResultAsJSON({P: ${JSON.stringify(currentPoints[p1Index])}, Q: ${JSON.stringify(currentPoints[p2Index])}, result: ${JSON.stringify(data.result)}, steps: ${JSON.stringify(data.steps)}}, "Addition result")'>📄 Copy JSON</button>
                        </div>
                    `;
                    // store for re-rendering with label toggle
                    window._lastAdditionP = currentPoints[p1Index];
                    window._lastAdditionQ = currentPoints[p2Index];
                    window._lastAdditionR = data.result;
                    const additionVisible = document.getElementById('additionToggleStepsBtn')?.getAttribute('data-visible') !== 'false';
                    applyStepsVisibility('addition', additionVisible);
                    visualizeAddition(window._lastAdditionP, window._lastAdditionQ, window._lastAdditionR);
                    // animate addition pulse
                    startFpAdditionAnimation(window._lastAdditionP, window._lastAdditionQ, window._lastAdditionR);
                } else {
                    resultDiv.innerHTML = `<div class="error">${data.error}</div>`;
                }
            } catch (error) {
                hideLoading();
                resultDiv.innerHTML = '<div class="error">Connection error</div>';
            }
        }

        // Scalar multiplication - calls API (Fp)
        let fpScalarPoints = [];
        let _fpMulAnim = { active:false, raf:null };
        async function scalarMultiply() {
            const pointIndex = document.getElementById('scalarPointSelect').value;
            const k = parseInt(document.getElementById('scalarValue').value);
            const resultDiv = document.getElementById('scalarResult');

            if (!pointIndex) {
                resultDiv.innerHTML = '<div class="error">Please select a point</div>';
                return;
            }

            if (isNaN(k)) {
                resultDiv.innerHTML = '<div class="error">Please enter a valid scalar</div>';
                return;
            }

            showLoading('Multiplying point...', `${k} × P`);

            try {
                const response = await fetch('/api/scalar_multiply', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        a: currentCurve.a,
                        b: currentCurve.b,
                        p: currentCurve.p,
                        k: k,
                        point: currentPoints[pointIndex]
                    })
                });

                const data = await response.json();
                hideLoading();

                if (data.success) {
                    // Show only final result coordinates
                    const resultText = `P = ${currentPoints[pointIndex].display}, k = ${k}, ${k} × P = ${data.result.display}`;
                    let stepsHtml = '';

                    if (data.steps && data.steps.length > 0) {
                        stepsHtml = `
                            <div class="steps-container">
                                <h4 style="color: var(--text-secondary); margin-bottom: 10px;">Calculation Steps (${data.steps.length} steps)</h4>
                                ${data.steps.map((step, i) => `
                                    <div class="step-item">
                                        <div class="step-header" onclick="toggleStep(this)">
                                            <span>Step ${i + 1}: ${step}</span>
                                            <span class="step-toggle">▶</span>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        `;
                    }

                    resultDiv.innerHTML = `
                        <div class="operation-result">
                            <strong>P</strong> = ${currentPoints[pointIndex].display}<br>
                            <strong>k</strong> = ${k}<br>
                            <strong>${k} × P</strong> = ${data.result.display}
                        </div>
                        ${stepsHtml}
                        <div class="copy-btn-group">
                            <button class="copy-btn" onclick="copyResultAsText('${resultText}', 'Multiplication result')">📋 Copy Text</button>
                            <button class="copy-btn" onclick='copyResultAsJSON({P: ${JSON.stringify(currentPoints[pointIndex])}, k: ${k}, result: ${JSON.stringify(data.result)}, steps: ${JSON.stringify(data.steps)}}, "Multiplication result")'>📄 Copy JSON</button>
                        </div>
                    `;

                    // Parse intermediate multiples into points array and draw all
                    scalarSteps = data.steps || [];
                    fpScalarPoints = [];
                    const re = /\((\d+)\s*,\s*(\d+)\)/;
                    for (const s of scalarSteps) {
                        const m = re.exec(s || '');
                        if (m) fpScalarPoints.push({ x: parseInt(m[1]), y: parseInt(m[2]) });
                    }
                    // Animate plotting of 1P..kP
                    startFpMultiplicationAnimation();
                    const scalarVisible = document.getElementById('scalarToggleStepsBtn')?.getAttribute('data-visible') !== 'false';
                    applyStepsVisibility('scalar', scalarVisible);
                } else {
                    resultDiv.innerHTML = `<div class="error">${data.error}</div>`;
                }
            } catch (error) {
                hideLoading();
                resultDiv.innerHTML = '<div class="error">Connection error</div>';
            }
        }

        // Animation controls
        function prevScalarStep() {
            if (currentStep > 0) {
                currentStep--;
                document.getElementById('stepSlider').value = currentStep;
                visualizeScalarStep(currentStep);
                updateStepLabel();
            }
        }

        function nextScalarStep() {
            if (currentStep < scalarSteps.length - 1) {
                currentStep++;
                document.getElementById('stepSlider').value = currentStep;
                visualizeScalarStep(currentStep);
                updateStepLabel();
            }
        }

        function onScalarSlider(value) {
            currentStep = parseInt(value);
            visualizeScalarStep(currentStep);
            updateStepLabel();
        }

        function toggleScalarAnimation() {
            const btn = document.getElementById('playPauseBtn');
            if (animationInterval) {
                clearInterval(animationInterval);
                animationInterval = null;
                btn.textContent = 'Play';
            } else {
                btn.textContent = 'Pause';
                animationInterval = setInterval(() => {
                    if (currentStep < scalarSteps.length - 1) {
                        nextScalarStep();
                    } else {
                        clearInterval(animationInterval);
                        animationInterval = null;
                        btn.textContent = 'Play';
                        currentStep = 0;
                    }
                }, 1000);
            }
        }

        function updateStepLabel() {
            document.getElementById('stepLabel').textContent = `${currentStep + 1}/${scalarSteps.length}`;
        }

        // Visualization functions
        function visualizeAddition(P, Q, R) {
            const canvas = document.getElementById('additionCanvas');
            const { ctx, cssWidth, cssHeight } = setupCanvas(canvas);
            clearCanvas(ctx, cssWidth, cssHeight);
            
            drawAxesGrid(ctx, canvas);
            // Always draw full curve points without labels
            drawCurvePoints(ctx, canvas, '#8a8a8a', false);
            
            // Highlight P, Q, R
            if (P.x !== null) {
                drawPoint(ctx, canvas, P.x, P.y, '#2563eb', 6, 'P');
            }
            if (Q.x !== null) {
                drawPoint(ctx, canvas, Q.x, Q.y, '#f97316', 6, 'Q');
            }
                if (R.x !== null) {
                drawPoint(ctx, canvas, R.x, R.y, '#166534', 7, 'R');
            }

            // Selected point highlight (click)
            if (selectedAdditionIndex !== null && currentPoints[selectedAdditionIndex]) {
                drawSelectedHighlight(ctx, canvas, currentPoints[selectedAdditionIndex]);
            }

            // If toggled, show coordinates only for the answer-related points P, Q, and R
            const showA = document.getElementById('additionShowLabels')?.checked;
            if (showA) {
                const padding = 50;
                const cssWidth = (canvas.clientWidth || canvas.width);
                const cssHeight = (canvas.clientHeight || canvas.height);
                const width = cssWidth - 2 * padding;
                const height = cssHeight - 2 * padding;
                const maxVal = Math.max(1, (currentCurve.p || 1) - 1);
                function drawCoords(pt){
                    if (!pt || pt.x === null || pt.y === null) return;
                    const x = padding + (pt.x / maxVal) * width;
                    const y = cssHeight - padding - (pt.y / maxVal) * height;
                    const label = `(${pt.x}, ${pt.y})`;
                    ctx.font = '10px monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    ctx.fillStyle = 'rgba(0,0,0,0.6)';
                    ctx.fillText(label, x, y - 10 + 1);
                    ctx.fillStyle = '#bbb';
                    ctx.fillText(label, x, y - 10);
                }
                drawCoords(P);
                drawCoords(Q);
                drawCoords(R);
            }
        }

        // Progressive point reveal animation for Fp initialization
        let _fpInitAnim = { active:false, raf:null };
        function startFpInitializationAnimation(){
            if (!currentPoints || !currentPoints.length) { redrawAllCurves(); return; }
            if (_fpInitAnim.raf) cancelAnimationFrame(_fpInitAnim.raf);
            _fpInitAnim.active = true;
            const start = performance.now();
            const totalPoints = currentPoints.length;
            const duration = Math.min(3000, totalPoints * 50); // 50ms per point, max 3s

            const step = (now)=>{
                const elapsed = now - start;
                const rawProgress = Math.min(1, elapsed / duration);
                const progress = Easing.easeOutCubic(rawProgress); // Smooth easing
                const pointsToShow = Math.ceil(progress * totalPoints);

                // Draw on both visible canvases
                const addCanvas = document.getElementById('additionCanvas');
                if (addCanvas && addCanvas.offsetParent !== null) {
                    const canvasData = setupCanvas(addCanvas);
                    if (canvasData) {
                        const { ctx, cssWidth, cssHeight } = canvasData;
                        clearCanvas(ctx, cssWidth, cssHeight);
                        drawAxesGrid(ctx, addCanvas);
                        drawPartialCurvePoints(ctx, addCanvas, '#8a8a8a', false, pointsToShow, rawProgress);
                    }
                }

                const mulCanvas = document.getElementById('multiplicationCanvas');
                if (mulCanvas && mulCanvas.offsetParent !== null) {
                    const canvasData = setupCanvas(mulCanvas);
                    if (canvasData) {
                        const { ctx, cssWidth, cssHeight } = canvasData;
                        clearCanvas(ctx, cssWidth, cssHeight);
                        drawAxesGrid(ctx, mulCanvas);
                        drawPartialCurvePoints(ctx, mulCanvas, '#8a8a8a', false, pointsToShow, rawProgress);
                    }
                }

                if (progress < 1){
                    _fpInitAnim.raf = requestAnimationFrame(step);
                } else {
                    _fpInitAnim.active = false;
                    _fpInitAnim.raf = null;
                    redrawAllCurves();
                }
            };
            _fpInitAnim.raf = requestAnimationFrame(step);
        }

        // Helper to draw only first N points with smooth animations
        function drawPartialCurvePoints(ctx, canvas, color, showLabels, count, rawProgress = 1) {
            const padding = 50;
            const cssWidth = (canvas.clientWidth || canvas.width);
            const cssHeight = (canvas.clientHeight || canvas.height);
            const width = cssWidth - 2 * padding;
            const height = cssHeight - 2 * padding;
            const maxVal = Math.max(1, (currentCurve.p || 1) - 1);

            const pointsToRender = currentPoints.slice(0, count);
            pointsToRender.forEach((point, index) => {
                if (point.display === 'O') return;
                const px = padding + (point.x / maxVal) * width;
                const py = cssHeight - padding - (point.y / maxVal) * height;

                // Calculate individual point animation timing
                const pointProgress = Math.max(0, Math.min(1, (count - index) / 8));
                const scale = Easing.easeOutBack(pointProgress);

                // Calculate fade-in and glow effect for recent points
                const fadeStart = Math.max(0, count - 10);
                const isRecent = index >= fadeStart;
                const recentProgress = isRecent ? (index - fadeStart) / 10 : 1;
                const alpha = isRecent ? Easing.easeOutCubic(recentProgress) : 1;

                // Draw glow for recent points
                if (isRecent && alpha < 1) {
                    const glowSize = (1 - alpha) * 8;
                    ctx.globalAlpha = (1 - alpha) * 0.3;
                    ctx.fillStyle = '#3b82f6';
                    ctx.beginPath();
                    ctx.arc(px, py, 4 + glowSize, 0, 2 * Math.PI);
                    ctx.fill();
                }

                // Draw main point with scale animation
                ctx.globalAlpha = alpha;
                ctx.save();
                ctx.translate(px, py);
                ctx.scale(scale, scale);
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(0, 0, 4, 0, 2 * Math.PI);
                ctx.fill();
                ctx.restore();

                if (showLabels && alpha > 0.5) {
                    ctx.globalAlpha = alpha;
                    ctx.font = '9px monospace';
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = color;
                    ctx.fillText(`(${point.x},${point.y})`, px + 6, py);
                }
            });
            ctx.globalAlpha = 1;
        }

        // Enhanced animation for Fp addition with lines
        let _fpAddAnim = { active:false, raf:null, started:0, duration:2500 };
        function startFpAdditionAnimation(P, Q, R){
            const canvas = document.getElementById('additionCanvas');
            if (!canvas) return;
            if (_fpAddAnim.raf) cancelAnimationFrame(_fpAddAnim.raf);
            _fpAddAnim = { active:true, raf:null, started: performance.now(), duration:2500 };
            const map = (px, py) => {
                const padding = 50;
                const cssWidth = (canvas.clientWidth || canvas.width);
                const cssHeight = (canvas.clientHeight || canvas.height);
                const width = cssWidth - 2 * padding;
                const height = cssHeight - 2 * padding;
                const maxVal = Math.max(1, (currentCurve.p || 1) - 1);
                const x = padding + (px / maxVal) * width;
                const y = cssHeight - padding - (py / maxVal) * height;
                return {x, y};
            };
            const tick = (now)=>{
                const { ctx, cssWidth, cssHeight } = setupCanvas(canvas);
                clearCanvas(ctx, cssWidth, cssHeight);
                drawAxesGrid(ctx, canvas);
                drawCurvePoints(ctx, canvas, '#8a8a8a', false);

                const rawT = Math.min(1, (now - _fpAddAnim.started) / _fpAddAnim.duration);

                // Phase 1: Show P and Q (0 to 0.25) with elastic bounce
                const phase1Raw = Math.min(1, rawT / 0.25);
                const phase1 = Easing.easeOutElastic(phase1Raw);

                // Phase 2: Draw line from P to Q (0.25 to 0.55) with smooth easing
                const phase2Raw = Math.max(0, Math.min(1, (rawT - 0.25) / 0.3));
                const phase2 = Easing.easeInOutCubic(phase2Raw);

                // Phase 3: Show R (0.55 to 1.0) with back easing (overshoot)
                const phase3Raw = Math.max(0, Math.min(1, (rawT - 0.55) / 0.45));
                const phase3 = Easing.easeOutBack(phase3Raw);

                // Draw P and Q with glow
                if (P.x !== null && phase1Raw > 0) {
                    const p = map(P.x, P.y);

                    // Glow effect
                    if (phase1Raw < 1) {
                        ctx.globalAlpha = (1 - phase1Raw) * 0.4;
                        ctx.fillStyle = '#2563eb';
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, 12 + (1 - phase1Raw) * 8, 0, 2 * Math.PI);
                        ctx.fill();
                        ctx.globalAlpha = 1;
                    }

                    const scale = Math.min(1.2, phase1);
                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.scale(scale, scale);
                    ctx.translate(-p.x, -p.y);
                    drawPoint(ctx, canvas, P.x, P.y, '#2563eb', 6, 'P');
                    ctx.restore();
                }

                if (Q.x !== null && phase1Raw > 0) {
                    const q = map(Q.x, Q.y);

                    // Glow effect
                    if (phase1Raw < 1) {
                        ctx.globalAlpha = (1 - phase1Raw) * 0.4;
                        ctx.fillStyle = '#f97316';
                        ctx.beginPath();
                        ctx.arc(q.x, q.y, 12 + (1 - phase1Raw) * 8, 0, 2 * Math.PI);
                        ctx.fill();
                        ctx.globalAlpha = 1;
                    }

                    const scale = Math.min(1.2, phase1);
                    ctx.save();
                    ctx.translate(q.x, q.y);
                    ctx.scale(scale, scale);
                    ctx.translate(-q.x, -q.y);
                    drawPoint(ctx, canvas, Q.x, Q.y, '#f97316', 6, 'Q');
                    ctx.restore();
                }

                // Draw connecting line with animated dash
                if (P.x !== null && Q.x !== null && phase2Raw > 0) {
                    const p = map(P.x, P.y);
                    const q = map(Q.x, Q.y);
                    const lineProgress = phase2;
                    const currentX = p.x + (q.x - p.x) * lineProgress;
                    const currentY = p.y + (q.y - p.y) * lineProgress;

                    // Animated dashed line
                    const dashOffset = (now / 50) % 10;
                    ctx.strokeStyle = '#60a5fa';
                    ctx.lineWidth = 3;
                    ctx.setLineDash([8, 4]);
                    ctx.lineDashOffset = -dashOffset;
                    ctx.globalAlpha = 0.8;
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(currentX, currentY);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.globalAlpha = 1;

                    // Draw animated point at line end
                    if (phase2Raw > 0.1) {
                        const pulseSize = 4 + Math.sin(now / 100) * 2;
                        ctx.fillStyle = '#60a5fa';
                        ctx.beginPath();
                        ctx.arc(currentX, currentY, pulseSize, 0, 2 * Math.PI);
                        ctx.fill();
                    }
                }

                // Draw R with entrance animation and celebration effects
                if (R.x !== null && phase3Raw > 0) {
                    const r = map(R.x, R.y);

                    // Multiple glow rings
                    if (phase3Raw < 1) {
                        for (let i = 0; i < 3; i++) {
                            const ringDelay = i * 0.15;
                            const ringProgress = Math.max(0, Math.min(1, (phase3Raw - ringDelay) / (1 - ringDelay)));
                            if (ringProgress > 0) {
                                ctx.globalAlpha = (1 - ringProgress) * 0.3;
                                ctx.fillStyle = '#10b981';
                                ctx.beginPath();
                                ctx.arc(r.x, r.y, 10 + ringProgress * 25, 0, 2 * Math.PI);
                                ctx.fill();
                            }
                        }
                        ctx.globalAlpha = 1;
                    }

                    const scale = Math.min(1.2, phase3);
                    ctx.save();
                    ctx.translate(r.x, r.y);
                    ctx.scale(scale, scale);
                    ctx.translate(-r.x, -r.y);
                    drawPoint(ctx, canvas, R.x, R.y, '#166534', 7, 'R');
                    ctx.restore();

                    // Rotating sparkle effect
                    if (phase3Raw > 0.3 && phase3Raw < 0.9) {
                        const sparkleT = (phase3Raw - 0.3) / 0.6;
                        const numSparkles = 6;
                        for (let i = 0; i < numSparkles; i++) {
                            const angle = (i / numSparkles) * Math.PI * 2 + sparkleT * Math.PI * 2;
                            const distance = 15 + sparkleT * 10;
                            const sx = r.x + Math.cos(angle) * distance;
                            const sy = r.y + Math.sin(angle) * distance;
                            ctx.globalAlpha = (1 - sparkleT) * 0.8;
                            ctx.fillStyle = '#fbbf24';
                            ctx.beginPath();
                            ctx.arc(sx, sy, 2, 0, 2 * Math.PI);
                            ctx.fill();
                        }
                        ctx.globalAlpha = 1;
                    }
                }

                if (rawT < 1){ _fpAddAnim.raf = requestAnimationFrame(tick); }
                else { _fpAddAnim.active = false; _fpAddAnim.raf = null; visualizeAddition(P, Q, R); }
            };
            _fpAddAnim.raf = requestAnimationFrame(tick);
        }

        function renderFpScalarAll() {
            const canvas = document.getElementById('multiplicationCanvas');
            if (!canvas) return;
            const { ctx, cssWidth, cssHeight } = setupCanvas(canvas);
            clearCanvas(ctx, cssWidth, cssHeight);
            drawAxesGrid(ctx, canvas);
            // Always show the full discrete curve points (no labels)
            drawCurvePoints(ctx, canvas, '#8a8a8a', false);

            // Then draw the multiples (answer-related points)
            const showCoords = document.getElementById('multiplicationShowLabels')?.checked;

            // Precompute mapping helpers for coordinate label placement
            const padding = 50;
            const cW = (canvas.clientWidth || canvas.width);
            const cH = (canvas.clientHeight || canvas.height);
            const width = cW - 2 * padding;
            const height = cH - 2 * padding;
            const maxVal = Math.max(1, (currentCurve.p || 1) - 1);

            // Draw connecting lines between consecutive multiples
            ctx.strokeStyle = '#93c5fd';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 3]);
            ctx.globalAlpha = 0.4;
            for (let i = 1; i < fpScalarPoints.length; i++) {
                const prev = fpScalarPoints[i - 1];
                const curr = fpScalarPoints[i];
                if (!prev || !curr || prev.x === null || curr.x === null) continue;

                const x1 = padding + (prev.x / maxVal) * width;
                const y1 = cH - padding - (prev.y / maxVal) * height;
                const x2 = padding + (curr.x / maxVal) * width;
                const y2 = cH - padding - (curr.y / maxVal) * height;

                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            }
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;

            fpScalarPoints.forEach((pt, i) => {
                if (pt && pt.x !== null) {
                    // Always label points as 1P, 2P, ...
                    const lbl = `${i+1}P`;
                    drawPoint(ctx, canvas, pt.x, pt.y, '#166534', 6, lbl);

                     // If toggled, also show coordinates for these multiples only
                     if (showCoords) {
                        const x = padding + (pt.x / maxVal) * width;
                        const y = cH - padding - (pt.y / maxVal) * height;
                        const coord = `(${pt.x}, ${pt.y})`;
                        ctx.font = '10px monospace';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'bottom';
                        ctx.fillStyle = 'rgba(0,0,0,0.6)';
                        ctx.fillText(coord, x, y - 10 + 1);
                        ctx.fillStyle = '#bbb';
                        ctx.fillText(coord, x, y - 10);
                    }
                }
            });

            if (selectedMultiplicationIndex !== null && currentPoints[selectedMultiplicationIndex]) {
                drawSelectedHighlight(ctx, canvas, currentPoints[selectedMultiplicationIndex]);
            }
        }

        function renderFpScalarPartial(count, animTime) {
            const canvas = document.getElementById('multiplicationCanvas');
            if (!canvas) return;
            const { ctx, cssWidth, cssHeight } = setupCanvas(canvas);
            clearCanvas(ctx, cssWidth, cssHeight);
            drawAxesGrid(ctx, canvas);
            drawCurvePoints(ctx, canvas, '#8a8a8a', false);

            const padding = 50;
            const cW = (canvas.clientWidth || canvas.width);
            const cH = (canvas.clientHeight || canvas.height);
            const width = cW - 2 * padding;
            const height = cH - 2 * padding;
            const maxVal = Math.max(1, (currentCurve.p || 1) - 1);

            const n = Math.min(count, fpScalarPoints.length);

            // Draw connecting lines with animated trail effect
            ctx.strokeStyle = '#60a5fa';
            ctx.lineWidth = 2;
            for (let i = 1; i < n; i++) {
                const prev = fpScalarPoints[i - 1];
                const curr = fpScalarPoints[i];
                if (!prev || !curr || prev.x === null || curr.x === null) continue;

                const x1 = padding + (prev.x / maxVal) * width;
                const y1 = cH - padding - (prev.y / maxVal) * height;
                const x2 = padding + (curr.x / maxVal) * width;
                const y2 = cH - padding - (curr.y / maxVal) * height;

                // Fade older lines
                const isRecent = i >= n - 3;
                const lineAlpha = isRecent ? 0.7 : 0.3;
                ctx.globalAlpha = lineAlpha;
                ctx.setLineDash([5, 3]);
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            }
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;

            // Draw points with enhanced animations
            for (let i = 0; i < n; i++){
                const pt = fpScalarPoints[i];
                if (!pt || pt.x === null) continue;

                const x = padding + (pt.x / maxVal) * width;
                const y = cH - padding - (pt.y / maxVal) * height;

                // Calculate individual point animation state
                const isNewest = i === Math.floor(count) - 1;
                const fadeProgress = i === Math.floor(count) - 1 ? (count % 1) : 1;
                const easedFade = Easing.easeOutBack(fadeProgress);

                // Draw glow for newer points
                if (i >= n - 4) {
                    const glowProgress = (i - (n - 4)) / 4;
                    ctx.globalAlpha = 0.3 * (1 - fadeProgress);
                    ctx.fillStyle = '#10b981';
                    ctx.beginPath();
                    ctx.arc(x, y, 12 + glowProgress * 4, 0, 2 * Math.PI);
                    ctx.fill();
                }

                // Draw point with scale animation
                ctx.globalAlpha = Easing.easeOutCubic(fadeProgress);
                const scale = isNewest ? easedFade : 1;
                ctx.save();
                ctx.translate(x, y);
                ctx.scale(scale, scale);
                ctx.translate(-x, -y);
                const lbl = `${i+1}P`;
                drawPoint(ctx, canvas, pt.x, pt.y, '#166534', 6, lbl);
                ctx.restore();
                ctx.globalAlpha = 1;

                // Enhanced pulse effect on newest point
                if (isNewest && fadeProgress > 0.3) {
                    const pulsePhase = ((animTime || 0) / 100) % (Math.PI * 2);
                    const pulseSize = Math.sin(pulsePhase) * 3 + 3;
                    ctx.globalAlpha = 0.4 + Math.sin(pulsePhase) * 0.2;
                    ctx.strokeStyle = '#10b981';
                    ctx.lineWidth = 2.5;
                    ctx.beginPath();
                    ctx.arc(x, y, 10 + pulseSize, 0, 2 * Math.PI);
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                }

                // Trailing particle effect for newest point
                if (isNewest && fadeProgress > 0.5) {
                    const numParticles = 6;
                    for (let p = 0; p < numParticles; p++) {
                        const angle = (p / numParticles) * Math.PI * 2 + (animTime || 0) / 200;
                        const distance = 15 + fadeProgress * 5;
                        const px = x + Math.cos(angle) * distance;
                        const py = y + Math.sin(angle) * distance;
                        ctx.globalAlpha = (1 - fadeProgress) * 0.5;
                        ctx.fillStyle = '#fbbf24';
                        ctx.beginPath();
                        ctx.arc(px, py, 1.5, 0, 2 * Math.PI);
                        ctx.fill();
                    }
                    ctx.globalAlpha = 1;
                }
            }
        }

        function startFpMultiplicationAnimation(){
            if (!fpScalarPoints || !fpScalarPoints.length) { renderFpScalarAll(); return; }
            if (_fpMulAnim.raf) cancelAnimationFrame(_fpMulAnim.raf);
            _fpMulAnim.active = true;
            const start = performance.now();
            const per = 600; // ms per point (slower, smoother animation)
            const tick = (now)=>{
                const elapsed = now - start;
                const rawProgress = Math.min(fpScalarPoints.length, elapsed / per + 1);
                // Use easing for the overall timing
                const easedProgress = 1 + (rawProgress - 1) * Easing.easeOutCubic(Math.min(1, (rawProgress - 1) / (fpScalarPoints.length - 1)));
                const shownFloat = Math.min(fpScalarPoints.length, easedProgress);
                renderFpScalarPartial(shownFloat, now);
                if (shownFloat < fpScalarPoints.length) {
                    _fpMulAnim.raf = requestAnimationFrame(tick);
                } else {
                    _fpMulAnim.active = false; _fpMulAnim.raf = null;
                    renderFpScalarAll();
                }
            };
            _fpMulAnim.raf = requestAnimationFrame(tick);
        }

        function drawCurvePoints(ctx, canvas, color, showLabels=false) {
            const padding = 50;
            const cssWidth = (canvas.clientWidth || canvas.width);
            const cssHeight = (canvas.clientHeight || canvas.height);
            const width = cssWidth - 2 * padding;
            const height = cssHeight - 2 * padding;
            const maxVal = Math.max(1, (currentCurve.p || 1) - 1);
            
            currentPoints.forEach(point => {
                if (point.x !== null) {
                    const x = padding + (point.x / maxVal) * width;
                    const y = cssHeight - padding - (point.y / maxVal) * height;
                    
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.arc(x, y, 4, 0, 2 * Math.PI);
                    ctx.fill();

                    if (showLabels) {
                        ctx.fillStyle = '#4b5563';
                        ctx.font = '10px monospace';
                        ctx.fillText(`(${point.x},${point.y})`, x + 12, y - 12);
                    }
                }
            });
        }

        function drawPoint(ctx, canvas, px, py, color, size, label=null) {
            const padding = 50;
            const cssWidth = (canvas.clientWidth || canvas.width);
            const cssHeight = (canvas.clientHeight || canvas.height);
            const width = cssWidth - 2 * padding;
            const height = cssHeight - 2 * padding;
            const maxVal = Math.max(1, (currentCurve.p || 1) - 1);
            
            const x = padding + (px / maxVal) * width;
            const y = cssHeight - padding - (py / maxVal) * height;
            
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, 2 * Math.PI);
            ctx.fill();
            
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, size + 3, 0, 2 * Math.PI);
            ctx.stroke();

            if (label) {
                ctx.fillStyle = color;
                ctx.font = '12px Arial';
                ctx.fillText(`${label}`, x + size + 10, y - size - 10);
            }
        }

        function drawSelectedHighlight(ctx, canvas, point) {
            if (!point || point.x === null || point.y === null) return;
            const padding = 50;
            const cssWidth = (canvas.clientWidth || canvas.width);
            const cssHeight = (canvas.clientHeight || canvas.height);
            const width = cssWidth - 2 * padding;
            const height = cssHeight - 2 * padding;
            const maxVal = Math.max(1, (currentCurve.p || 1) - 1);

            const px = padding + (point.x / maxVal) * width;
            const py = cssHeight - padding - (point.y / maxVal) * height;

            // Draw red highlight point
            const color = '#f44336';
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(px, py, 7, 0, 2 * Math.PI);
            ctx.fill();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(px, py, 10, 0, 2 * Math.PI);
            ctx.stroke();

            // Draw coordinates above the point
            const label = `(${point.x}, ${point.y})`;
            ctx.font = '12px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            // slight shadow for readability
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillText(label, px, py - 12 + 1);
            ctx.fillStyle = color;
            ctx.fillText(label, px, py - 12);
        }

        function drawAxesGrid(ctx, canvas) {
            const padding = 50;
            const cssWidth = (canvas.clientWidth || canvas.width);
            const cssHeight = (canvas.clientHeight || canvas.height);
            const width = cssWidth - 2 * padding;
            const height = cssHeight - 2 * padding;
            const maxVal = Math.max(1, (currentCurve.p || 1) - 1);

            // Border (light theme)
            ctx.strokeStyle = '#ddd';
            ctx.lineWidth = 2;
            ctx.strokeRect(padding, padding, width, height);

            // Grid and ticks
            const desiredTicks = 8;
            const step = Math.max(1, Math.ceil(maxVal / desiredTicks));
            ctx.fillStyle = '#666';
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            for (let t = 0; t <= maxVal; t += step) {
                const x = padding + (t / maxVal) * width;
                const y = padding + (1 - t / maxVal) * height; // for y-axis labels
                // vertical grid line (light theme)
                ctx.strokeStyle = 'rgba(0,0,0,0.06)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x, padding);
                ctx.lineTo(x, padding + height);
                ctx.stroke();
                // x tick label
                ctx.fillStyle = '#666';
                ctx.fillText(`${t}`, x, padding + height + 6);
                // horizontal grid line
                ctx.beginPath();
                ctx.moveTo(padding, y);
                ctx.lineTo(padding + width, y);
                ctx.stroke();
                // y tick label
                ctx.textAlign = 'right';
                ctx.textBaseline = 'middle';
                ctx.fillText(`${t}`, padding - 6, y);
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
            }
            // Axis titles
            ctx.fillStyle = '#888';
            ctx.font = '11px Arial';
            ctx.fillText('x', padding + width, padding + height + 20);
            ctx.save();
            ctx.translate(padding - 20, padding);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText('y', 0, 0);
            ctx.restore();
        }

        // Load initial curve and handle resize for crisp rendering
        window.onload = () => {
            // If forced login, ensure overlay is visible before any heavy work
            if (shouldForceLogin()) {
                const ov = document.getElementById('authOverlay');
                if (ov) ov.classList.add('visible');
            }
            findAllPoints();
            window.addEventListener('resize', () => {
                redrawAllCurves();
                redrawRealCanvases();
            });
            attachCanvasClickHandlers();
            attachRealCanvasHandlers();
            initRealPointStatusWatchers();
            loadSession();
            initPresetMonitor();
            initValidation();
            // Load initial preset description
            loadCurvePreset('e97');
            // Initialize custom presets
            initCustomPresets();
            // Load completed tutorials
            const completedTutorials = localStorage.getItem('completed_tutorials');
            if (completedTutorials) {
                try {
                    tutorialState.completed = JSON.parse(completedTutorials);
                } catch (e) {
                    tutorialState.completed = [];
                }
            }
        };

        // Attach click handlers to canvases to show coordinates
        function attachCanvasClickHandlers() {
            const addCanvas = document.getElementById('additionCanvas');
            const mulCanvas = document.getElementById('multiplicationCanvas');

            if (addCanvas) {
                addCanvas.addEventListener('click', (e) => handleCanvasClick(e, addCanvas, 'additionPointInfo'));
            }
            if (mulCanvas) {
                mulCanvas.addEventListener('click', (e) => handleCanvasClick(e, mulCanvas, 'multiplicationPointInfo'));
            }
        }

        // Auth UI & API integration
        let cachedAuthSession = null;
        function shouldForceLogin(){
            try { if (localStorage.getItem('force_login') === '1') return true; } catch(_) {}
            const qs = new URLSearchParams(window.location.search);
            return qs.get('login') === '1';
        }

        async function loadSession() {
            try {
                const res = await fetch('/api/session', { credentials: 'same-origin' });
                const data = await res.json();
                cachedAuthSession = data || null;
                const force = shouldForceLogin();
                updateAuthUI(data);
                if (!data || !data.logged_in) {
                    if (!force) ensureGuestSession();
                }
            } catch (e) {
                // attempt guest if session fetch fails (unless we force login view)
                cachedAuthSession = null;
                updateAuthUI(null);
                if (!shouldForceLogin()) ensureGuestSession();
            }
        }

        function updateAuthUI(session) {
            cachedAuthSession = session || null;
            const overlay = document.getElementById('authOverlay');
            const profileBtn = document.getElementById('profileBtn');
            const profileName = document.getElementById('profileName');
            const isLoggedIn = !!(session && session.logged_in);
            const isGuest = !!(session && session.is_guest);
            const forceLogin = shouldForceLogin();
            // If forced login, show overlay even if currently a guest
            if (forceLogin && (!isLoggedIn || isGuest)) {
                if (overlay) overlay.classList.add('visible');
                if (profileBtn) profileBtn.style.display = 'none';
                // If currently guest, log out to clear session
                if (isGuest) { fetch('/api/logout', {method:'POST'}).catch(()=>{}); }
                try { localStorage.removeItem('force_login'); } catch(_) {}
                return;
            }
            // Default: do not auto-show overlay; we prefer guest by default
            if (overlay) overlay.classList.remove('visible');
            if (profileBtn) profileBtn.style.display = 'inline-flex';
            if (profileName) profileName.textContent = isLoggedIn ? `${session.username || 'user'}${isGuest ? ' (guest)' : ''}` : 'guest';
            const menuLogin = document.getElementById('menuLogin');
            const menuLogout = document.getElementById('menuLogout');
            if (menuLogin) menuLogin.style.display = isGuest ? 'block' : 'none';
            if (menuLogout) menuLogout.style.display = (isLoggedIn && !isGuest) ? 'block' : 'none';
            updateMenuUserInfo();
        }

        // Auto-create a guest session on first load
        let _guestAttempted = false;
        async function ensureGuestSession(){
            if (_guestAttempted) return; _guestAttempted = true;
            try {
                let res = await fetch('/api/auth/guest', {method:'POST', credentials:'same-origin'});
                if(!res.ok){ res = await fetch('/api/guest', {method:'POST', credentials:'same-origin'}); }
                loadSession();
            } catch(_){ /* ignore */ }
        }

        function openLoginModal(){
            const overlay = document.getElementById('authOverlay');
            if (overlay) overlay.classList.add('visible');
        }

        // Username-only auth: simple non-empty check
        function setErr(id, msg){ const el = document.getElementById(id); if(!el) return; el.textContent = msg||''; el.style.display = msg? 'block':'none'; }

        // Removed legacy overlay login/signup functions to reduce duplication

        // New card handlers following spec
        function hideAuthOverlay(){
            const overlay = document.getElementById('authOverlay');
            if (overlay) {
                overlay.classList.remove('visible');
            }
        }

        async function submitLoginCard(){
            const username = document.getElementById('loginUsername').value.trim();
            const password = document.getElementById('loginPassword').value;
            const msgEl = document.getElementById('authMsgOverlay');
            setErr('loginUsernameErr', !username? 'Username is required': '');
            setErr('loginPasswordErr', !password? 'Password is required': '');
            if(!username || !password) return;
            msgEl.textContent = 'Logging in...';
            // Try /api/auth/login then fallback to /api/login
            const payload = {username, password};
            try {
                let res = await fetch('/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload), credentials: 'same-origin'});
                if(!res.ok){
                    res = await fetch('/api/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload), credentials: 'same-origin'});
                }
                const data = await res.json();
                if(!res.ok || !data.success){
                    msgEl.textContent = data.message || 'Invalid credentials';
                    return;
                }
                msgEl.textContent = '';
                hideAuthOverlay();
                loadSession();
                showToast('Logged in successfully', 'success');
            } catch(e){
                msgEl.textContent = 'Login error';
            }
        }

        function openSignupPage(){ window.location.href = '/signup'; }

        async function continueAsGuestCard(){
            const msgEl = document.getElementById('authMsgOverlay');
            msgEl.textContent = '';
            try {
                let res = await fetch('/api/auth/guest', {method:'POST', credentials:'same-origin'});
                if(!res.ok){ res = await fetch('/api/guest', {method:'POST', credentials:'same-origin'}); }
                if(res.ok){ window.location.href = '/app'; return; }
            } catch(_){}
            try { localStorage.setItem('guest_session_id', (crypto && crypto.randomUUID? crypto.randomUUID(): String(Date.now()))); } catch(_) {}
            window.location.href = '/app';
        }

        async function doLogout() {
            try {
                await fetch('/api/logout', {method: 'POST', credentials: 'same-origin'});
                loadSession();
            } catch (e) { /* ignore */ }
        }

        // removed legacy continueAsGuest()

        // Profile menu
        function toggleProfileMenu() {
            const menu = document.getElementById('profileMenu');
            const btn = document.getElementById('profileBtn');
            const visible = !menu.classList.contains('visible');
            if (visible) menu.classList.add('visible'); else menu.classList.remove('visible');
            btn.setAttribute('aria-expanded', visible ? 'true' : 'false');
        }
        function hideProfileMenu() {
            const menu = document.getElementById('profileMenu');
            const btn = document.getElementById('profileBtn');
            if (menu) menu.classList.remove('visible');
            if (btn) btn.setAttribute('aria-expanded', 'false');
        }
        document.addEventListener('click', (e) => {
            const menu = document.getElementById('profileMenu');
            const btn = document.getElementById('profileBtn');
            if (!menu || !btn) return;
            if (!menu.contains(e.target) && !btn.contains(e.target)) hideProfileMenu();
        });

        // (unused) legacy auth view toggling removed

        function handleCanvasClick(event, canvas, infoId) {
            if (!currentPoints || currentPoints.length === 0) return;

            const rect = canvas.getBoundingClientRect();
            const clickX = event.clientX - rect.left;
            const clickY = event.clientY - rect.top;

            const idx = findNearestPointIndex(canvas, clickX, clickY);
            const info = document.getElementById(infoId);
            // Clear any text info; we draw labels inside the canvas instead
            if (info) info.textContent = '';

            if (canvas.id === 'additionCanvas') {
                selectedAdditionIndex = idx;
                if (window._lastAdditionP && window._lastAdditionQ && window._lastAdditionR && idx !== null) {
                    visualizeAddition(window._lastAdditionP, window._lastAdditionQ, window._lastAdditionR);
                } else {
                    redrawAdditionCanvas();
                }
            } else if (canvas.id === 'multiplicationCanvas') {
                // Only update selection for highlighting, don't clear results
                // unless user hasn't done a multiplication yet
                selectedMultiplicationIndex = idx;

                // If clicking on a different point than what was used for scalar mult,
                // clear the scalar multiplication results
                const pointSel = document.getElementById('scalarPointSelect');
                if (pointSel && idx !== null && parseInt(pointSel.value) !== idx) {
                    fpScalarPoints = [];
                    scalarSteps = [];
                    const resultDiv = document.getElementById('scalarResult');
                    if (resultDiv) resultDiv.innerHTML = '';
                }

                renderFpScalarAll();
            }
        }

        function findNearestPointIndex(canvas, clickX, clickY) {
            const padding = 50;
            const cssWidth = (canvas.clientWidth || canvas.width);
            const cssHeight = (canvas.clientHeight || canvas.height);
            const width = cssWidth - 2 * padding;
            const height = cssHeight - 2 * padding;
            const maxVal = Math.max(1, (currentCurve.p || 1) - 1);

            let bestIdx = null;
            let bestDist2 = Infinity;
            const threshold = 10; // px radius for selection

            for (let i = 0; i < currentPoints.length; i++) {
                const point = currentPoints[i];
                if (point.x === null || point.y === null) continue; // skip point at infinity
                const x = padding + (point.x / maxVal) * width;
                const y = cssHeight - padding - (point.y / maxVal) * height;
                const dx = x - clickX;
                const dy = y - clickY;
                const d2 = dx * dx + dy * dy;
                if (d2 < bestDist2) {
                    bestDist2 = d2;
                    bestIdx = i;
                }
            }

            if (bestIdx !== null && bestDist2 <= threshold * threshold) {
                return bestIdx;
            }
            return null;
        }

        // =================== REAL CURVES (over R) =================== //
        let realCurve = { a: -1, b: 1 };
        let realRange = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };
        let realP = null; // {x,y}
        let realQ = null; // {x,y}
        let realR = null; // {x,y}
        let realAdditionComputed = false;
        let realScalarSteps = [];
        let realScalarPoints = [];
        let realCurrentStep = 0;
        let realAnimInterval = null;
        let realPickPhase = 'P';
        const REAL_POINT_TOLERANCE = 1e-6;

        async function initRealCurve(){
            const a = parseFloat(document.getElementById('realParamA').value);
            const b = parseFloat(document.getElementById('realParamB').value);
            try {
                const res = await fetch('/api/init_real_curve', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({a, b}) });
                const data = await res.json();
                if (!res.ok || !data.success) {
                    alert(data.error || 'Invalid curve');
                    return;
                }
                realCurve = {a, b};
                // Use default range
                realRange = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };
                // reset selections
                realP = null; realQ = null; realR = null;
                redrawRealCanvases();
                startRealCurveDrawAnimation();
            } catch(e){ alert('Connection error'); }
        }

        function isPointOnRealCurveCoord(xVal, yVal) {
            const xNum = parseFloat(xVal);
            const yNum = parseFloat(yVal);
            if (Number.isNaN(xNum) || Number.isNaN(yNum)) return false;
            const expected = xNum * xNum * xNum + realCurve.a * xNum + realCurve.b;
            return Math.abs(yNum * yNum - expected) <= REAL_POINT_TOLERANCE;
        }

        function updateRealPointStatus(statusId, xId, yId) {
            const statusEl = document.getElementById(statusId);
            if (!statusEl) return false;
            const xVal = document.getElementById(xId)?.value;
            const yVal = document.getElementById(yId)?.value;
            if (!xVal || !yVal) {
                statusEl.textContent = 'Enter both coordinates';
                statusEl.classList.remove('valid', 'invalid');
                return false;
            }
            const valid = isPointOnRealCurveCoord(xVal, yVal);
            statusEl.textContent = valid ? 'Point on curve ✓' : 'Not on curve ✕';
            statusEl.classList.toggle('valid', valid);
            statusEl.classList.toggle('invalid', !valid);
            return valid;
        }

        function initRealPointStatusWatchers() {
            const pairs = [
                { status: 'realPoint1Status', x: 'realP1X', y: 'realP1Y' },
                { status: 'realPoint2Status', x: 'realP2X', y: 'realP2Y' },
                { status: 'realScalarPointStatus', x: 'realMulPX', y: 'realMulPY' },
            ];
            pairs.forEach(({ status, x, y }) => {
                const update = () => updateRealPointStatus(status, x, y);
                [x, y].forEach(id => {
                    const el = document.getElementById(id);
                    if (!el) return;
                    el.addEventListener('input', update);
                    el.addEventListener('change', update);
                });
                update();
            });
        }

        function attachRealCanvasHandlers(){
            const addCanvas = document.getElementById('realAdditionCanvas');
            const mulCanvas = document.getElementById('realMultiplicationCanvas');
            const curveCanvas = document.getElementById('realCurveCanvas');

            // Click selection with drag cancellation for addition/multiplication canvases
            if (addCanvas){
                addCanvas.addEventListener('click', (e) => {
                    if (_realPan.justPanned) { _realPan.justPanned = false; return; }
                    handleRealAdditionClick(e, addCanvas);
                });
            }
            if (mulCanvas){
                mulCanvas.addEventListener('click', (e) => {
                    if (_realPan.justPanned) { _realPan.justPanned = false; return; }
                    handleRealMultiplicationClick(e, mulCanvas);
                });
            }

            // Enable wheel-zoom on all real canvases
            [curveCanvas, addCanvas, mulCanvas].forEach(c => {
                if (!c) return;
                c.addEventListener('wheel', (e) => {
                    e.preventDefault();
                    const scale = e.deltaY < 0 ? 0.85 : 1.15; // zoom in/out
                    zoomRealAtCanvas(c, e.clientX, e.clientY, scale);
                }, { passive: false });
                // Vertical panning with drag
                c.addEventListener('mousedown', (e) => startRealPan(e, c));
                c.addEventListener('mousemove', (e) => updateRealPan(e));
                c.addEventListener('mouseleave', (e) => endRealPan(e));
            });
            window.addEventListener('mouseup', (e) => endRealPan(e));
        }

        function zoomRealAtCanvas(canvas, clientX, clientY, scale){
            const rect = canvas.getBoundingClientRect();
            const px = clientX - rect.left;
            const py = clientY - rect.top;
            const padding = 50;
            const cssWidth = (canvas.clientWidth || canvas.width);
            const cssHeight = (canvas.clientHeight || canvas.height);
            const width = Math.max(1, cssWidth - 2*padding);
            const height = Math.max(1, cssHeight - 2*padding);

            // Map pixel -> world coords
            const xRangeSpan = (realRange.xMax - realRange.xMin);
            const yRangeSpan = (realRange.yMax - realRange.yMin);
            const xWorld = realRange.xMin + ((px - padding) / width) * xRangeSpan;
            const yWorld = realRange.yMin + ((cssHeight - py - padding) / height) * yRangeSpan;

            // Keep the mouse-anchored point stationary in normalized coords
            const rX = (xWorld - realRange.xMin) / xRangeSpan;
            const rY = (yWorld - realRange.yMin) / yRangeSpan;

            const minSpan = 1e-3;
            const maxSpan = 1e6;
            const newXSpan = Math.min(maxSpan, Math.max(minSpan, xRangeSpan * scale));
            const newYSpan = Math.min(maxSpan, Math.max(minSpan, yRangeSpan * scale));

            let newXMin = xWorld - rX * newXSpan;
            let newYMin = yWorld - rY * newYSpan;
            let newXMax = newXMin + newXSpan;
            let newYMax = newYMin + newYSpan;

            realRange = { xMin: newXMin, xMax: newXMax, yMin: newYMin, yMax: newYMax };
            redrawRealCanvases();
        }

        // -------- Vertical Panning (drag) for real canvases ---------
        let _realPan = { dragging:false, lastX:0, lastY:0, totalDx:0, totalDy:0, justPanned:false };
        function startRealPan(e, canvas){
            _realPan.dragging = true;
            _realPan.canvas = canvas;
            _realPan.lastX = e.clientX;
            _realPan.lastY = e.clientY;
            _realPan.totalDx = 0;
            _realPan.totalDy = 0;
            e.preventDefault();
        }
        function updateRealPan(e){
            if (!_realPan.dragging) return;
            const c = _realPan.canvas; if (!c) return;
            const padding = 50;
            const cssWidth = (c.clientWidth || c.width);
            const cssHeight = (c.clientHeight || c.height);
            const width = Math.max(1, cssWidth - 2*padding);
            const height = Math.max(1, cssHeight - 2*padding);
            const dyPx = e.clientY - _realPan.lastY;
            const dxPx = e.clientX - _realPan.lastX;
            _realPan.lastX = e.clientX;
            _realPan.lastY = e.clientY;
            _realPan.totalDx += Math.abs(dxPx);
            _realPan.totalDy += Math.abs(dyPx);
            const ySpan = (realRange.yMax - realRange.yMin);
            const xSpan = (realRange.xMax - realRange.xMin);
            const worldPerPixel = ySpan / height;
            const deltaWorldY = dyPx * worldPerPixel; // drag down => move content down
            const worldPerPixelX = xSpan / width;
            const deltaWorldX = dxPx * worldPerPixelX; // drag right => move content right
            realRange = {
                xMin: realRange.xMin - deltaWorldX,
                xMax: realRange.xMax - deltaWorldX,
                yMin: realRange.yMin + deltaWorldY,
                yMax: realRange.yMax + deltaWorldY,
            };
            _realPan.justPanned = true;
            redrawRealCanvases();
            e.preventDefault();
        }
        function endRealPan(e){
            if (_realPan.dragging){
                _realPan.dragging = false;
                // keep justPanned true only if substantial movement
                if ((_realPan.totalDy + _realPan.totalDx) < 3) _realPan.justPanned = false;
            }
        }

        function redrawRealCanvases(){
            drawRealCurveOnly();
            drawRealAdditionScene();
            visualizeRealScalarStep(realCurrentStep);
        }

        function mapRealToCanvas(canvas, x, y){
            const padding = 50;
            const cssWidth = (canvas.clientWidth || canvas.width);
            const cssHeight = (canvas.clientHeight || canvas.height);
            const width = cssWidth - 2 * padding;
            const height = cssHeight - 2 * padding;
            const px = padding + (x - realRange.xMin) * (width / (realRange.xMax - realRange.xMin));
            const py = cssHeight - padding - (y - realRange.yMin) * (height / (realRange.yMax - realRange.yMin));
            return {px, py};
        }

        function drawRealAxesGrid(ctx, canvas){
            const padding = 50;
            const cssWidth = (canvas.clientWidth || canvas.width);
            const cssHeight = (canvas.clientHeight || canvas.height);
            const width = cssWidth - 2 * padding;
            const height = cssHeight - 2 * padding;

            // Border (light theme)
            ctx.strokeStyle = '#ddd';
            ctx.lineWidth = 2;
            ctx.strokeRect(padding, padding, width, height);

            // Grid and ticks
            const desiredTicks = 8;
            const xRange = realRange.xMax - realRange.xMin;
            const yRange = realRange.yMax - realRange.yMin;
            const xStep = niceStep(xRange / desiredTicks);
            const yStep = niceStep(yRange / desiredTicks);

            ctx.fillStyle = '#666';
            ctx.font = '10px monospace';

            // Vertical grid + ticks
            for (let x = Math.ceil(realRange.xMin / xStep) * xStep; x <= realRange.xMax + 1e-9; x += xStep){
                const {px} = mapRealToCanvas(canvas, x, 0);
                ctx.strokeStyle = 'rgba(0,0,0,0.06)';
                ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(px, padding); ctx.lineTo(px, padding + height); ctx.stroke();
                ctx.fillStyle = '#666';
                ctx.textAlign = 'center'; ctx.textBaseline = 'top';
                ctx.fillText(formatNum(x), px, padding + height + 6);
            }
            // Horizontal grid + ticks
            for (let y = Math.ceil(realRange.yMin / yStep) * yStep; y <= realRange.yMax + 1e-9; y += yStep){
                const {py} = mapRealToCanvas(canvas, 0, y);
                ctx.strokeStyle = 'rgba(0,0,0,0.06)';
                ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(padding, py); ctx.lineTo(padding + width, py); ctx.stroke();
                ctx.fillStyle = '#666';
                ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
                ctx.fillText(formatNum(y), padding - 6, py);
            }
            // Axes at 0
            ctx.strokeStyle = '#555';
            ctx.lineWidth = 1.5;
            // x-axis
            if (realRange.yMin < 0 && realRange.yMax > 0){
                const {py} = mapRealToCanvas(canvas, 0, 0);
                ctx.beginPath(); ctx.moveTo(padding, py); ctx.lineTo(padding + width, py); ctx.stroke();
            }
            // y-axis
            if (realRange.xMin < 0 && realRange.xMax > 0){
                const {px} = mapRealToCanvas(canvas, 0, 0);
                ctx.beginPath(); ctx.moveTo(px, padding); ctx.lineTo(px, padding + height); ctx.stroke();
            }
            // Axis titles
            ctx.fillStyle = '#888';
            ctx.font = '11px Arial';
            ctx.fillText('x', padding + width, padding + height + 20);
            ctx.save(); ctx.translate(padding - 20, padding); ctx.rotate(-Math.PI/2); ctx.fillText('y', 0, 0); ctx.restore();
        }

        function niceStep(raw){
            const pow10 = Math.pow(10, Math.floor(Math.log10(raw||1)));
            const frac = raw / pow10;
            let nice;
            if (frac < 1.5) nice = 1; else if (frac < 3) nice = 2; else if (frac < 7) nice = 5; else nice = 10;
            return nice * pow10;
        }
        function formatNum(n){
            const s = Math.abs(n) >= 1e4 || (Math.abs(n)>0 && Math.abs(n)<1e-3) ? n.toExponential(1) : (Math.round(n*100)/100).toString();
            return s;
        }

        // Track animation state for real curve initial draw
        let _realCurveAnim = { active:false, raf:null, t:0 };

        function drawRealCurveOnly(){
            const canvas = document.getElementById('realCurveCanvas');
            if (!canvas) return;
            const { ctx, cssWidth, cssHeight } = setupCanvas(canvas);
            clearCanvas(ctx, cssWidth, cssHeight);
            drawRealAxesGrid(ctx, canvas);
            drawRealCurve(ctx, canvas, realCurve.a, realCurve.b, _realCurveAnim.active ? Math.min(1,_realCurveAnim.t) : 1);
        }

        function drawRealCurve(ctx, canvas, a, b, progress=1){
            // Sample x values and draw y=+sqrt and y=-sqrt branches
            const steps = 800;
            const endI = Math.max(0, Math.floor(steps * Math.max(0, Math.min(1, progress))));
            let prevTop = null, prevBot = null;
            for (let i=0;i<=endI;i++){
                const x = realRange.xMin + (i/steps)*(realRange.xMax - realRange.xMin);
                const y2 = x*x*x + a*x + b;
                if (y2 >= 0){
                    const yTop = Math.sqrt(y2);
                    const yBot = -yTop;
                    const {px: pxTop, py: pyTop} = mapRealToCanvas(canvas, x, yTop);
                    const {px: pxBot, py: pyBot} = mapRealToCanvas(canvas, x, yBot);
                    ctx.strokeStyle = '#8a8a8a';
                    ctx.lineWidth = 2;
                    if (prevTop){ ctx.beginPath(); ctx.moveTo(prevTop.x, prevTop.y); ctx.lineTo(pxTop, pyTop); ctx.stroke(); }
                    if (prevBot){ ctx.beginPath(); ctx.moveTo(prevBot.x, prevBot.y); ctx.lineTo(pxBot, pyBot); ctx.stroke(); }
                    prevTop = {x: pxTop, y: pyTop};
                    prevBot = {x: pxBot, y: pyBot};
                } else {
                    prevTop = null; prevBot = null;
                }
            }
        }

        function startRealCurveDrawAnimation(){
            if (_realCurveAnim.raf) cancelAnimationFrame(_realCurveAnim.raf);
            _realCurveAnim = { active:true, raf:null, t:0 };
            const start = performance.now();
            const duration = 1800;
            const step = (now)=>{
                const rawT = Math.min(1, (now - start)/duration);
                _realCurveAnim.t = Easing.easeOutCubic(rawT); // Smooth easing
                drawRealCurveOnly();
                if (rawT < 1) _realCurveAnim.raf = requestAnimationFrame(step);
                else { _realCurveAnim.active=false; _realCurveAnim.raf=null; }
            };
            _realCurveAnim.raf = requestAnimationFrame(step);
        }

        function handleRealAdditionClick(event, canvas){
            const rect = canvas.getBoundingClientRect();
            const clickX = event.clientX - rect.left;
            const clickY = event.clientY - rect.top;
            // Map click to x, then pick nearest y on curve at that x
            const padding = 50;
            const cssWidth = (canvas.clientWidth || canvas.width);
            const cssHeight = (canvas.clientHeight || canvas.height);
            const width = cssWidth - 2*padding;
            const height = cssHeight - 2*padding;
            const x = realRange.xMin + ((clickX - padding) / width) * (realRange.xMax - realRange.xMin);
            const y2 = x*x*x + realCurve.a*x + realCurve.b;
            if (y2 < 0) { return; }
            const yTop = Math.sqrt(y2);
            const yBot = -yTop;
            // decide which branch is closer to click
            const topPy = cssHeight - padding - ( (yTop - realRange.yMin) * (height/(realRange.yMax - realRange.yMin)) );
            const botPy = cssHeight - padding - ( (yBot - realRange.yMin) * (height/(realRange.yMax - realRange.yMin)) );
            const pickY = (Math.abs(topPy - clickY) < Math.abs(botPy - clickY)) ? yTop : yBot;

            const modeEl = document.getElementById('realSelectMode');
            const mode = realPickPhase || (modeEl?.value) || 'P';
            if (mode === 'P') {
                realP = {x, y: pickY};
                document.getElementById('realP1X').value = x; document.getElementById('realP1Y').value = pickY;
                realPickPhase = 'Q'; if (modeEl) modeEl.value = 'Q';
            } else {
                realQ = {x, y: pickY};
                document.getElementById('realP2X').value = x; document.getElementById('realP2Y').value = pickY;
                realPickPhase = 'P'; if (modeEl) modeEl.value = 'P';
            }
            realAdditionComputed = false;
            realR = null;
            updateRealPointStatus('realPoint1Status','realP1X','realP1Y');
            updateRealPointStatus('realPoint2Status','realP2X','realP2Y');
            drawRealAdditionScene();
        }

        function handleRealMultiplicationClick(event, canvas){
            // Map click to a point on the curve and set P for scalar multiplication
            const rect = canvas.getBoundingClientRect();
            const clickX = event.clientX - rect.left;
            const clickY = event.clientY - rect.top;
            const padding = 50;
            const cssWidth = (canvas.clientWidth || canvas.width);
            const cssHeight = (canvas.clientHeight || canvas.height);
            const width = cssWidth - 2*padding;
            const height = cssHeight - 2*padding;

            const x = realRange.xMin + ((clickX - padding) / width) * (realRange.xMax - realRange.xMin);
            const y2 = x*x*x + realCurve.a*x + realCurve.b;
            if (y2 < 0) return; // click x where curve has no real point
            const yTop = Math.sqrt(y2);
            const yBot = -yTop;
            const topPy = cssHeight - padding - ( (yTop - realRange.yMin) * (height/(realRange.yMax - realRange.yMin)) );
            const botPy = cssHeight - padding - ( (yBot - realRange.yMin) * (height/(realRange.yMax - realRange.yMin)) );
            const pickY = (Math.abs(topPy - clickY) < Math.abs(botPy - clickY)) ? yTop : yBot;

            const px = document.getElementById('realMulPX');
            const py = document.getElementById('realMulPY');
            if (px) px.value = x;
            if (py) py.value = pickY;

            // Clear previous scalar multiplication results
            realScalarPoints = [];
            realScalarSteps = [];
            realCurrentStep = 0;
            const resultDiv = document.getElementById('realScalarResult');
            if (resultDiv) resultDiv.innerHTML = '';

            // Preview on the multiplication canvas
            visualizeRealScalarStep(0);
            updateRealPointStatus('realScalarPointStatus','realMulPX','realMulPY');
        }

        async function addPointsReal(){
            const a = parseFloat(document.getElementById('realParamA').value);
            const b = parseFloat(document.getElementById('realParamB').value);
            const p1x = parseFloat(document.getElementById('realP1X').value);
            const p1y = parseFloat(document.getElementById('realP1Y').value);
            const p2x = parseFloat(document.getElementById('realP2X').value);
            const p2y = parseFloat(document.getElementById('realP2Y').value);
            const resDiv = document.getElementById('realAdditionResult');
            if ([p1x,p1y,p2x,p2y].some(v => Number.isNaN(v))) {
                resDiv.innerHTML = '<div class="error">Please provide P and Q</div>';
                return;
            }
            // Validate range bounds
            const within = (x,y) => x>=realRange.xMin && x<=realRange.xMax && y>=realRange.yMin && y<=realRange.yMax;
            if (!within(p1x,p1y) || !within(p2x,p2y)){
                resDiv.innerHTML = `<div class="error">Points must lie within [${realRange.xMin}, ${realRange.xMax}] × [${realRange.yMin}, ${realRange.yMax}]</div>`;
                return;
            }
            const p1Valid = updateRealPointStatus('realPoint1Status','realP1X','realP1Y');
            const p2Valid = updateRealPointStatus('realPoint2Status','realP2X','realP2Y');
            if (!p1Valid || !p2Valid) {
                resDiv.innerHTML = '<div class="error">Points must lie on the curve</div>';
                return;
            }
            realAdditionComputed = false;
            realR = null;
            resDiv.innerHTML = '<p style="color:#888;">Calculating...</p>';
            try{
                const r = await fetch('/api/add_points_real',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({a, b, p1:{x:p1x,y:p1y,display:''}, p2:{x:p2x,y:p2y,display:''}})});
                const data = await r.json();
                if (!r.ok || !data.success){ resDiv.innerHTML = `<div class="error">${data.error||'Error'}</div>`; return; }
                realCurve = {a,b};
                realP = {x:p1x, y:p1y};
                realQ = {x:p2x, y:p2y};
                realR = data.result.x === null ? null : {x:data.result.x, y:data.result.y};
                realAdditionComputed = true;
                const resultText = `P = (${formatNum(p1x)}, ${formatNum(p1y)}), Q = (${formatNum(p2x)}, ${formatNum(p2y)}), P + Q = ${realR ? `(${formatNum(realR.x)}, ${formatNum(realR.y)})` : 'O'}`;

                // Build steps HTML
                let stepsHtml = '';
                if (data.steps && data.steps.length > 0) {
                    stepsHtml = `
                        <div class="steps-container">
                            <h4>Calculation Steps</h4>
                            ${data.steps.map((step, i) => `
                                <div class="step-item">
                                    <div class="step-header">
                                        <span>${step}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `;
                }

                resDiv.innerHTML = `
                    <div class="operation-result">
                        <strong>P</strong> = (${formatNum(p1x)}, ${formatNum(p1y)})<br>
                        <strong>Q</strong> = (${formatNum(p2x)}, ${formatNum(p2y)})<br>
                        <strong>P + Q</strong> = ${realR?`(${formatNum(realR.x)}, ${formatNum(realR.y)})`:'O'}
                    </div>
                    ${stepsHtml}
                    <div class="copy-btn-group">
                        <button class="copy-btn" onclick="copyResultAsText('${resultText}', 'Addition result')">📋 Copy Text</button>
                        <button class="copy-btn" onclick='copyResultAsJSON({P: {x: ${p1x}, y: ${p1y}}, Q: {x: ${p2x}, y: ${p2y}}, result: ${JSON.stringify(data.result)}, steps: ${JSON.stringify(data.steps || [])}}, "Addition result")'>📄 Copy JSON</button>
                    </div>
                    `;
                drawRealAdditionScene();
                // reset auto-pick to P after calculation
                realPickPhase = 'P'; const _modeEl = document.getElementById('realSelectMode'); if (_modeEl) _modeEl.value = 'P';
                startRealAdditionAnimation();
                const realAddVisible = document.getElementById('realAdditionToggleStepsBtn')?.getAttribute('data-visible') !== 'false';
                applyStepsVisibility('realAddition', realAddVisible);
            }catch(e){ resDiv.innerHTML = '<div class="error">Connection error</div>'; }
        }

        function drawRealAdditionScene(){
            const canvas = document.getElementById('realAdditionCanvas');
            if (!canvas) return;
            const showLabels = document.getElementById('realAdditionShowLabels')?.checked;
            const { ctx, cssWidth, cssHeight } = setupCanvas(canvas);
            clearCanvas(ctx, cssWidth, cssHeight);
            drawRealAxesGrid(ctx, canvas);
            drawRealCurve(ctx, canvas, realCurve.a, realCurve.b);

            // Draw points and line
            if (realP){ drawRealPoint(ctx, canvas, realP, '#2563eb', 'P', showLabels); }
            if (realQ){ drawRealPoint(ctx, canvas, realQ, '#f97316', 'Q', showLabels); }
            if (realP && realQ && realAdditionComputed && !(_realAddAnim && _realAddAnim.active)){
                let m;
                if (Math.abs(realP.x - realQ.x) < 1e-12 && Math.abs(realP.y - realQ.y) < 1e-12) {
                    if (Math.abs(realP.y) < 1e-12) { m = null; } else { m = (3*realP.x*realP.x + realCurve.a) / (2*realP.y); }
                } else {
                    if (Math.abs(realQ.x - realP.x) < 1e-12) { m = null; } else { m = (realQ.y - realP.y) / (realQ.x - realP.x); }
                }
                if (Number.isFinite(m)){
                    // draw chord/tangent line across the viewport
                    const x1 = realRange.xMin, x2 = realRange.xMax;
                    const yAt = (x) => m*(x - realP.x) + realP.y;
                    const pA = mapRealToCanvas(canvas, x1, yAt(x1));
                    const pB = mapRealToCanvas(canvas, x2, yAt(x2));
                    ctx.strokeStyle = '#999'; ctx.lineWidth = 1.5;
                    ctx.beginPath(); ctx.moveTo(pA.px, pA.py); ctx.lineTo(pB.px, pB.py); ctx.stroke();
                }
            }
            if (realR){
                // -R (reflection across x-axis)
                const minusR = {x: realR.x, y: -realR.y};
                drawRealPoint(ctx, canvas, minusR, '#9ca3af', '-R', showLabels);
                drawRealPoint(ctx, canvas, realR, '#166534', 'R', showLabels);
                // reflection helper line
                const up = mapRealToCanvas(canvas, realR.x, realR.y);
                const dn = mapRealToCanvas(canvas, minusR.x, minusR.y);
                ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.setLineDash([4,4]);
                ctx.beginPath(); ctx.moveTo(up.px, up.py); ctx.lineTo(dn.px, dn.py); ctx.stroke(); ctx.setLineDash([]);
            }
        }

        // Animated addition for real curves
        let _realAddAnim = { active:false, raf:null };
        function startRealAdditionAnimation(){
            if (!realP || !realQ) return;
            if (_realAddAnim.raf) cancelAnimationFrame(_realAddAnim.raf);
            _realAddAnim = { active:true, raf:null };
            const start = performance.now();
            const phaseDur = { line: 1000, hold: 300, reflect: 900, reveal: 400 };
            const x1 = realRange.xMin, x2 = realRange.xMax;
            let m = null, vertical=false;
            if (Math.abs(realP.x - realQ.x) < 1e-12 && Math.abs(realP.y - realQ.y) < 1e-12) {
                if (Math.abs(realP.y) < 1e-12) vertical = true; else m = (3*realP.x*realP.x + realCurve.a) / (2*realP.y);
            } else { if (Math.abs(realQ.x - realP.x) < 1e-12) vertical = true; else m = (realQ.y - realP.y) / (realQ.x - realP.x); }
            const yAt = (x)=> m*(x - realP.x) + realP.y;
            const minusR = realR? {x: realR.x, y: -realR.y} : null;

            const tick = (now)=>{
                const elapsed = now - start;
                const t1Raw = Math.min(1, elapsed / phaseDur.line);
                const t1 = Easing.easeInOutCubic(t1Raw);
                const t2Raw = Math.min(1, Math.max(0, (elapsed - phaseDur.line - phaseDur.hold) / phaseDur.reflect));
                const t2 = Easing.easeInOutCubic(t2Raw);
                const t3Raw = Math.min(1, Math.max(0, (elapsed - phaseDur.line - phaseDur.hold - phaseDur.reflect) / phaseDur.reveal));
                const t3 = Easing.easeOutBack(t3Raw);

                const canvas = document.getElementById('realAdditionCanvas');
                const { ctx, cssWidth, cssHeight } = setupCanvas(canvas);
                clearCanvas(ctx, cssWidth, cssHeight);
                drawRealAxesGrid(ctx, canvas);
                drawRealCurve(ctx, canvas, realCurve.a, realCurve.b);

                // Draw P and Q with pulsing glow
                const pGlow = Math.sin(now / 200) * 0.15 + 0.15;
                const qGlow = Math.sin(now / 200 + Math.PI) * 0.15 + 0.15;
                const pPos = mapRealToCanvas(canvas, realP.x, realP.y);
                const qPos = mapRealToCanvas(canvas, realQ.x, realQ.y);

                ctx.globalAlpha = pGlow;
                ctx.fillStyle = '#2563eb';
                ctx.beginPath();
                ctx.arc(pPos.px, pPos.py, 12, 0, 2 * Math.PI);
                ctx.fill();
                ctx.globalAlpha = 1;

                ctx.globalAlpha = qGlow;
                ctx.fillStyle = '#f97316';
                ctx.beginPath();
                ctx.arc(qPos.px, qPos.py, 12, 0, 2 * Math.PI);
                ctx.fill();
                ctx.globalAlpha = 1;

                drawRealPoint(ctx, canvas, realP, '#2563eb', 'P', true);
                drawRealPoint(ctx, canvas, realQ, '#f97316', 'Q', true);

                // Animate chord/tangent line with animated dash
                if (t1Raw > 0) {
                    const dashOffset = (now / 50) % 12;
                    if (vertical){
                        const x = realP.x;
                        const yStart = realRange.yMin; const yEnd = realRange.yMax;
                        const a = mapRealToCanvas(canvas, x, yStart);
                        const b = mapRealToCanvas(canvas, x, yStart + t1*(yEnd - yStart));
                        ctx.strokeStyle = '#60a5fa';
                        ctx.lineWidth = 2.5;
                        ctx.setLineDash([6, 4]);
                        ctx.lineDashOffset = -dashOffset;
                        ctx.beginPath();
                        ctx.moveTo(a.px, a.py);
                        ctx.lineTo(b.px, b.py);
                        ctx.stroke();
                        ctx.setLineDash([]);
                    } else {
                        const xa = x1; const xb = x1 + t1*(x2 - x1);
                        const pA = mapRealToCanvas(canvas, xa, yAt(xa));
                        const pB = mapRealToCanvas(canvas, xb, yAt(xb));
                        ctx.strokeStyle = '#60a5fa';
                        ctx.lineWidth = 2.5;
                        ctx.setLineDash([6, 4]);
                        ctx.lineDashOffset = -dashOffset;
                        ctx.globalAlpha = 0.9;
                        ctx.beginPath();
                        ctx.moveTo(pA.px, pA.py);
                        ctx.lineTo(pB.px, pB.py);
                        ctx.stroke();
                        ctx.setLineDash([]);
                        ctx.globalAlpha = 1;
                    }
                }

                // Animated -R appearance
                if (minusR && elapsed > phaseDur.line){
                    const alpha = Easing.easeOutCubic(Math.min(1, (elapsed - phaseDur.line)/300));
                    ctx.globalAlpha = alpha;
                    drawRealPoint(ctx, canvas, minusR, '#9ca3af', '-R', true);
                    ctx.globalAlpha = 1;

                    // Glow effect for -R
                    if (alpha < 1) {
                        const minusRPos = mapRealToCanvas(canvas, minusR.x, minusR.y);
                        ctx.globalAlpha = (1 - alpha) * 0.4;
                        ctx.fillStyle = '#9ca3af';
                        ctx.beginPath();
                        ctx.arc(minusRPos.px, minusRPos.py, 12 + (1 - alpha) * 8, 0, 2 * Math.PI);
                        ctx.fill();
                        ctx.globalAlpha = 1;
                    }
                }

                // Animated reflection line
                if (realR && elapsed > phaseDur.line + phaseDur.hold){
                    const up = mapRealToCanvas(canvas, realR.x, realR.y);
                    const dn = mapRealToCanvas(canvas, realR.x, -realR.y);
                    const midY = up.py + t2*(dn.py - up.py);
                    ctx.strokeStyle = 'rgba(96, 165, 250, 0.6)';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([5,5]);
                    ctx.beginPath();
                    ctx.moveTo(up.px, up.py);
                    ctx.lineTo(up.px, midY);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }

                // Animated R reveal with celebration effects
                if (realR && elapsed > phaseDur.line + phaseDur.hold + phaseDur.reflect){
                    const rPos = mapRealToCanvas(canvas, realR.x, realR.y);

                    // Multiple expanding rings
                    if (t3Raw < 1) {
                        for (let i = 0; i < 3; i++) {
                            const ringDelay = i * 0.2;
                            const ringProgress = Math.max(0, Math.min(1, (t3Raw - ringDelay) / (1 - ringDelay)));
                            if (ringProgress > 0) {
                                ctx.globalAlpha = (1 - ringProgress) * 0.35;
                                ctx.fillStyle = '#10b981';
                                ctx.beginPath();
                                ctx.arc(rPos.px, rPos.py, 8 + ringProgress * 20, 0, 2 * Math.PI);
                                ctx.fill();
                            }
                        }
                        ctx.globalAlpha = 1;
                    }

                    ctx.globalAlpha = Easing.easeOutCubic(t3Raw);
                    drawRealPoint(ctx, canvas, realR, '#166534', 'R', true);
                    ctx.globalAlpha = 1;

                    // Sparkle effect
                    if (t3Raw > 0.2 && t3Raw < 0.8) {
                        const sparkleT = (t3Raw - 0.2) / 0.6;
                        const numSparkles = 8;
                        for (let i = 0; i < numSparkles; i++) {
                            const angle = (i / numSparkles) * Math.PI * 2 + sparkleT * Math.PI;
                            const distance = 12 + sparkleT * 8;
                            const sx = rPos.px + Math.cos(angle) * distance;
                            const sy = rPos.py + Math.sin(angle) * distance;
                            ctx.globalAlpha = (1 - sparkleT) * 0.7;
                            ctx.fillStyle = '#fbbf24';
                            ctx.beginPath();
                            ctx.arc(sx, sy, 2, 0, 2 * Math.PI);
                            ctx.fill();
                        }
                        ctx.globalAlpha = 1;
                    }
                }

                if (elapsed < (phaseDur.line + phaseDur.hold + phaseDur.reflect + phaseDur.reveal)){
                    _realAddAnim.raf = requestAnimationFrame(tick);
                } else {
                    _realAddAnim.active = false; _realAddAnim.raf = null; drawRealAdditionScene();
                }
            };
            _realAddAnim.raf = requestAnimationFrame(tick);
        }

        function drawRealPoint(ctx, canvas, pt, color, label, showLabel){
            const {px, py} = mapRealToCanvas(canvas, pt.x, pt.y);
            ctx.fillStyle = color; ctx.beginPath(); ctx.arc(px, py, 5, 0, 2*Math.PI); ctx.fill();
            if (showLabel){
                ctx.font = '12px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
                ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(`${label}(${formatNum(pt.x)}, ${formatNum(pt.y)})`, px, py - 12 + 1);
                ctx.fillStyle = color; ctx.fillText(`${label}(${formatNum(pt.x)}, ${formatNum(pt.y)})`, px, py - 12);
            }
        }

        function drawRealLineBetweenPoints(ctx, canvas, P, Q, color) {
            if (!P || !Q || P.x === null || P.y === null || Q.x === null || Q.y === null) return;
            const start = mapRealToCanvas(canvas, P.x, P.y);
            const end = mapRealToCanvas(canvas, Q.x, Q.y);
            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.moveTo(start.px, start.py);
            ctx.lineTo(end.px, end.py);
            ctx.stroke();
            ctx.restore();
        }

        async function scalarMultiplyReal(){
            const a = parseFloat(document.getElementById('realParamA').value);
            const b = parseFloat(document.getElementById('realParamB').value);
            const k = parseInt(document.getElementById('realK').value);
            const px = parseFloat(document.getElementById('realMulPX').value);
            const py = parseFloat(document.getElementById('realMulPY').value);
            const resDiv = document.getElementById('realScalarResult');
            if ([px,py].some(Number.isNaN) || Number.isNaN(k)){
                resDiv.innerHTML = '<div class="error">Enter P and k</div>';
                return;
            }
            const pointValid = updateRealPointStatus('realScalarPointStatus','realMulPX','realMulPY');
            if (!pointValid) {
                resDiv.innerHTML = '<div class="error">Point must lie on the curve</div>';
                return;
            }
            if (!(px>=realRange.xMin && px<=realRange.xMax && py>=realRange.yMin && py<=realRange.yMax)){
                resDiv.innerHTML = `<div class="error">Point P must lie within [${realRange.xMin}, ${realRange.xMax}] × [${realRange.yMin}, ${realRange.yMax}]</div>`;
                return;
            }
            resDiv.innerHTML = '<p style="color:#888;">Calculating...</p>';
            try{
                const r = await fetch('/api/scalar_multiply_real',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({a,b,k, point:{x:px,y:py,display:''}})});
                const data = await r.json();
                if (!r.ok || !data.success){ resDiv.innerHTML = `<div class=\"error\">${data.error||'Error'}</div>`; return; }
                realCurve = {a,b};
                realScalarSteps = data.steps || [];
                realScalarPoints = data.points || [];
                realCurrentStep = 0;
                startRealMultiplicationAnimation();
                const disp = data.result.display;
                const resultText = `P = (${formatNum(px)}, ${formatNum(py)}), k = ${k}, ${k} × P = ${disp}`;
                resDiv.innerHTML = `
                    <div class="operation-result">
                        <strong>P</strong> = (${formatNum(px)}, ${formatNum(py)})<br>
                        <strong>k</strong> = ${k}<br>
                        <strong>${k} × P</strong> = ${disp}
                    </div>
                    <div class="copy-btn-group">
                        <button class="copy-btn" onclick="copyResultAsText('${resultText}', 'Multiplication result')">📋 Copy Text</button>
                        <button class="copy-btn" onclick='copyResultAsJSON({P: {x: ${px}, y: ${py}}, k: ${k}, result: ${JSON.stringify(data.result)}, steps: ${JSON.stringify(data.steps || [])}}, "Multiplication result")'>📄 Copy JSON</button>
                    </div>
                    `;
                const realScalarVisible = document.getElementById('realScalarToggleStepsBtn')?.getAttribute('data-visible') !== 'false';
                applyStepsVisibility('realScalar', realScalarVisible);
            }catch(e){ resDiv.innerHTML = '<div class="error">Connection error</div>'; }
        }

        function visualizeRealScalarStep(step){
            const canvas = document.getElementById('realMultiplicationCanvas');
            if (!canvas) return;
            const showLabels = document.getElementById('realMultiplicationShowLabels')?.checked;
            const { ctx, cssWidth, cssHeight } = setupCanvas(canvas);
            clearCanvas(ctx, cssWidth, cssHeight);
            drawRealAxesGrid(ctx, canvas);
            drawRealCurve(ctx, canvas, realCurve.a, realCurve.b);
            // Draw all computed multiples; always label as 1P, 2P, ...
            if (realScalarPoints && realScalarPoints.length){
                for (let i=0;i<realScalarPoints.length; i++){
                    const pt = realScalarPoints[i];
                    if (pt.x !== null){
                        // draw point
                        drawRealPoint(ctx, canvas, pt, '#64748b', '', false);
                        const pxy = mapRealToCanvas(canvas, pt.x, pt.y);
                        const lbl = `${i+1}P`;
                        // always draw 1P,2P label
                        ctx.font = '12px monospace';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'bottom';
                        ctx.fillStyle = 'rgba(0,0,0,0.6)';
                        ctx.fillText(lbl, pxy.px, pxy.py - 12 + 1);
                        ctx.fillStyle = '#bbb';
                        ctx.fillText(lbl, pxy.px, pxy.py - 12);
                        // if toggled, also show coordinates under the label
                        if (showLabels){
                            const coord = `(${formatNum(pt.x)}, ${formatNum(pt.y)})`;
                            ctx.fillStyle = 'rgba(0,0,0,0.6)';
                            ctx.fillText(coord, pxy.px, pxy.py - 26 + 1);
                            ctx.fillStyle = '#bbb';
                            ctx.fillText(coord, pxy.px, pxy.py - 26);
                        }
                    }
                }
            }
            // If no steps yet, draw the currently selected P from inputs (for preview)
            if (!realScalarPoints || realScalarPoints.length === 0){
                const px = parseFloat(document.getElementById('realMulPX').value);
                const py = parseFloat(document.getElementById('realMulPY').value);
                if (!Number.isNaN(px) && !Number.isNaN(py)){
                    // Only show if within current axis range
                    if (px>=realRange.xMin && px<=realRange.xMax && py>=realRange.yMin && py<=realRange.yMax){
                        drawRealPoint(ctx, canvas, {x:px, y:py}, '#2563eb', 'P', showLabels);
                    }
                }
            }
            // no step label
        }
        function renderRealScalarAll(){ visualizeRealScalarStep(0); }

        // Animate real multiplication by progressively revealing 1P..kP
        let _realMulAnim = { active:false, raf:null };
        function renderRealScalarPartial(count){
            const canvas = document.getElementById('realMultiplicationCanvas');
            if (!canvas) return;
            const showLabels = document.getElementById('realMultiplicationShowLabels')?.checked;
            const { ctx, cssWidth, cssHeight } = setupCanvas(canvas);
            clearCanvas(ctx, cssWidth, cssHeight);
            drawRealAxesGrid(ctx, canvas);
            drawRealCurve(ctx, canvas, realCurve.a, realCurve.b);
            const n = Math.floor(count);
            const fractionalPart = count - n;

            // Draw all connecting lines first (behind points)
            ctx.strokeStyle = '#60a5fa';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.6;
            for (let i = 1; i < n; i++){
                const prev = realScalarPoints[i - 1];
                const curr = realScalarPoints[i];
                if (!prev || !curr || prev.x === null || curr.x === null) continue;
                drawRealLineBetweenPoints(ctx, canvas, prev, curr, '#60a5fa');
            }
            ctx.globalAlpha = 1;

            // Draw points with effects
            for (let i = 0; i < n; i++){
                const pt = realScalarPoints[i];
                if (!pt || pt.x === null) continue;

                // Fade-in effect for last point
                if (i === n - 1 && fractionalPart < 1) {
                    ctx.globalAlpha = 0.3 + 0.7 * fractionalPart;
                }

                drawRealPoint(ctx, canvas, pt, '#64748b', '', false);
                const pxy = mapRealToCanvas(canvas, pt.x, pt.y);
                const lbl = `${i+1}P`;
                ctx.font = '12px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                ctx.fillText(lbl, pxy.px, pxy.py - 12 + 1);
                ctx.fillStyle = '#bbb';
                ctx.fillText(lbl, pxy.px, pxy.py - 12);
                if (showLabels){
                    const coord = `(${formatNum(pt.x)}, ${formatNum(pt.y)})`;
                    ctx.fillStyle = 'rgba(0,0,0,0.6)';
                    ctx.fillText(coord, pxy.px, pxy.py - 26 + 1);
                    ctx.fillStyle = '#bbb';
                    ctx.fillText(coord, pxy.px, pxy.py - 26);
                }

                ctx.globalAlpha = 1;

                // Pulse effect on the newest point
                if (i === n - 1 && fractionalPart > 0.5) {
                    const pulseT = (fractionalPart - 0.5) / 0.5;
                    ctx.strokeStyle = '#60a5fa';
                    ctx.lineWidth = 2;
                    ctx.globalAlpha = 1 - pulseT * 0.6;
                    ctx.beginPath();
                    ctx.arc(pxy.px, pxy.py, 8 + 8 * pulseT, 0, 2 * Math.PI);
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                }
            }
        }
        function startRealMultiplicationAnimation(){
            if (!realScalarPoints || !realScalarPoints.length){ renderRealScalarAll(); return; }
            if (_realMulAnim.raf) cancelAnimationFrame(_realMulAnim.raf);
            _realMulAnim.active = true;
            const start = performance.now();
            const per = 400; // ms per point (slightly slower for better visibility)
            const step = (now)=>{
                const elapsed = now - start;
                // Use fractional count for smoother animation
                const shownFloat = Math.min(realScalarPoints.length, elapsed / per + 1);
                renderRealScalarPartial(shownFloat);
                if (shownFloat < realScalarPoints.length){ _realMulAnim.raf = requestAnimationFrame(step); }
                else { _realMulAnim.active=false; _realMulAnim.raf=null; renderRealScalarAll(); }
            };
            _realMulAnim.raf = requestAnimationFrame(step);
        }

        function realPrevScalarStep(){ if (realCurrentStep>0){ realCurrentStep--; document.getElementById('realStepSlider').value = realCurrentStep; visualizeRealScalarStep(realCurrentStep); updateRealStepLabel(); } }
        function realNextScalarStep(){ if (realScalarSteps && realCurrentStep < realScalarSteps.length-1){ realCurrentStep++; document.getElementById('realStepSlider').value = realCurrentStep; visualizeRealScalarStep(realCurrentStep); updateRealStepLabel(); } }
        function onRealScalarSlider(v){ realCurrentStep = parseInt(v); visualizeRealScalarStep(realCurrentStep); updateRealStepLabel(); }
        function toggleRealScalarAnimation(){
            const btn = document.getElementById('realPlayPauseBtn');
            if (realAnimInterval){ clearInterval(realAnimInterval); realAnimInterval=null; btn.textContent='Play'; }
            else {
                btn.textContent='Pause';
                realAnimInterval = setInterval(()=>{
                    if (realScalarSteps && realCurrentStep < realScalarSteps.length - 1) { realNextScalarStep(); }
                    else { clearInterval(realAnimInterval); realAnimInterval=null; btn.textContent='Play'; realCurrentStep=0; }
                }, 1000);
            }
        }
        function updateRealStepLabel(){ document.getElementById('realStepLabel').textContent = `${realCurrentStep + 1}/${realScalarSteps.length}`; }
        // -------- Operation History (frontend) --------
        async function loadHistory(curveType){
            const endpoint = (curveType === 'fp') ? '/api/history/fp' : '/api/history/real';
            try{
                const res = await fetch(endpoint);
                const data = await res.json();
                displayHistory(curveType, Array.isArray(data)? data: (data.history || []));
            }catch(e){
                const el = document.getElementById(`${curveType}-history-list`);
                if (el) el.innerHTML = '<p style="color:#666; text-align:center;">Failed to load history</p>';
            }
        }

function getOperationIcon(type){
    if (!type) return '<i class="fa-solid fa-circle-question" aria-hidden="true"></i>';
    if (type.includes('add')) return '<i class="fa-solid fa-plus" aria-hidden="true"></i>';
    if (type.includes('multiply')) return '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
    if (type.includes('init')) return '<i class="fa-solid fa-cogs" aria-hidden="true"></i>';
    return '<i class="fa-solid fa-circle-question" aria-hidden="true"></i>';
}

        function formatTimestamp(ts){ return ts || ''; }

        function formatOperationDescription(item){
            try{
                const p = item.parameters || {};
                const r = item.result || {};
                if (item.operation_type === 'add_fp'){
                    return `Added ${p.P?.display||''} + ${p.Q?.display||''} = ${r.R?.display||''}`;
                }
                if (item.operation_type === 'multiply_fp'){
                    return `Multiplied ${p.k} × ${p.P?.display||''} = ${r.R?.display||''}`;
                }
                if (item.operation_type === 'init_fp'){
                    return `Init a=${p.a}, b=${p.b}, p=${p.p}`;
                }
                if (item.operation_type === 'add_real'){
                    return `Added (${p.P?.x?.toFixed?.(2)||p.P?.x}, ${p.P?.y?.toFixed?.(2)||p.P?.y}) + (${p.Q?.x?.toFixed?.(2)||p.Q?.x}, ${p.Q?.y?.toFixed?.(2)||p.Q?.y})`;
                }
                if (item.operation_type === 'multiply_real'){
                    return `Multiplied ${p.k} × (${p.P?.x?.toFixed?.(2)||p.P?.x}, ${p.P?.y?.toFixed?.(2)||p.P?.y})`;
                }
                if (item.operation_type === 'init_real'){
                    return `Init a=${p.a}, b=${p.b}`;
                }
            }catch(_){ }
            return '';
        }

        function displayHistory(curveType, history){
            const listElement = document.getElementById(`${curveType}-history-list`);
            if (!listElement) return;
            if (!history || history.length === 0){
                listElement.innerHTML = '<p style="color:#666; text-align:center;">No operations yet</p>';
                return;
            }
            listElement.innerHTML = history.map(item => {
                const icon = getOperationIcon(item.operation_type);
                const desc = formatOperationDescription(item);
                return `
                <div class="history-item" onclick="replayOperation(${item.id})">
                    <span class="operation-icon">${icon}</span>
                    <div class="operation-details">
                        <div class="operation-type">${item.operation_type}</div>
                        <div class="operation-params">${desc}</div>
                        <div class="timestamp">${formatTimestamp(item.timestamp)}</div>
                    </div>
                </div>`;
            }).join('');
        }

        async function replayOperation(historyId){
            try{
                const res = await fetch(`/api/history/replay/${historyId}`, {method:'POST'});
                const data = await res.json();
                if (!res.ok || !data.success){ alert('Could not replay'); return; }
                const ct = (data.curve_type || '').toLowerCase();
                const op = data.operation_type || '';
                // Ensure parent tab is active
                if (ct === 'fp') { switchTab('fpTab'); } else { switchTab('realTab'); }
                // Always reinitialize curve first
                await restoreCurveInit(ct, data.parameters);
                // Navigate to appropriate subtab and perform op
                if (op.includes('init')){
                    switchToOperationsSubtab(ct); // init pane
                } else if (op.includes('add')){
                    if (ct === 'fp') { switchSubtab('fp','fpAddPane'); }
                    else { switchSubtab('real','realAddPane'); }
                    await restorePointAddition(ct, data.parameters, data.result);
                } else if (op.includes('multiply')){
                    if (ct === 'fp') { switchSubtab('fp','fpMulPane'); }
                    else { switchSubtab('real','realMulPane'); }
                    await restoreScalarMultiplication(ct, data.parameters, data.result);
                } else {
                    switchToOperationsSubtab(ct);
                }
            }catch(_){ alert('Replay failed'); }
        }

        function switchToOperationsSubtab(ct){
            if (ct === 'fp') { switchSubtab('fp','fpInitPane'); }
            else { switchSubtab('real','realInitPane'); }
        }

        function refreshHistory(ct){ loadHistory(ct); }
        async function clearHistory(ct){ if (!confirm('Clear all history?')) return; await fetch(`/api/history/clear/${ct}`, {method:'DELETE'}); loadHistory(ct); }

        async function exportHistory(ct) {
            try {
                const response = await fetch(`/api/history/${ct}`);
                const data = await response.json();

                if (data.success && data.history) {
                    const blob = new Blob([JSON.stringify(data.history, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `elliptic-curve-history-${ct}-${new Date().toISOString().slice(0,10)}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    showToast('History exported successfully!', 'success');
                } else {
                    showToast('No history to export', 'warning');
                }
            } catch (error) {
                showToast('Failed to export history', 'error');
            }
        }

        // =================== UNIFIED HISTORY PANEL =================== //

        function toggleHistoryPanel() {
            const panel = document.getElementById('historyPanel');
            const overlay = document.getElementById('historyOverlay');
            const toggleBtn = document.querySelector('.history-toggle');

            const isOpen = panel.classList.contains('open');

            if (isOpen) {
                closeHistoryPanel();
            } else {
                openHistoryPanel();
            }
        }

        function openHistoryPanel() {
            const panel = document.getElementById('historyPanel');
            const overlay = document.getElementById('historyOverlay');
            const toggleBtn = document.querySelector('.history-toggle');

            panel.classList.add('open');
            overlay.classList.add('visible');
            toggleBtn.classList.add('active');

            // Update user info in menu
            updateMenuUserInfo();

            // Load history when opening
            loadUnifiedHistory();
        }

        // Update user info displayed in menu
        function updateMenuUserInfo() {
            const session = cachedAuthSession;
            const isLoggedIn = !!(session && session.logged_in && !session.is_guest);
            const userName = isLoggedIn ? (session.username || 'user') : null;
            const menuUserName = document.getElementById('menuUserName');
            const menuUserStatus = document.getElementById('menuUserStatus');
            const menuAuthBtn = document.getElementById('menuAuthBtn');

            if (isLoggedIn && userName) {
                if (menuUserName) menuUserName.textContent = userName;
                if (menuUserStatus) menuUserStatus.textContent = 'Signed in';
                if (menuAuthBtn) {
                    menuAuthBtn.textContent = 'Sign Out';
                    menuAuthBtn.onclick = () => {
                        doLogout();
                        closeHistoryPanel();
                    };
                }
            } else {
                if (menuUserName) menuUserName.textContent = 'Guest';
                if (menuUserStatus) menuUserStatus.textContent = 'Not signed in';
                if (menuAuthBtn) {
                    menuAuthBtn.textContent = 'Sign In';
                    menuAuthBtn.onclick = () => {
                        openLoginModal();
                        closeHistoryPanel();
                    };
                }
            }
        }

        function closeHistoryPanel() {
            const panel = document.getElementById('historyPanel');
            const overlay = document.getElementById('historyOverlay');
            const toggleBtn = document.querySelector('.history-toggle');

            panel.classList.remove('open');
            overlay.classList.remove('visible');
            toggleBtn.classList.remove('active');
        }

        async function loadUnifiedHistory() {
            try {
                // Fetch both Fp and Real history
                const [fpRes, realRes] = await Promise.all([
                    fetch('/api/history/fp'),
                    fetch('/api/history/real')
                ]);

                const fpData = await fpRes.json();
                const realData = await realRes.json();

                // Combine and sort by timestamp (most recent first)
                const fpHistory = (Array.isArray(fpData) ? fpData : (fpData.history || [])).map(item => ({
                    ...item,
                    curveType: 'Fp'
                }));
                const realHistory = (Array.isArray(realData) ? realData : (realData.history || [])).map(item => ({
                    ...item,
                    curveType: 'ℝ'
                }));

                const allHistory = [...fpHistory, ...realHistory];

                // Sort by ID (descending) - assuming higher ID = more recent
                allHistory.sort((a, b) => (b.id || 0) - (a.id || 0));

                displayUnifiedHistory(allHistory);
            } catch (error) {
                console.error('Failed to load unified history:', error);
                const listElement = document.getElementById('unifiedHistoryList');
                if (listElement) {
                    listElement.innerHTML = `
                        <div class="history-panel-empty">
                            <div class="history-panel-empty-icon">⚠️</div>
                            Failed to load history
                        </div>
                    `;
                }
            }
        }

        function displayUnifiedHistory(history) {
            const listElement = document.getElementById('unifiedHistoryList');
            if (!listElement) return;

            if (!history || history.length === 0) {
                listElement.innerHTML = `
                    <div class="history-panel-empty">
                        <div class="history-panel-empty-icon">📜</div>
                        No operations yet
                    </div>
                `;
                return;
            }

            listElement.innerHTML = history.map(item => {
                const icon = getOperationIcon(item.operation_type);
                const desc = formatOperationDescription(item);
                const curveTypeBadge = `<span style="background: ${item.curveType === 'Fp' ? 'var(--accent-primary)' : 'var(--accent-secondary)'}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.85em; margin-left: 8px;">${item.curveType}</span>`;

                return `
                    <div class="history-item" onclick="replayOperation(${item.id})">
                        <span class="operation-icon">${icon}</span>
                        <div class="operation-details">
                            <div class="operation-type">
                                ${item.operation_type}
                                ${curveTypeBadge}
                            </div>
                            <div class="operation-params">${desc}</div>
                            <div class="timestamp">${formatTimestamp(item.timestamp)}</div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        function refreshUnifiedHistory() {
            loadUnifiedHistory();
            showToast('History refreshed', 'info', 2000);
        }

        async function exportUnifiedHistory() {
            try {
                // Fetch both Fp and Real history
                const [fpRes, realRes] = await Promise.all([
                    fetch('/api/history/fp'),
                    fetch('/api/history/real')
                ]);

                const fpData = await fpRes.json();
                const realData = await realRes.json();

                const fpHistory = Array.isArray(fpData) ? fpData : (fpData.history || []);
                const realHistory = Array.isArray(realData) ? realData : (realData.history || []);

                const exportData = {
                    exported_at: new Date().toISOString(),
                    fp_operations: fpHistory,
                    real_operations: realHistory,
                    total_count: fpHistory.length + realHistory.length
                };

                const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `elliptic-curve-history-unified-${new Date().toISOString().slice(0,10)}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                showToast('History exported successfully!', 'success');
            } catch (error) {
                showToast('Failed to export history', 'error');
            }
        }

        async function clearUnifiedHistory() {
            if (!confirm('Clear all history for both Fp and ℝ curves?')) return;

            try {
                await Promise.all([
                    fetch('/api/history/clear/fp', { method: 'DELETE' }),
                    fetch('/api/history/clear/real', { method: 'DELETE' })
                ]);

                loadUnifiedHistory();
                showToast('All history cleared', 'success');
            } catch (error) {
                showToast('Failed to clear history', 'error');
            }
        }

        // Restore helpers
        async function restoreCurveInit(ct, params){
            if (ct === 'fp'){
                if (params){
                    document.getElementById('paramA').value = params.a;
                    document.getElementById('paramB').value = params.b;
                    if (params.p !== undefined) document.getElementById('paramP').value = params.p;
                }
                await findAllPoints();
            } else {
                if (params){
                    document.getElementById('realParamA').value = params.a;
                    document.getElementById('realParamB').value = params.b;
                }
                await initRealCurve();
            }
        }

        async function restorePointAddition(ct, params, result){
            if (ct === 'fp'){
                // Try to select P and Q by display text
                const pSel = document.getElementById('point1Select');
                const qSel = document.getElementById('point2Select');
                const setByDisplay = (sel, disp)=>{
                    if (!sel) return;
                    for (let i=0;i<sel.options.length;i++){ if (sel.options[i].textContent === (disp||'')) { sel.selectedIndex = i; break; } }
                };
                setByDisplay(pSel, params?.P?.display);
                setByDisplay(qSel, params?.Q?.display);
                await addPoints();
            } else {
                if (params?.P){ document.getElementById('realP1X').value = params.P.x; document.getElementById('realP1Y').value = params.P.y; }
                if (params?.Q){ document.getElementById('realP2X').value = params.Q.x; document.getElementById('realP2Y').value = params.Q.y; }
                await addPointsReal();
            }
        }

        async function restoreScalarMultiplication(ct, params, result){
            if (ct === 'fp'){
                const pSel = document.getElementById('scalarPointSelect');
                const setByDisplay = (sel, disp)=>{
                    if (!sel) return;
                    for (let i=0;i<sel.options.length;i++){ if (sel.options[i].textContent === (disp||'')) { sel.selectedIndex = i; break; } }
                };
                setByDisplay(pSel, params?.P?.display);
                document.getElementById('scalarValue').value = params?.k ?? 1;
                await scalarMultiply();
            } else {
                if (params?.P){ document.getElementById('realMulPX').value = params.P.x; document.getElementById('realMulPY').value = params.P.y; }
                document.getElementById('realK').value = params?.k ?? 1;
                await scalarMultiplyReal();
            }
        }

        // =================== ENCRYPTION SYSTEM =================== //

        // Global state for encryption
        let encryptionState = {
            initialized: false,
            curve: null,
            generator: null,
            privateKey: null,
            publicKey: null,
            allPoints: [],
            currentCiphertext: null,
            animationSteps: [],
            currentStep: 0,
            animationTimer: null,
            // Animation state
            animationTime: 0,
            animationFrame: null,
            particles: [],
            isAnimating: false,
            currentAnimationStep: 0,
            stepProgress: 0,
            dashOffset: 0
        };

        // Particle class for animations
        class Particle {
            constructor(x, y, color) {
                this.x = x;
                this.y = y;
                this.vx = (Math.random() - 0.5) * 3;
                this.vy = (Math.random() - 0.5) * 3;
                this.alpha = 1;
                this.decay = 0.015 + Math.random() * 0.015;
                this.color = color;
                this.size = 2 + Math.random() * 3;
            }

            update() {
                this.x += this.vx;
                this.y += this.vy;
                this.alpha -= this.decay;
                this.vx *= 0.98;
                this.vy *= 0.98;
            }

            draw(ctx) {
                ctx.save();
                ctx.globalAlpha = this.alpha;
                ctx.fillStyle = this.color;
                ctx.shadowColor = this.color;
                ctx.shadowBlur = 10;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            isDead() {
                return this.alpha <= 0;
            }
        }

        // Create particles at a point
        function createParticles(x, y, color, count = 15) {
            for (let i = 0; i < count; i++) {
                encryptionState.particles.push(new Particle(x, y, color));
            }
        }

        // Update and draw particles
        function updateParticles(ctx) {
            encryptionState.particles = encryptionState.particles.filter(p => {
                p.update();
                p.draw(ctx);
                return !p.isDead();
            });
        }

        function loadEncryptionPreset(presetKey) {
            const descEl = document.getElementById('encryptionCurveDesc');
            if (presetKey === 'custom') {
                descEl.textContent = 'Enter custom curve parameters';
                return;
            }

            const preset = curvePresets[presetKey];
            if (preset) {
                document.getElementById('encryptParamA').value = preset.a;
                document.getElementById('encryptParamB').value = preset.b;
                document.getElementById('encryptParamP').value = preset.p;
                descEl.textContent = preset.description;
            }
        }

        async function initEncryptionCurve() {
            const a = parseInt(document.getElementById('encryptParamA').value);
            const b = parseInt(document.getElementById('encryptParamB').value);
            const p = parseInt(document.getElementById('encryptParamP').value);

            if (isNaN(a) || isNaN(b) || isNaN(p)) {
                showToast('Please enter valid curve parameters', 'error');
                return;
            }

            showLoading('Initializing encryption system...');

            try {
                const response = await fetch('/api/encryption/init', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ a, b, p })
                });

                const data = await response.json();
                hideLoading();

                if (data.success) {
                    encryptionState.initialized = true;
                    encryptionState.curve = { a, b, p };
                    encryptionState.generator = data.generator;
                    encryptionState.privateKey = data.private_key;
                    encryptionState.publicKey = data.public_key;

                    // Display system information
                    const infoDiv = document.getElementById('encryptionSystemInfo');
                    infoDiv.innerHTML = '<div class="result-box success"><h3>✓ ' + data.message + '</h3><p>Total points on curve: ' + data.num_points + '</p></div>';

                    // Display key information
                    const keyInfoDiv = document.getElementById('encryptionKeyInfo');
                    keyInfoDiv.innerHTML = '<div class="result-box"><h3>Curve Parameters</h3><p><strong>Equation:</strong> y² = x³ + ' + a + 'x + ' + b + ' (mod ' + p + ')</p><p><strong>Generator G:</strong> (' + data.generator.x + ', ' + data.generator.y + ')</p><hr style="margin: 10px 0; border: none; border-top: 1px solid #444;"><h3>Your Keys</h3><p><strong>Private Key (d):</strong> ' + data.private_key + '</p><p><strong>Public Key (Q):</strong> (' + data.public_key.x + ', ' + data.public_key.y + ')</p><p style="font-size: 0.9em; color: #888; margin-top: 10px;">Q = d × G</p></div>';

                    // Enable operation buttons
                    document.getElementById('encryptOperationBtn').disabled = false;
                    document.getElementById('decryptOperationBtn').disabled = false;

                    showToast('Encryption system ready!', 'success');
                } else {
                    showToast('Error: ' + data.error, 'error');
                }
            } catch (error) {
                hideLoading();
                showToast('Failed to initialize encryption system', 'error');
                console.error(error);
            }
        }

        async function encryptMessage() {
            if (!encryptionState.initialized) {
                showToast('Please initialize the encryption system first', 'error');
                return;
            }

            const plaintext = document.getElementById('plaintextInput').value;
            const fileInput = document.getElementById('encryptionFileInput');
            const file = fileInput?.files?.[0];

            if (!plaintext && !file) {
                showToast('Please enter a message or upload a file to encrypt', 'error');
                return;
            }

            showLoading('Encrypting message...');

            try {
                let payload = { plaintext };
                if (file) {
                    let fileData;
                    try {
                        fileData = await readFileAsBase64(file);
                    } catch (readError) {
                        hideLoading();
                        showToast('Failed to read uploaded file', 'error');
                        console.error(readError);
                        return;
                    }
                    payload = {
                        file_name: file.name,
                        file_data: fileData
                    };
                }

                const response = await fetch('/api/encryption/encrypt', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();
                hideLoading();

                if (data.success) {
                    encryptionState.currentCiphertext = data.ciphertext;
                    encryptionState.animationSteps = data.steps;

                    const payloadLength = data.payload_length || 0;
                    const detailHtml = data.payload_type === 'file'
                        ? '<p><strong>File:</strong> ' + (data.file_name || data.payload_label || 'Uploaded file') + '</p>'
                        : '<p><strong>Original:</strong> "' + plaintext + '"</p>';

                    const resultDiv = document.getElementById('encryptionResult');
                    const ctJson = JSON.stringify(data.ciphertext, null, 2);
                    resultDiv.innerHTML = '<div class="result-box success"><h3>✓ Message Encrypted</h3>' + detailHtml + '<p><strong>Length:</strong> ' + payloadLength + ' bytes</p><hr style="margin: 10px 0; border: none; border-top: 1px solid #444;"><h4>Ciphertext:</h4><textarea readonly rows="6" style="width: 100%; font-family: monospace; font-size: 0.85em;">' + ctJson + '</textarea><button onclick="copyCiphertextToDecrypt()" style="margin-top: 10px;">Copy to Decrypt Tab</button></div>';

                    document.getElementById('encryptionStepsDisplay').innerHTML = '';
                    displayEncryptionSteps(data.steps);

                    drawEncryptionVisualization(data.ciphertext);

                    enableEncryptionAnimationControls(data.steps.length);

                    if (fileInput) {
                        fileInput.value = '';
                    }

                    showToast('Message encrypted successfully!', 'success');
                } else {
                    showToast('Error: ' + data.error, 'error');
                }
            } catch (error) {
                hideLoading();
                showToast('Failed to encrypt message', 'error');
                console.error(error);
            }
        }

        function readFileAsBase64(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    if (!reader.result) {
                        reject(new Error('Empty file data'));
                        return;
                    }
                    const text = reader.result;
                    const commaIndex = text.indexOf(',');
                    resolve(commaIndex >= 0 ? text.slice(commaIndex + 1) : text);
                };
                reader.onerror = () => reject(reader.error);
                reader.readAsDataURL(file);
            });
        }

        function readFileAsText(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    if (typeof reader.result !== 'string') {
                        reject(new Error('File reader did not return text'));
                        return;
                    }
                    resolve(reader.result);
                };
                reader.onerror = () => reject(reader.error);
                reader.readAsText(file);
            });
        }

        function isJsonFile(file) {
            if (!file) return false;
            const mime = (file.type || '').toLowerCase();
            const name = (file.name || '').toLowerCase();
            return mime.includes('json') || name.endsWith('.json');
        }

        function isValidCiphertextObject(obj) {
            if (!obj || typeof obj !== 'object') return false;
            if (!obj.R || typeof obj.R !== 'object') return false;
            if (!('x' in obj.R) || !('y' in obj.R)) return false;
            if (!Array.isArray(obj.encrypted)) return false;
            if (obj.encrypted.some(byte => typeof byte !== 'number')) return false;
            return true;
        }

        async function decryptMessage() {
            if (!encryptionState.initialized) {
                showToast('Please initialize the encryption system first', 'error');
                return;
            }

            const ciphertextField = document.getElementById('ciphertextInput');
            const fileInput = document.getElementById('decryptionFileInput');
            const file = fileInput?.files?.[0];
            let ciphertextText = '';

            if (file) {
                if (!isJsonFile(file)) {
                    showToast('Please upload a JSON ciphertext file', 'error');
                    return;
                }
                try {
                    ciphertextText = await readFileAsText(file);
                } catch (readError) {
                    showToast('Failed to read uploaded file', 'error');
                    console.error(readError);
                    return;
                }
                if (ciphertextField) {
                    ciphertextField.value = ciphertextText;
                }
            } else {
                ciphertextText = ciphertextField?.value || '';
            }

            if (!ciphertextText) {
                showToast('Please enter ciphertext to decrypt', 'error');
                return;
            }

            let ciphertext;
            try {
                ciphertext = JSON.parse(ciphertextText);
            } catch (e) {
                showToast('Invalid JSON format', 'error');
                return;
            }
            if (!isValidCiphertextObject(ciphertext)) {
                showToast('Ciphertext format is wrong', 'error');
                return;
            }

            showLoading('Decrypting message...');

            try {
                const response = await fetch('/api/encryption/decrypt', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ciphertext })
                });

                const data = await response.json();
                hideLoading();

                if (data.success) {
                    // Display result
                    const resultDiv = document.getElementById('decryptionResult');
                    resultDiv.innerHTML = '<div class="result-box success"><h3>✓ Message Decrypted</h3><p><strong>Decrypted Message:</strong></p><div style="padding: 15px; background: #2a2a2a; border-radius: 8px; margin: 10px 0;"><p style="font-size: 1.1em; color: #4ade80;">"' + data.plaintext + '"</p></div></div>';

                    // Display steps
                    displayDecryptionSteps(data.steps);

                    // Draw visualization
                    drawDecryptionVisualization(ciphertext, data.shared_secret_point);

                    if (fileInput) {
                        fileInput.value = '';
                    }

                    showToast('Message decrypted successfully!', 'success');
                } else {
                    showToast('Error: ' + data.error, 'error');
                }
            } catch (error) {
                hideLoading();
                showToast('Failed to decrypt message', 'error');
                console.error(error);
            }
        }

        function copyCiphertextToDecrypt() {
            const ciphertext = JSON.stringify(encryptionState.currentCiphertext, null, 2);
            document.getElementById('ciphertextInput').value = ciphertext;
            selectEncryptionPane('decryptPane');
            showToast('Ciphertext copied to decrypt tab', 'success');
        }

        function displayEncryptionSteps(steps) {
            const stepsDiv = document.getElementById('encryptionStepsDisplay');
            let html = '<div class="steps-container"><h3>Encryption Process:</h3>';
            steps.forEach((step, i) => {
                html += '<div class="step-item" id="encryptStep' + i + '"><div class="step-content">' + step + '</div></div>';
            });
            html += '</div>';
            stepsDiv.innerHTML = html;
        }

        function displayDecryptionSteps(steps) {
            const stepsDiv = document.getElementById('decryptionStepsDisplay');
            let html = '<div class="steps-container"><h3>Decryption Process:</h3>';
            steps.forEach((step, i) => {
                html += '<div class="step-item"><div class="step-content">' + step + '</div></div>';
            });
            html += '</div>';
            stepsDiv.innerHTML = html;
        }

        function drawEncryptionVisualization(ciphertext) {
            const canvas = document.getElementById('encryptionCanvas');
            if (!canvas) return;

            // Stop any existing animation
            if (encryptionState.animationFrame) {
                cancelAnimationFrame(encryptionState.animationFrame);
            }

            // Get k value from ciphertext
            const k = ciphertext.k;
            const { a, b, p } = encryptionState.curve;
            const G = encryptionState.generator;
            const Q = encryptionState.publicKey;

            // Compute intermediate steps for R = k × G
            const stepsR = [];
            let currentPoint = { x: null, y: null };
            for (let i = 1; i <= k; i++) {
                currentPoint = addPointsOnCurve(currentPoint, G, a, b, p);
                stepsR.push({ ...currentPoint });
            }

            // Compute intermediate steps for S = k × Q
            const stepsS = [];
            currentPoint = { x: null, y: null };
            for (let i = 1; i <= k; i++) {
                currentPoint = addPointsOnCurve(currentPoint, Q, a, b, p);
                stepsS.push({ ...currentPoint });
            }

            // Select key steps to show (max 5 steps to keep it simple)
            const maxDisplaySteps = 5;
            const displayIndices = [];
            if (k <= maxDisplaySteps) {
                for (let i = 0; i < k; i++) displayIndices.push(i);
            } else {
                const step = Math.floor(k / maxDisplaySteps);
                for (let i = 0; i < maxDisplaySteps - 1; i++) {
                    displayIndices.push(i * step);
                }
                displayIndices.push(k - 1); // Always show final
            }

            encryptionState.isAnimating = true;
            encryptionState.animationTime = 0;

            function animate() {
                const canvasData = setupCanvas(canvas);
                if (!canvasData) return;
                const { ctx, cssWidth, cssHeight } = canvasData;

                encryptionState.animationTime += 0.025;
                const time = encryptionState.animationTime;

                clearCanvas(ctx, cssWidth, cssHeight);
                drawEncryptionAxesGrid(ctx, cssWidth, cssHeight, p);
                drawEncryptionCurvePoints(ctx, cssWidth, cssHeight, a, b, p);

                // Phase 1: Computing R = k×G (0-2.5s)
                if (time < 2.5) {
                    drawOperationLabel(ctx, cssWidth, `Step 1: R = ${k} × G`, '#f59e0b');
                    drawEncryptionPointSimple(ctx, cssWidth, cssHeight, p, G, '#3b82f6', 'G');

                    const progress = time / 2.5;
                    const currentStep = Math.floor(progress * displayIndices.length);

                    // Draw previous steps (small and dimmed)
                    for (let i = 0; i < currentStep && i < displayIndices.length; i++) {
                        const idx = displayIndices[i];
                        const pt = stepsR[idx];
                        drawSmallPoint(ctx, cssWidth, cssHeight, p, pt, '#f59e0b', 0.4);

                        if (i > 0) {
                            const prevPt = stepsR[displayIndices[i-1]];
                            drawSimpleConnection(ctx, cssWidth, cssHeight, p, prevPt, pt, '#f59e0b', 0.25);
                        }
                    }

                    // Draw current step (highlighted)
                    if (currentStep < displayIndices.length) {
                        const idx = displayIndices[currentStep];
                        const pt = stepsR[idx];
                        const isLast = currentStep === displayIndices.length - 1;
                        const label = isLast ? 'R' : `${idx+1}G`;

                        drawEncryptionPointSimple(ctx, cssWidth, cssHeight, p, pt, '#f59e0b', label);

                        if (currentStep > 0) {
                            const prevPt = stepsR[displayIndices[currentStep-1]];
                            drawSimpleConnection(ctx, cssWidth, cssHeight, p, prevPt, pt, '#f59e0b', 0.7);
                        }
                    }

                // Phase 2: Computing S = k×Q (2.5-5s)
                } else if (time < 5) {
                    drawOperationLabel(ctx, cssWidth, `Step 2: S = ${k} × Q`, '#a855f7');

                    drawEncryptionPointSimple(ctx, cssWidth, cssHeight, p, G, '#3b82f6', 'G', 0.3);
                    drawEncryptionPointSimple(ctx, cssWidth, cssHeight, p, stepsR[k-1], '#f59e0b', 'R', 0.4);
                    drawEncryptionPointSimple(ctx, cssWidth, cssHeight, p, Q, '#10b981', 'Q');

                    const progress = (time - 2.5) / 2.5;
                    const currentStep = Math.floor(progress * displayIndices.length);

                    // Draw previous steps (small and dimmed)
                    for (let i = 0; i < currentStep && i < displayIndices.length; i++) {
                        const idx = displayIndices[i];
                        const pt = stepsS[idx];
                        drawSmallPoint(ctx, cssWidth, cssHeight, p, pt, '#a855f7', 0.4);

                        if (i > 0) {
                            const prevPt = stepsS[displayIndices[i-1]];
                            drawSimpleConnection(ctx, cssWidth, cssHeight, p, prevPt, pt, '#a855f7', 0.25);
                        }
                    }

                    // Draw current step (highlighted)
                    if (currentStep < displayIndices.length) {
                        const idx = displayIndices[currentStep];
                        const pt = stepsS[idx];
                        const isLast = currentStep === displayIndices.length - 1;
                        const label = isLast ? 'S' : `${idx+1}Q`;

                        drawEncryptionPointSimple(ctx, cssWidth, cssHeight, p, pt, '#a855f7', label);

                        if (currentStep > 0) {
                            const prevPt = stepsS[displayIndices[currentStep-1]];
                            drawSimpleConnection(ctx, cssWidth, cssHeight, p, prevPt, pt, '#a855f7', 0.7);
                        }
                    }

                } else {
                    // Final
                    drawOperationLabel(ctx, cssWidth, '✓ Encryption Complete', '#10b981');
                    drawEncryptionPointSimple(ctx, cssWidth, cssHeight, p, G, '#3b82f6', 'G', 0.3);
                    drawEncryptionPointSimple(ctx, cssWidth, cssHeight, p, Q, '#10b981', 'Q', 0.3);
                    drawEncryptionPointSimple(ctx, cssWidth, cssHeight, p, stepsR[k-1], '#f59e0b', 'R (Send)');
                    drawEncryptionPointSimple(ctx, cssWidth, cssHeight, p, stepsS[k-1], '#a855f7', 'S (Secret)');
                }

                if (encryptionState.isAnimating && time < 6.5) {
                    encryptionState.animationFrame = requestAnimationFrame(animate);
                }
            }

            animate();
        }

        function drawDecryptionVisualization(ciphertext, sharedSecret) {
            const canvas = document.getElementById('decryptionCanvas');
            if (!canvas) return;

            // Stop any existing animation
            if (encryptionState.animationFrame) {
                cancelAnimationFrame(encryptionState.animationFrame);
            }

            const { a, b, p } = encryptionState.curve;
            const R = ciphertext.R;
            const S = sharedSecret;
            const d = encryptionState.privateKey;
            const G = encryptionState.generator;
            const Q = encryptionState.publicKey;

            // Compute intermediate steps for S = d × R
            const stepsS = [];
            let currentPoint = { x: null, y: null };
            for (let i = 1; i <= d; i++) {
                currentPoint = addPointsOnCurve(currentPoint, R, a, b, p);
                stepsS.push({ ...currentPoint });
            }

            // Select key steps to show (max 5)
            const maxDisplaySteps = 5;
            const displayIndices = [];
            if (d <= maxDisplaySteps) {
                for (let i = 0; i < d; i++) displayIndices.push(i);
            } else {
                const step = Math.floor(d / maxDisplaySteps);
                for (let i = 0; i < maxDisplaySteps - 1; i++) {
                    displayIndices.push(i * step);
                }
                displayIndices.push(d - 1);
            }

            encryptionState.isAnimating = true;
            encryptionState.animationTime = 0;

            function animate() {
                const canvasData = setupCanvas(canvas);
                if (!canvasData) return;
                const { ctx, cssWidth, cssHeight } = canvasData;

                encryptionState.animationTime += 0.025;
                const time = encryptionState.animationTime;

                clearCanvas(ctx, cssWidth, cssHeight);
                drawEncryptionAxesGrid(ctx, cssWidth, cssHeight, p);
                drawEncryptionCurvePoints(ctx, cssWidth, cssHeight, a, b, p);

                // Show computation (0-3s)
                if (time < 3) {
                    drawOperationLabel(ctx, cssWidth, `Decryption: S = ${d} × R`, '#a855f7');

                    // Show context
                    drawEncryptionPointSimple(ctx, cssWidth, cssHeight, p, G, '#3b82f6', 'G', 0.25);
                    drawEncryptionPointSimple(ctx, cssWidth, cssHeight, p, Q, '#10b981', 'Q', 0.25);
                    drawEncryptionPointSimple(ctx, cssWidth, cssHeight, p, R, '#f59e0b', 'R');

                    // Show steps progressively
                    const progress = time / 3;
                    const currentStep = Math.floor(progress * displayIndices.length);

                    // Draw previous steps (small and dimmed)
                    for (let i = 0; i < currentStep && i < displayIndices.length; i++) {
                        const idx = displayIndices[i];
                        const pt = stepsS[idx];
                        drawSmallPoint(ctx, cssWidth, cssHeight, p, pt, '#a855f7', 0.4);

                        if (i > 0) {
                            const prevPt = stepsS[displayIndices[i-1]];
                            drawSimpleConnection(ctx, cssWidth, cssHeight, p, prevPt, pt, '#a855f7', 0.25);
                        }
                    }

                    // Draw current step (highlighted)
                    if (currentStep < displayIndices.length) {
                        const idx = displayIndices[currentStep];
                        const pt = stepsS[idx];
                        const isLast = currentStep === displayIndices.length - 1;
                        const label = isLast ? 'S' : `${idx+1}R`;

                        drawEncryptionPointSimple(ctx, cssWidth, cssHeight, p, pt, '#a855f7', label);

                        if (currentStep > 0) {
                            const prevPt = stepsS[displayIndices[currentStep-1]];
                            drawSimpleConnection(ctx, cssWidth, cssHeight, p, prevPt, pt, '#a855f7', 0.7);
                        }
                    }

                } else {
                    // Final
                    drawOperationLabel(ctx, cssWidth, '✓ Decryption Complete', '#10b981');
                    drawEncryptionPointSimple(ctx, cssWidth, cssHeight, p, G, '#3b82f6', 'G', 0.3);
                    drawEncryptionPointSimple(ctx, cssWidth, cssHeight, p, Q, '#10b981', 'Q', 0.3);
                    drawEncryptionPointSimple(ctx, cssWidth, cssHeight, p, R, '#f59e0b', 'R', 0.5);
                    drawEncryptionPointSimple(ctx, cssWidth, cssHeight, p, stepsS[d-1], '#a855f7', 'S (Secret!)');
                }

                if (encryptionState.isAnimating && time < 4.5) {
                    encryptionState.animationFrame = requestAnimationFrame(animate);
                }
            }

            animate();
        }

        // Helper functions for encryption visualization
        function drawEncryptionAxesGrid(ctx, cssWidth, cssHeight, p) {
            const padding = 50;
            const width = cssWidth - 2 * padding;
            const height = cssHeight - 2 * padding;
            const maxVal = Math.max(1, p - 1);

            // Background grid
            ctx.strokeStyle = 'rgba(100, 100, 100, 0.15)';
            ctx.lineWidth = 1;

            const step = Math.max(1, Math.ceil(maxVal / 10));
            for (let t = 0; t <= maxVal; t += step) {
                const x = padding + (t / maxVal) * width;
                const y = cssHeight - padding - (t / maxVal) * height;

                // Vertical lines
                ctx.beginPath();
                ctx.moveTo(x, padding);
                ctx.lineTo(x, cssHeight - padding);
                ctx.stroke();

                // Horizontal lines
                ctx.beginPath();
                ctx.moveTo(padding, y);
                ctx.lineTo(cssWidth - padding, y);
                ctx.stroke();
            }

            // Main axes
            ctx.strokeStyle = '#666';
            ctx.lineWidth = 2;
            ctx.strokeRect(padding, padding, width, height);

            // Axis labels
            ctx.fillStyle = '#888';
            ctx.font = '11px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';

            for (let t = 0; t <= maxVal; t += step) {
                const x = padding + (t / maxVal) * width;
                const y = cssHeight - padding - (t / maxVal) * height;

                // X-axis labels
                ctx.fillText(t.toString(), x, cssHeight - padding + 6);

                // Y-axis labels
                ctx.textAlign = 'right';
                ctx.textBaseline = 'middle';
                ctx.fillText(t.toString(), padding - 6, y);
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
            }

            // Axis titles
            ctx.fillStyle = '#aaa';
            ctx.font = '12px Arial';
            ctx.fillText('x', cssWidth - padding + 15, cssHeight - padding);
            ctx.save();
            ctx.translate(padding - 25, padding);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText('y', 0, 0);
            ctx.restore();
        }

        function drawEncryptionCurvePoints(ctx, cssWidth, cssHeight, a, b, p) {
            const padding = 50;
            const width = cssWidth - 2 * padding;
            const height = cssHeight - 2 * padding;
            const maxVal = Math.max(1, p - 1);

            ctx.fillStyle = 'rgba(150, 150, 150, 0.4)';

            for (let xVal = 0; xVal < p; xVal++) {
                const ySquared = (xVal * xVal * xVal + a * xVal + b) % p;
                for (let yVal = 0; yVal < p; yVal++) {
                    if ((yVal * yVal) % p === ySquared) {
                        const canvasX = padding + (xVal / maxVal) * width;
                        const canvasY = cssHeight - padding - (yVal / maxVal) * height;
                        ctx.beginPath();
                        ctx.arc(canvasX, canvasY, 2.5, 0, 2 * Math.PI);
                        ctx.fill();
                    }
                }
            }
        }

        // Simple point drawing for encryption visualization
        function drawEncryptionPointSimple(ctx, cssWidth, cssHeight, p, point, color, label, alpha = 1.0) {
            if (!point || point.x === null || point.y === null) return;

            const padding = 50;
            const width = cssWidth - 2 * padding;
            const height = cssHeight - 2 * padding;
            const maxVal = Math.max(1, p - 1);

            const x = padding + (point.x / maxVal) * width;
            const y = cssHeight - padding - (point.y / maxVal) * height;

            ctx.save();
            ctx.globalAlpha = alpha;

            // Draw point
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, 2 * Math.PI);
            ctx.fill();

            // Draw outline
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, 2 * Math.PI);
            ctx.stroke();

            // Draw label
            ctx.font = 'bold 12px Arial';
            ctx.fillStyle = color;
            ctx.fillText(label, x + 12, y - 10);

            // Point coordinates below
            const coordText = `(${point.x}, ${point.y})`;
            ctx.font = '10px monospace';
            ctx.fillStyle = '#aaa';
            ctx.textAlign = 'center';
            ctx.fillText(coordText, x, y + 20);
            ctx.textAlign = 'left';

            ctx.restore();
        }

        // Draw operation label at top of canvas
        function drawOperationLabel(ctx, cssWidth, text, color) {
            ctx.save();
            ctx.font = 'bold 14px Arial';
            ctx.fillStyle = color;
            ctx.textAlign = 'center';
            ctx.fillText(text, cssWidth / 2, 25);
            ctx.restore();
        }

        // Draw simple arrow between two points
        function drawSimpleArrow(ctx, cssWidth, cssHeight, p, fromPoint, toPoint, color, alpha) {
            if (!fromPoint || !toPoint || fromPoint.x === null || toPoint.x === null) return;

            const padding = 50;
            const width = cssWidth - 2 * padding;
            const height = cssHeight - 2 * padding;
            const maxVal = Math.max(1, p - 1);

            const x1 = padding + (fromPoint.x / maxVal) * width;
            const y1 = cssHeight - padding - (fromPoint.y / maxVal) * height;
            const x2 = padding + (toPoint.x / maxVal) * width;
            const y2 = cssHeight - padding - (toPoint.y / maxVal) * height;

            ctx.save();
            ctx.globalAlpha = alpha * 0.6;
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);

            // Draw line
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            // Draw arrowhead
            ctx.setLineDash([]);
            const angle = Math.atan2(y2 - y1, x2 - x1);
            const arrowSize = 8;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(x2, y2);
            ctx.lineTo(
                x2 - arrowSize * Math.cos(angle - Math.PI / 6),
                y2 - arrowSize * Math.sin(angle - Math.PI / 6)
            );
            ctx.lineTo(
                x2 - arrowSize * Math.cos(angle + Math.PI / 6),
                y2 - arrowSize * Math.sin(angle + Math.PI / 6)
            );
            ctx.closePath();
            ctx.fill();

            ctx.restore();
        }

        // Draw simple connecting line between points (for step progression)
        function drawSimpleConnection(ctx, cssWidth, cssHeight, p, fromPoint, toPoint, color, alpha) {
            if (!fromPoint || !toPoint || fromPoint.x === null || toPoint.x === null) return;

            const padding = 50;
            const width = cssWidth - 2 * padding;
            const height = cssHeight - 2 * padding;
            const maxVal = Math.max(1, p - 1);

            const x1 = padding + (fromPoint.x / maxVal) * width;
            const y1 = cssHeight - padding - (fromPoint.y / maxVal) * height;
            const x2 = padding + (toPoint.x / maxVal) * width;
            const y2 = cssHeight - padding - (toPoint.y / maxVal) * height;

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 3]);

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            ctx.restore();
        }

        // Draw small point (for previous steps in animation)
        function drawSmallPoint(ctx, cssWidth, cssHeight, p, point, color, alpha) {
            if (!point || point.x === null || point.y === null) return;

            const padding = 50;
            const width = cssWidth - 2 * padding;
            const height = cssHeight - 2 * padding;
            const maxVal = Math.max(1, p - 1);

            const x = padding + (point.x / maxVal) * width;
            const y = cssHeight - padding - (point.y / maxVal) * height;

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, 2 * Math.PI);
            ctx.fill();
            ctx.restore();
        }

        // Draw scalar multiplication steps (similar to Fp multiplication)
        function drawScalarMultiplicationSteps(ctx, cssWidth, cssHeight, p, steps, numToShow, color, basePointLabel) {
            if (!steps || steps.length === 0 || numToShow === 0) return;

            const padding = 50;
            const width = cssWidth - 2 * padding;
            const height = cssHeight - 2 * padding;
            const maxVal = Math.max(1, p - 1);

            // Draw connecting lines between consecutive points
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 3]);
            ctx.globalAlpha = 0.5;

            for (let i = 1; i < numToShow; i++) {
                const prev = steps[i - 1];
                const curr = steps[i];
                if (!prev || !curr || prev.x === null || curr.x === null) continue;

                const x1 = padding + (prev.x / maxVal) * width;
                const y1 = cssHeight - padding - (prev.y / maxVal) * height;
                const x2 = padding + (curr.x / maxVal) * width;
                const y2 = cssHeight - padding - (curr.y / maxVal) * height;

                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            }

            ctx.setLineDash([]);
            ctx.globalAlpha = 1;

            // Draw points with labels
            for (let i = 0; i < numToShow; i++) {
                const pt = steps[i];
                if (!pt || pt.x === null) continue;

                const x = padding + (pt.x / maxVal) * width;
                const y = cssHeight - padding - (pt.y / maxVal) * height;

                // Draw point
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(x, y, 5, 0, 2 * Math.PI);
                ctx.fill();

                // Draw outline
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(x, y, 7, 0, 2 * Math.PI);
                ctx.stroke();

                // Label as 1P, 2P, etc.
                const label = `${i + 1}${basePointLabel}`;
                ctx.font = 'bold 11px Arial';
                ctx.fillStyle = color;
                ctx.fillText(label, x + 10, y - 8);

                // Show coordinates for the last point being revealed
                if (i === numToShow - 1) {
                    const coordText = `(${pt.x}, ${pt.y})`;
                    ctx.font = '10px monospace';
                    ctx.fillStyle = '#aaa';
                    ctx.textAlign = 'center';
                    ctx.fillText(coordText, x, y + 18);
                    ctx.textAlign = 'left';
                }
            }
        }

        // Adaptive scalar multiplication step drawing (shows fewer steps if k is large)
        function drawScalarStepsAdaptive(ctx, cssWidth, cssHeight, p, steps, numToShow, progress, color, basePointLabel, stepInterval) {
            if (!steps || steps.length === 0 || numToShow === 0) return;

            const padding = 50;
            const width = cssWidth - 2 * padding;
            const height = cssHeight - 2 * padding;
            const maxVal = Math.max(1, p - 1);

            // Determine which steps to actually display (show fewer if many steps)
            const displayIndices = [];
            for (let i = 0; i < numToShow; i++) {
                if ((i + 1) % stepInterval === 0 || i === numToShow - 1) {
                    displayIndices.push(i);
                }
            }

            // Draw connecting lines between displayed steps
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 3]);
            ctx.globalAlpha = 0.5;

            for (let i = 1; i < displayIndices.length; i++) {
                const prevIdx = displayIndices[i - 1];
                const currIdx = displayIndices[i];
                const prev = steps[prevIdx];
                const curr = steps[currIdx];
                if (!prev || !curr || prev.x === null || curr.x === null) continue;

                const x1 = padding + (prev.x / maxVal) * width;
                const y1 = cssHeight - padding - (prev.y / maxVal) * height;
                const x2 = padding + (curr.x / maxVal) * width;
                const y2 = cssHeight - padding - (curr.y / maxVal) * height;

                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            }

            ctx.setLineDash([]);
            ctx.globalAlpha = 1;

            // Draw points with labels
            displayIndices.forEach((idx, displayIdx) => {
                const pt = steps[idx];
                if (!pt || pt.x === null) return;

                const x = padding + (pt.x / maxVal) * width;
                const y = cssHeight - padding - (pt.y / maxVal) * height;

                // Fade in the point smoothly
                const pointProgress = Math.min(1, (numToShow - idx) / 2);
                const alpha = Math.min(1, pointProgress);

                ctx.save();
                ctx.globalAlpha = alpha;

                // Draw point
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(x, y, 5, 0, 2 * Math.PI);
                ctx.fill();

                // Draw outline
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(x, y, 7, 0, 2 * Math.PI);
                ctx.stroke();

                // Label - show actual multiplication count
                const label = `${idx + 1}${basePointLabel}`;
                ctx.font = 'bold 11px Arial';
                ctx.fillStyle = color;
                ctx.fillText(label, x + 10, y - 8);

                // Show coordinates for the last point
                if (displayIdx === displayIndices.length - 1) {
                    const coordText = `(${pt.x}, ${pt.y})`;
                    ctx.font = '10px monospace';
                    ctx.fillStyle = '#aaa';
                    ctx.textAlign = 'center';
                    ctx.fillText(coordText, x, y + 18);
                    ctx.textAlign = 'left';
                }

                ctx.restore();
            });
        }

        // Highlighted point drawing with subtle pulse
        function drawEncryptionPointHighlighted(ctx, cssWidth, cssHeight, p, point, color, label, time, alpha = 1.0) {
            if (!point || point.x === null || point.y === null) return;

            const padding = 50;
            const width = cssWidth - 2 * padding;
            const height = cssHeight - 2 * padding;
            const maxVal = Math.max(1, p - 1);

            const x = padding + (point.x / maxVal) * width;
            const y = cssHeight - padding - (point.y / maxVal) * height;

            // Subtle pulse
            const pulse = 1 + Math.sin(time * 2.5) * 0.12;

            ctx.save();
            ctx.globalAlpha = alpha;

            // Outer glow
            ctx.shadowColor = color;
            ctx.shadowBlur = 12 * pulse;
            ctx.fillStyle = color;
            ctx.globalAlpha = alpha * 0.25;
            ctx.beginPath();
            ctx.arc(x, y, 14 * pulse, 0, 2 * Math.PI);
            ctx.fill();

            // Main point
            ctx.shadowBlur = 8;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, 2 * Math.PI);
            ctx.fill();

            // Outline
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.arc(x, y, 9, 0, 2 * Math.PI);
            ctx.stroke();

            // Label
            ctx.font = 'bold 12px Arial';
            ctx.fillStyle = color;
            ctx.fillText(label, x + 12, y - 10);

            // Coordinates
            const coordText = `(${point.x}, ${point.y})`;
            ctx.font = '10px monospace';
            ctx.fillStyle = '#aaa';
            ctx.textAlign = 'center';
            ctx.fillText(coordText, x, y + 22);
            ctx.textAlign = 'left';

            ctx.restore();
        }

        // Add two points on the curve (helper function)
        function addPointsOnCurve(P, Q, a, b, p) {
            // Handle point at infinity
            if (P.x === null || P.x === undefined) return { ...Q };
            if (Q.x === null || Q.x === undefined) return { ...P };

            const x1 = P.x, y1 = P.y;
            const x2 = Q.x, y2 = Q.y;

            // Check if points are inverses
            if (x1 === x2 && y1 !== y2) {
                return { x: null, y: null };
            }

            let slope;
            if (x1 === x2 && y1 === y2) {
                // Point doubling
                if (y1 === 0) return { x: null, y: null };
                const numerator = (3 * x1 * x1 + a) % p;
                const denominator = (2 * y1) % p;
                const inv = modInverse(denominator, p);
                slope = (numerator * inv) % p;
            } else {
                // Point addition
                const numerator = (y2 - y1 + p) % p;
                const denominator = (x2 - x1 + p) % p;
                const inv = modInverse(denominator, p);
                slope = (numerator * inv) % p;
            }

            const x3 = (slope * slope - x1 - x2 + 3 * p) % p;
            const y3 = (slope * (x1 - x3) - y1 + 2 * p) % p;

            return { x: x3, y: y3 };
        }

        // Modular inverse using extended Euclidean algorithm
        function modInverse(a, m) {
            a = ((a % m) + m) % m;
            let [old_r, r] = [a, m];
            let [old_s, s] = [1, 0];

            while (r !== 0) {
                const quotient = Math.floor(old_r / r);
                [old_r, r] = [r, old_r - quotient * r];
                [old_s, s] = [s, old_s - quotient * s];
            }

            return ((old_s % m) + m) % m;
        }

        function enableEncryptionAnimationControls(numSteps) {
            const controlsDiv = document.getElementById('encryptionAnimControls');
            if (!controlsDiv) return;
            controlsDiv.style.display = 'flex';

            const slider = document.getElementById('encryptStepSlider');
            if (slider) {
                slider.max = numSteps - 1;
                slider.value = 0;
                slider.disabled = false;
            }

            const prevBtn = document.getElementById('encryptPrevBtn');
            if (prevBtn) prevBtn.disabled = false;
            const playBtn = document.getElementById('encryptPlayBtn');
            if (playBtn) playBtn.disabled = false;
            const nextBtn = document.getElementById('encryptNextBtn');
            if (nextBtn) nextBtn.disabled = false;

            encryptionState.currentStep = 0;
            updateEncryptionStepLabel();
        }

        function prevEncryptionStep() {
            if (encryptionState.currentStep > 0) {
                encryptionState.currentStep--;
                updateEncryptionStepDisplay();
            }
        }

        function nextEncryptionStep() {
            if (encryptionState.currentStep < encryptionState.animationSteps.length - 1) {
                encryptionState.currentStep++;
                updateEncryptionStepDisplay();
            }
        }

        function toggleEncryptionAnimation() {
            const btn = document.getElementById('encryptPlayBtn');
            if (!btn) return;
            if (encryptionState.animationTimer) {
                clearInterval(encryptionState.animationTimer);
                encryptionState.animationTimer = null;
                btn.textContent = 'Play';
            } else {
                btn.textContent = 'Pause';
                encryptionState.animationTimer = setInterval(() => {
                    if (encryptionState.currentStep < encryptionState.animationSteps.length - 1) {
                        nextEncryptionStep();
                    } else {
                        clearInterval(encryptionState.animationTimer);
                        encryptionState.animationTimer = null;
                        btn.textContent = 'Play';
                    }
                }, 1500);
            }
        }

        function onEncryptionSlider(value) {
            encryptionState.currentStep = parseInt(value);
            updateEncryptionStepDisplay();
        }

        function updateEncryptionStepDisplay() {
            const slider = document.getElementById('encryptStepSlider');
            if (slider) {
                slider.value = encryptionState.currentStep;
            }
            updateEncryptionStepLabel();

            // Highlight current step
            document.querySelectorAll('.step-item').forEach((el, i) => {
                if (i <= encryptionState.currentStep) {
                    el.classList.add('active');
                } else {
                    el.classList.remove('active');
                }
            });
        }

        function updateEncryptionStepLabel() {
            const label = document.getElementById('encryptStepLabel');
            if (!label) return;
            label.textContent = (encryptionState.currentStep + 1) + '/' + encryptionState.animationSteps.length;
        }

        function redrawEncryptionCanvases() {
            if (encryptionState.currentCiphertext) {
                drawEncryptionVisualization(encryptionState.currentCiphertext);
            }
        }

        // =================== TAB SWITCHING FOR DEMONSTRATIONS =================== //

        function selectDemonstrationPane(paneId, event) {
            if (event) event.preventDefault();

            // Hide all main tabs
            document.querySelectorAll('.tab-pane').forEach(tab => {
                tab.classList.remove('active');
            });

            // Show demonstrations tab
            const demonstrationsTab = document.getElementById('demonstrationsTab');
            if (demonstrationsTab) {
                demonstrationsTab.classList.add('active');
            }

            // Update dropdown menu items
            const dropdown = document.querySelector('#demonstrationSelectorBtn').nextElementSibling;
            dropdown.querySelectorAll('.curve-dropdown-item').forEach(item => {
                item.classList.remove('active');
            });
            if (event && event.target) event.target.classList.add('active');

            // Hide all demonstration panes
            document.querySelectorAll('#demonstrationsTab .subtab-pane').forEach(pane => {
                pane.classList.remove('active');
            });

            // Show selected pane
            const selectedPane = document.getElementById(paneId);
            if (selectedPane) {
                selectedPane.classList.add('active');
            }
        }

        function loadDHPreset(presetKey) {
            const preset = curvePresets[presetKey];
            if (preset) {
                document.getElementById('dhParamA').value = preset.a;
                document.getElementById('dhParamB').value = preset.b;
                document.getElementById('dhParamP').value = preset.p;
            }
        }

        function loadDLogPreset(presetKey) {
            const preset = curvePresets[presetKey];
            if (preset) {
                document.getElementById('dlogParamA').value = preset.a;
                document.getElementById('dlogParamB').value = preset.b;
                document.getElementById('dlogParamP').value = preset.p;
            }
        }

        // =================== ADVANCED FEATURES: POINT CLASSIFICATION =================== //

        async function classifyPoints() {
            if (!currentCurve || !currentCurve.p) {
                showToast('Please initialize a curve first', 'warning');
                return;
            }

            showLoading('Classifying points...', 'Analyzing point properties');

            try {
                const response = await fetch('/api/classify_points', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        a: currentCurve.a,
                        b: currentCurve.b,
                        p: currentCurve.p
                    })
                });

                const data = await response.json();
                hideLoading();

                if (data.success) {
                    displayPointClassification(data);
                    showToast('Points classified successfully!', 'success');
                } else {
                    showToast(data.error || 'Classification failed', 'error');
                }
            } catch (error) {
                hideLoading();
                showToast('Error classifying points: ' + error.message, 'error');
            }
        }

        function displayPointClassification(data) {
            const resultDiv = document.getElementById('pointsList') || document.getElementById('curveInfo');
            if (!resultDiv) return;

            let html = `
                <div class="result-box">
                    <h3>Point Classification</h3>
                    <div class="curve-info">
                        <p><strong>Group Order:</strong> ${data.group_order}</p>
                    </div>
            `;

            if (data.generators && data.generators.length > 0) {
                html += `
                    <h4 style="color: var(--accent-secondary); margin-top: 15px;">Generators (Order = ${data.group_order})</h4>
                    <div style="max-height: 150px; overflow-y: auto;">
                `;
                data.generators.slice(0, 10).forEach(pt => {
                    html += `<div class="point-item" style="border-left-color: #10b981;">(${pt.x}, ${pt.y}) - Order: ${pt.order}</div>`;
                });
                if (data.generators.length > 10) {
                    html += `<p style="color: var(--text-muted); font-size: 0.9em;">...and ${data.generators.length - 10} more</p>`;
                }
                html += `</div>`;
            } else {
                html += `<p style="color: var(--text-muted);">No generators found</p>`;
            }

            if (data.torsion_points && data.torsion_points.length > 0) {
                html += `
                    <h4 style="color: var(--accent-secondary); margin-top: 15px;">Torsion Points (Small Order)</h4>
                    <div style="max-height: 150px; overflow-y: auto;">
                `;
                data.torsion_points.forEach(pt => {
                    html += `<div class="point-item" style="border-left-color: #f59e0b;">(${pt.x}, ${pt.y}) - Order: ${pt.order}</div>`;
                });
                html += `</div>`;
            }

            html += `
                    <div class="copy-btn-group">
                        <button class="copy-btn" onclick="copyResultAsJSON(${JSON.stringify(data).replace(/"/g, '&quot;')}, 'Classification')">
                            Copy as JSON
                        </button>
                    </div>
                </div>
            `;

            resultDiv.innerHTML = html;
            visualizeClassifiedPoints(data);
        }

        function visualizeClassifiedPoints(data) {
            const canvas = document.getElementById('additionCanvas');
            if (!canvas) return;

            const { ctx, cssWidth, cssHeight } = setupCanvas(canvas);
            clearCanvas(ctx, cssWidth, cssHeight);
            drawAxesGrid(ctx, canvas);

            // Draw all points in gray
            drawCurvePoints(ctx, canvas, '#8a8a8a', false);

            // Highlight generators in green
            if (data.generators) {
                data.generators.forEach(pt => {
                    drawPoint(ctx, canvas, pt.x, pt.y, '#10b981', 7, '');
                });
            }

            // Highlight torsion points in orange
            if (data.torsion_points) {
                data.torsion_points.forEach(pt => {
                    drawPoint(ctx, canvas, pt.x, pt.y, '#f59e0b', 6, '');
                });
            }
        }

        // =================== DIFFIE-HELLMAN KEY EXCHANGE =================== //

        let dhState = {
            currentStep: 0,
            steps: [],
            animationInterval: null,
            demoData: null
        };

        // For demonstration tab
        async function runDiffieHellmanDemo() {
            const a = parseInt(document.getElementById('dhParamA').value);
            const b = parseInt(document.getElementById('dhParamB').value);
            const p = parseInt(document.getElementById('dhParamP').value);

            if (isNaN(a) || isNaN(b) || isNaN(p)) {
                showToast('Please enter valid curve parameters', 'error');
                return;
            }

            showLoading('Setting up Diffie-Hellman...', 'Generating keys');

            try {
                const response = await fetch('/api/diffie_hellman', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ a, b, p })
                });

                const data = await response.json();
                hideLoading();

                if (data.success) {
                    dhState.demoData = data;
                    dhState.steps = Array.isArray(data.steps) ? data.steps : [];
                    dhState.currentStep = 0;
                    displayDiffieHellmanInTab(data);
                    showToast('Diffie-Hellman demonstration ready!', 'success');
                } else {
                    showToast(data.error || 'Diffie-Hellman demo failed', 'error');
                }
            } catch (error) {
                hideLoading();
                showToast('Error: ' + error.message, 'error');
            }
        }

        function displayDiffieHellmanInTab(data) {
            dhState.demoData = data;
            dhState.steps = Array.isArray(data.steps) ? data.steps : dhState.steps;
            const container = document.getElementById('dhStepsContainer');
            const resultDiv = document.getElementById('dhDemoResult');

            let html = '<div class="steps-container">';
            data.steps.forEach((step, index) => {
                const isActive = index === dhState.currentStep ? 'active' : '';
                html += `
                    <div class="step-item ${isActive}" id="dh-tab-step-${index}">
                        <div class="step-header">
                            <span>Step ${step.step}: ${step.description}</span>
                        </div>
                        <div class="step-content">
                            ${step.detail}
                            ${step.calculation ? '<br><code>' + step.calculation + '</code>' : ''}
                        </div>
                    </div>
                `;
            });
            html += '</div>';

            container.innerHTML = html;

            // Show summary
            resultDiv.innerHTML = `
                <div class="result-box" style="margin-top: 20px;">
                    <h3>Summary</h3>
                    <p><strong>Base Point (G):</strong> (${data.summary.base_point.x}, ${data.summary.base_point.y})</p>
                    <p><strong>Alice's Private Key:</strong> ${data.summary.alice_private}</p>
                    <p><strong>Bob's Private Key:</strong> ${data.summary.bob_private}</p>
                    <p style="color: #10b981;"><strong>Shared Secret:</strong> (${data.summary.shared_secret.x}, ${data.summary.shared_secret.y})</p>
                </div>
            `;

            // Show animation controls
            const controls = document.getElementById('dhAnimControls');
            controls.style.display = 'grid';

            const slider = document.getElementById('dhStepSlider');
            slider.max = Math.max(0, data.steps.length - 1);
            slider.value = 0;

            const canvas = document.getElementById('dhCanvas');
            if (canvas) {
                canvas.style.display = data.steps.length ? 'block' : 'none';
            }

            updateDHStepDisplay();
        }

        function prevDHStep() {
            if (dhState.currentStep > 0) {
                dhState.currentStep--;
                updateDHStepDisplay();
            }
        }

        function nextDHStep() {
            if (dhState.currentStep < dhState.steps.length - 1) {
                dhState.currentStep++;
                updateDHStepDisplay();
            }
        }

        function setDHStep(value) {
            dhState.currentStep = parseInt(value);
            updateDHStepDisplay();
        }

        function playDHAnimation() {
            if (dhState.animationInterval) {
                clearInterval(dhState.animationInterval);
                dhState.animationInterval = null;
                document.getElementById('dhPlayBtn').textContent = 'Play';
            } else {
                document.getElementById('dhPlayBtn').textContent = 'Pause';
                dhState.animationInterval = setInterval(() => {
                    if (dhState.currentStep < dhState.steps.length - 1) {
                        nextDHStep();
                    } else {
                        clearInterval(dhState.animationInterval);
                        dhState.animationInterval = null;
                        document.getElementById('dhPlayBtn').textContent = 'Play';
                        dhState.currentStep = 0;
                    }
                }, 1500);
            }
        }

        function updateDHStepDisplay() {
            // Update both modal and tab versions
            document.querySelectorAll('#dhSteps .step-item, #dhStepsContainer .step-item').forEach((el, i) => {
                if (i <= dhState.currentStep) {
                    el.classList.add('active');
                } else {
                    el.classList.remove('active');
                }
            });

            const slider = document.getElementById('dhStepSlider');
            const label = document.getElementById('dhStepLabel');
            const maxIndex = Math.max(0, dhState.steps.length - 1);

            if (dhState.currentStep > maxIndex) {
                dhState.currentStep = maxIndex;
            }

            if (slider) slider.value = Math.min(dhState.currentStep, maxIndex);
            if (label) {
                const displayTotal = dhState.steps.length || 1;
                const displayCurrent = dhState.steps.length ? dhState.currentStep + 1 : 0;
                label.textContent = `${displayCurrent}/${displayTotal}`;
            }

            drawDHVisualization();
        }

        function drawDHVisualization() {
            const canvas = document.getElementById('dhCanvas');
            if (!canvas || !dhState.demoData) return;

            const ctx = canvas.getContext('2d');
            const width = canvas.width;
            const height = canvas.height;

            ctx.clearRect(0, 0, width, height);

            const aliceColor = '#ff6b9d';
            const bobColor = '#4a9eff';
            const sharedColor = '#10b981';
            const baseColor = '#fbbf24';

            const aliceX = 100;
            const bobX = 500;
            const centerY = 200;
            const baseY = 100;

            const textColor = document.body.getAttribute('data-theme') === 'dark' ? '#edf2ff' : '#031230';
            const textSecondary = document.body.getAttribute('data-theme') === 'dark' ? '#cfd6ff' : '#0b1f45';

            ctx.fillStyle = textColor;
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Diffie-Hellman Key Exchange Protocol', width / 2, 25);

            if (dhState.currentStep >= 0) {
                ctx.fillStyle = baseColor;
                ctx.beginPath();
                ctx.arc(width / 2, baseY, 20, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#000';
                ctx.font = 'bold 14px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('G', width / 2, baseY + 5);
                ctx.fillStyle = textSecondary;
                ctx.font = '12px sans-serif';
                ctx.fillText(`G = (${dhState.demoData.summary.base_point.x}, ${dhState.demoData.summary.base_point.y})`, width / 2, baseY - 30);
            }

            ctx.fillStyle = aliceColor;
            ctx.beginPath();
            ctx.arc(aliceX, centerY, 30, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 18px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('A', aliceX, centerY + 6);
            ctx.fillStyle = textColor;
            ctx.font = '14px sans-serif';
            ctx.fillText('Alice', aliceX, centerY - 45);

            ctx.fillStyle = bobColor;
            ctx.beginPath();
            ctx.arc(bobX, centerY, 30, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 18px sans-serif';
            ctx.fillText('B', bobX, centerY + 6);
            ctx.fillStyle = textColor;
            ctx.font = '14px sans-serif';
            ctx.fillText('Bob', bobX, centerY - 45);

            if (dhState.currentStep >= 1) {
                ctx.fillStyle = aliceColor;
                ctx.font = '11px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(`Private: a = ${dhState.demoData.summary.alice_private}`, aliceX, centerY + 55);
                ctx.fillText('(Secret)', aliceX, centerY + 70);
            }
            if (dhState.currentStep >= 2) {
                ctx.fillStyle = bobColor;
                ctx.font = '11px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(`Private: b = ${dhState.demoData.summary.bob_private}`, bobX, centerY + 55);
                ctx.fillText('(Secret)', bobX, centerY + 70);
            }
            if (dhState.currentStep >= 3) {
                drawArrow(ctx, width / 2 + 20, baseY + 15, aliceX, centerY - 35, baseColor, 2);
                ctx.fillStyle = aliceColor;
                ctx.font = 'bold 11px sans-serif';
                ctx.fillText(`Public: A = ${dhState.demoData.summary.alice_private} × G`, aliceX, centerY + 90);
                ctx.font = '10px sans-serif';
                ctx.fillText(`(${dhState.demoData.summary.alice_public.x}, ${dhState.demoData.summary.alice_public.y})`, aliceX, centerY + 105);
            }
            if (dhState.currentStep >= 4) {
                drawArrow(ctx, width / 2 - 20, baseY + 15, bobX, centerY - 35, baseColor, 2);
                ctx.fillStyle = bobColor;
                ctx.font = 'bold 11px sans-serif';
                ctx.fillText(`Public: B = ${dhState.demoData.summary.bob_private} × G`, bobX, centerY + 90);
                ctx.font = '10px sans-serif';
                ctx.fillText(`(${dhState.demoData.summary.bob_public.x}, ${dhState.demoData.summary.bob_public.y})`, bobX, centerY + 105);
            }
            if (dhState.currentStep >= 5) {
                drawArrow(ctx, aliceX + 35, centerY - 10, bobX - 35, centerY - 10, aliceColor, 3, true);
                ctx.fillStyle = aliceColor;
                ctx.font = '11px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('A →', (aliceX + bobX) / 2, centerY - 20);
                ctx.font = '9px sans-serif';
                ctx.fillText('(Public)', (aliceX + bobX) / 2, centerY - 7);
            }
            if (dhState.currentStep >= 6) {
                drawArrow(ctx, bobX - 35, centerY + 10, aliceX + 35, centerY + 10, bobColor, 3, true);
                ctx.fillStyle = bobColor;
                ctx.font = '11px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('← B', (aliceX + bobX) / 2, centerY + 23);
                ctx.font = '9px sans-serif';
                ctx.fillText('(Public)', (aliceX + bobX) / 2, centerY + 36);
            }
            if (dhState.currentStep >= 7) {
                ctx.fillStyle = aliceColor;
                ctx.font = 'bold 10px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('Computes:', aliceX, centerY + 125);
                ctx.fillText(`${dhState.demoData.summary.alice_private} × B`, aliceX, centerY + 140);
            }
            if (dhState.currentStep >= 8) {
                ctx.fillStyle = bobColor;
                ctx.font = 'bold 10px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('Computes:', bobX, centerY + 125);
                ctx.fillText(`${dhState.demoData.summary.bob_private} × A`, bobX, centerY + 140);
            }
            if (dhState.currentStep >= 8) {
                const sharedY = 360;
                ctx.fillStyle = sharedColor;
                ctx.beginPath();
                ctx.arc(width / 2, sharedY, 25, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 16px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('🔑', width / 2, sharedY + 6);
                ctx.fillStyle = sharedColor;
                ctx.font = 'bold 12px sans-serif';
                ctx.fillText('Shared Secret', width / 2, sharedY - 35);
                ctx.font = '11px sans-serif';
                ctx.fillText(`(${dhState.demoData.summary.shared_secret.x}, ${dhState.demoData.summary.shared_secret.y})`, width / 2, sharedY - 20);
                drawArrow(ctx, aliceX + 15, centerY + 30, width / 2 - 20, sharedY - 25, sharedColor, 2, false, true);
                drawArrow(ctx, bobX - 15, centerY + 30, width / 2 + 20, sharedY - 25, sharedColor, 2, false, true);
            }
        }

        function drawArrow(ctx, fromX, fromY, toX, toY, color, width = 2, dashed = false, curved = false) {
            ctx.save();
            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            ctx.lineWidth = width;
            if (dashed) ctx.setLineDash([8, 4]);
            ctx.beginPath();
            if (curved) {
                const midX = (fromX + toX) / 2;
                const midY = (fromY + toY) / 2 + 30;
                ctx.quadraticCurveTo(midX, midY, toX, toY);
            } else {
                ctx.moveTo(fromX, fromY);
                ctx.lineTo(toX, toY);
            }
            ctx.stroke();
            if (curved) {
                ctx.beginPath();
                const angle = Math.atan2(toY - fromY, toX - fromX);
                const arrowSize = 8;
                ctx.moveTo(toX, toY);
                ctx.lineTo(toX - arrowSize * Math.cos(angle - Math.PI / 6), toY - arrowSize * Math.sin(angle - Math.PI / 6));
                ctx.lineTo(toX - arrowSize * Math.cos(angle + Math.PI / 6), toY - arrowSize * Math.sin(angle + Math.PI / 6));
                ctx.closePath();
                ctx.fill();
            } else {
                const angle = Math.atan2(toY - fromY, toX - fromX);
                const arrowSize = 8;
                ctx.beginPath();
                ctx.moveTo(toX, toY);
                ctx.lineTo(toX - arrowSize * Math.cos(angle - Math.PI / 6), toY - arrowSize * Math.sin(angle - Math.PI / 6));
                ctx.lineTo(toX - arrowSize * Math.cos(angle + Math.PI / 6), toY - arrowSize * Math.sin(angle + Math.PI / 6));
                ctx.closePath();
                ctx.fill();
            }
            ctx.setLineDash([]);
            ctx.restore();
        }

        // =================== DISCRETE LOGARITHM DEMONSTRATION =================== //

        function escapeHtml(value) {
            if (value === null || value === undefined) return '';
            return String(value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function formatDLogPoint(point) {
            if (!point || point.x === null || point.x === undefined) {
                return 'O';
            }
            return `(${point.x}, ${point.y})`;
        }

        function buildDiscreteLogSummaryHTML(data) {
            if (!data || !data.problem || !data.solution) {
                return '<div class="result-box" style="margin-top: 15px;">No data available</div>';
            }
            const summary = data.solution;
            const metadata = data.metadata || {};
            const algorithm = summary.algorithm ? summary.algorithm.replace(/_/g, ' ') : 'brute force';
            const steps = summary.steps_taken ?? 'N/A';
            const requested = summary.requested_k ?? summary.k;
            const useBsgs = summary.use_bsgs ? 'Yes' : 'No';
            const pointOrder = metadata.point_order ?? 'unknown';
            const timeSeconds = summary.time_seconds ? summary.time_seconds.toFixed(3) : 'n/a';

            return `
                <div class="result-box" style="margin-top: 15px;">
                    <h3>Discrete Log Summary</h3>
                    <p><strong>Given point P:</strong> ${formatDLogPoint(data.problem.P)}</p>
                    <p><strong>Target point Q:</strong> ${formatDLogPoint(data.problem.Q)}</p>
                    <p><strong>Algorithm:</strong> ${algorithm}</p>
                    <p><strong>Scalar k:</strong> ${summary.k} (requested ${requested})</p>
                    <p><strong>Steps recorded:</strong> ${steps}</p>
                    <p><strong>Use BSGS:</strong> ${useBsgs}</p>
                    <p><strong>Point order estimate:</strong> ${pointOrder}</p>
                    <p><strong>Time:</strong> ${timeSeconds}s</p>
                </div>
            `;
        }

        function buildDiscreteLogAttemptList(attempts) {
            if (!Array.isArray(attempts) || attempts.length === 0) {
                return '<p class="empty-result" style="color: var(--text-muted);">No attempts recorded yet.</p>';
            }

            return attempts.map(attempt => {
                const displayPoint = attempt.point || attempt.result || {};
                const coords = formatDLogPoint(displayPoint);
                const label = attempt.label || (attempt.k ? `${attempt.k} × P` : (attempt.phase ? attempt.phase.replace(/_/g, ' ') : 'Step'));
                const description = attempt.description ? `<div style="font-size: 0.85em; color: var(--text-muted); margin-top: 4px;">${escapeHtml(attempt.description)}</div>` : '';
                const matchIcon = attempt.match ? '<span style="color: #10b981; margin-left: 6px;">✓</span>' : '';
                return `
                    <div class="step-item${attempt.match ? ' active' : ''}">
                        <div class="step-content">
                            <strong>${label}</strong>${matchIcon}
                            <div style="margin-top: 4px; font-size: 0.9em; color: var(--text-muted);">${coords}</div>
                            ${description}
                        </div>
                    </div>
                `;
            }).join('');
        }

        async function demonstrateDiscreteLog() {
            if (!currentCurve || !currentCurve.p) {
                showToast('Please initialize a curve first', 'warning');
                return;
            }

            showLoading('Setting up discrete log demo...', 'Finding points');

            try {
                const rawInput = prompt('Enter a scalar k (1-2000):', '5');
                let k = parseInt(rawInput, 10);
                if (Number.isNaN(k)) k = 5;
                k = Math.max(1, Math.min(2000, k));
                const useBsgs = k > 100;

                const response = await fetch('/api/discrete_log_demo', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        a: currentCurve.a,
                        b: currentCurve.b,
                        p: currentCurve.p,
                        k,
                        use_bsgs: useBsgs
                    })
                });

                const data = await response.json();
                hideLoading();

                if (data.success) {
                    displayDiscreteLogDemo(data);
                    showToast('Discrete logarithm demo ready!', 'success');
                } else {
                    showToast(data.error || 'Demo failed', 'error');
                }
            } catch (error) {
                hideLoading();
                showToast('Error: ' + error.message, 'error');
            }
        }

        function displayDiscreteLogDemo(data) {
            const modal = document.getElementById('aboutModal');
            const modalBody = modal.querySelector('.about-modal-body');
            const summaryHtml = buildDiscreteLogSummaryHTML(data);
            const attemptsHtml = buildDiscreteLogAttemptList(data.attempts);
            const complexityHtml = data.complexity_note ? `<pre class="complexity-note" style="margin-top: 15px;">${escapeHtml(data.complexity_note)}</pre>` : '';

            const html = `
                <div class="panel full-width">
                    <h2>Discrete Logarithm Problem</h2>
                    <p style="margin-bottom: 15px; color:#ccc;">
                        ${data.problem.description}
                    </p>
                    ${summaryHtml}
                    <h3 style="margin-top: 20px; color: var(--text-primary);">Attempt Log</h3>
                    <div class="steps-container" style="max-height: 320px; overflow-y: auto; margin-top: 10px;">
                        ${attemptsHtml}
                    </div>
                    ${complexityHtml}
                </div>
            `;

            modalBody.innerHTML = html;
            modal.classList.add('active');
        }

        async function runDiscreteLogDemo() {
            const a = Number.parseInt(document.getElementById('dlogParamA').value, 10);
            const b = Number.parseInt(document.getElementById('dlogParamB').value, 10);
            const p = Number.parseInt(document.getElementById('dlogParamP').value, 10);
            let k = Number.parseInt(document.getElementById('dlogScalar').value, 10);

            if ([a, b, p, k].some(value => Number.isNaN(value))) {
                showToast('Please enter valid parameters', 'error');
                return;
            }

            if (k < 1) {
                showToast('Scalar k must be at least 1', 'warning');
                return;
            }

            if (k > 2000) {
                showToast('Scalar k is capped at 2000 for educational demos', 'info');
                k = 2000;
                document.getElementById('dlogScalar').value = k;
            }

            const useBsgs = document.getElementById('dlogUseBsgs')?.checked ?? false;

            showLoading('Setting up discrete log demo...', 'Finding points');

            try {
                const payload = { a, b, p, k, use_bsgs: useBsgs };
                const response = await fetch('/api/discrete_log_demo', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();
                hideLoading();

                if (data.success) {
                    displayDiscreteLogInTab(data);
                    showToast('Discrete logarithm demo ready!', 'success');
                } else {
                    showToast(data.error || 'Demo failed', 'error');
                }
            } catch (error) {
                hideLoading();
                showToast('Error: ' + error.message, 'error');
            }
        }

        function displayDiscreteLogInTab(data) {
            const container = document.getElementById('dlogStepsContainer');
            const resultDiv = document.getElementById('dlogDemoResult');
            const summaryHtml = buildDiscreteLogSummaryHTML(data);
            const attemptsHtml = buildDiscreteLogAttemptList(data.attempts);
            const complexityHtml = data.complexity_note ? `<pre class="complexity-note" style="margin-top: 10px;">${escapeHtml(data.complexity_note)}</pre>` : '';

            resultDiv.innerHTML = `${summaryHtml}${complexityHtml}`;
            container.innerHTML = `
                <div style="max-height: 420px; overflow-y: auto; margin-top: 10px;">
                    ${attemptsHtml}
                </div>
            `;
        }

        // =================== EDUCATIONAL MODAL: "WHY IT WORKS" =================== //

        function showWhyItWorksModal() {
            const modal = document.getElementById('aboutModal');
            const modalBody = modal.querySelector('.about-modal-body');

            const html = `
                <div class="panel full-width">
                    <h2>Why Elliptic Curves Work for Cryptography</h2>

                    <h3 style="color: var(--text-primary); margin-top: 20px;">The Group Law</h3>
                    <p style="color: #ccc; line-height: 1.8;">
                        Elliptic curves form an <strong>abelian group</strong> under point addition. This means:
                    </p>
                    <ul style="color: #ccc; line-height: 1.8; margin-left: 20px;">
                        <li><strong>Closure:</strong> Adding two points on the curve gives another point on the curve</li>
                        <li><strong>Associativity:</strong> (P + Q) + R = P + (Q + R)</li>
                        <li><strong>Identity:</strong> The point at infinity O acts as the identity: P + O = P</li>
                        <li><strong>Inverses:</strong> Every point P has an inverse -P such that P + (-P) = O</li>
                        <li><strong>Commutativity:</strong> P + Q = Q + P</li>
                    </ul>

                    <h3 style="color: var(--text-primary); margin-top: 20px;">Point Addition Geometry</h3>
                    <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 8px; margin: 15px 0;">
                        <p style="color: #ccc; margin-bottom: 10px;"><strong>To add P + Q:</strong></p>
                        <ol style="color: #ccc; line-height: 1.8; margin-left: 20px;">
                            <li>Draw a line through points P and Q</li>
                            <li>Find where this line intersects the curve at a third point R'</li>
                            <li>Reflect R' across the x-axis to get R = P + Q</li>
                        </ol>
                    </div>

                    <h3 style="color: var(--text-primary); margin-top: 20px;">The Discrete Logarithm Problem</h3>
                    <p style="color: #ccc; line-height: 1.8;">
                        Security relies on the <strong>discrete logarithm problem (DLP)</strong>:
                    </p>
                    <div class="math-formula">
                        Given P and Q = kP, find k
                    </div>
                    <p style="color: #ccc; line-height: 1.8;">
                        While computing Q = kP is fast (using double-and-add), finding k given P and Q is
                        computationally hard for large curves. This one-way property enables:
                    </p>
                    <ul style="color: #ccc; line-height: 1.8; margin-left: 20px;">
                        <li><strong>Key Exchange:</strong> Diffie-Hellman ECDH</li>
                        <li><strong>Digital Signatures:</strong> ECDSA</li>
                        <li><strong>Encryption:</strong> ECIES</li>
                    </ul>

                    <h3 style="color: var(--text-primary); margin-top: 20px;">Why Smaller Keys?</h3>
                    <p style="color: #ccc; line-height: 1.8;">
                        Elliptic curve cryptography provides equivalent security to RSA with much smaller key sizes:
                    </p>
                    <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 8px; margin: 15px 0;">
                        <ul style="color: #ccc; line-height: 1.8; margin-left: 20px;">
                            <li>256-bit ECC ≈ 3072-bit RSA (128-bit security)</li>
                            <li>384-bit ECC ≈ 7680-bit RSA (192-bit security)</li>
                            <li>521-bit ECC ≈ 15360-bit RSA (256-bit security)</li>
                        </ul>
                    </div>
                    <p style="color: #ccc; line-height: 1.8;">
                        This makes ECC ideal for mobile devices, IoT, and bandwidth-constrained environments.
                    </p>

                    <h3 style="color: var(--text-primary); margin-top: 20px;">Real-World Applications</h3>
                    <ul style="color: #ccc; line-height: 1.8; margin-left: 20px;">
                        <li><strong>Bitcoin & Cryptocurrencies:</strong> Uses secp256k1 curve for signatures</li>
                        <li><strong>TLS/SSL:</strong> ECDHE for perfect forward secrecy</li>
                        <li><strong>Signal & WhatsApp:</strong> X25519 for key agreement</li>
                        <li><strong>Apple iMessage:</strong> ECC for end-to-end encryption</li>
                    </ul>
                </div>
            `;

            modalBody.innerHTML = html;
            modal.classList.add('active');
        }

        // =================== UTILITY FUNCTIONS: EXPORT & DOWNLOAD =================== //

        async function generateTestVector() {
            if (!currentCurve || !currentCurve.p) {
                showToast('Please initialize a curve first', 'warning');
                return;
            }

            showLoading('Generating test vector...', 'Creating sample operations');

            try {
                const response = await fetch('/api/generate_test_vector', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        a: currentCurve.a,
                        b: currentCurve.b,
                        p: currentCurve.p
                    })
                });

                const data = await response.json();
                hideLoading();

                if (data.success) {
                    downloadJSON(data.test_vector, `test_vector_E${currentCurve.p}(${currentCurve.a},${currentCurve.b}).json`);
                    showToast('Test vector generated and downloaded!', 'success');
                } else {
                    showToast(data.error || 'Failed to generate test vector', 'error');
                }
            } catch (error) {
                hideLoading();
                showToast('Error: ' + error.message, 'error');
            }
        }

        async function copyCurveParameters() {
            if (!currentCurve || !currentCurve.p) {
                showToast('Please initialize a curve first', 'warning');
                return;
            }

            const params = {
                equation: `y² ≡ x³ + ${currentCurve.a}x + ${currentCurve.b} (mod ${currentCurve.p})`,
                parameters: {
                    a: currentCurve.a,
                    b: currentCurve.b,
                    p: currentCurve.p
                },
                total_points: currentPoints.length
            };

            await copyToClipboard(JSON.stringify(params, null, 2), 'Curve parameters copied!');
        }

        async function downloadPointList() {
            if (!currentPoints || currentPoints.length === 0) {
                showToast('Please find points first', 'warning');
                return;
            }

            const format = prompt('Enter format (json or csv):', 'json');

            if (format === 'csv') {
                let csv = 'x,y\n';
                currentPoints.forEach(pt => {
                    if (pt.x === null) {
                        csv += 'O,O\n';
                    } else {
                        csv += `${pt.x},${pt.y}\n`;
                    }
                });
                downloadText(csv, `points_E${currentCurve.p}(${currentCurve.a},${currentCurve.b}).csv`, 'text/csv');
                showToast('Point list downloaded as CSV!', 'success');
            } else {
                const data = {
                    curve: {
                        a: currentCurve.a,
                        b: currentCurve.b,
                        p: currentCurve.p
                    },
                    points: currentPoints,
                    count: currentPoints.length
                };
                downloadJSON(data, `points_E${currentCurve.p}(${currentCurve.a},${currentCurve.b}).json`);
                showToast('Point list downloaded as JSON!', 'success');
            }
        }

        function downloadJSON(data, filename) {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        }

        function downloadText(text, filename, mimeType = 'text/plain') {
            const blob = new Blob([text], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        }

        // =================== STRUCTURED TUTORIALS SYSTEM =================== //

        let tutorialState = {
            active: false,
            currentTutorial: null,
            currentStep: 0,
            completed: []
        };

        async function startTutorial(type) {
            try {
                const response = await fetch('/api/get_tutorial', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type })
                });

                const data = await response.json();

                if (data.success) {
                    tutorialState.active = true;
                    tutorialState.currentTutorial = data.tutorial;
                    tutorialState.currentStep = 0;
                    displayTutorial();
                    showToast(`Tutorial started: ${data.tutorial.title}`, 'success');
                } else {
                    showToast('Failed to load tutorial', 'error');
                }
            } catch (error) {
                showToast('Error loading tutorial: ' + error.message, 'error');
            }
        }

        function displayTutorial() {
            const modal = document.getElementById('aboutModal');
            const modalBody = modal.querySelector('.about-modal-body');

            const tutorial = tutorialState.currentTutorial;
            const step = tutorial.steps[tutorialState.currentStep];

            let html = `
                <div class="tutorial-container">
                    <div class="tutorial-header">
                        <h2>${tutorial.title}</h2>
                        <p style="color: #888;">${tutorial.description}</p>
                        <div class="tutorial-progress">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${((tutorialState.currentStep + 1) / tutorial.steps.length) * 100}%"></div>
                            </div>
                            <span class="progress-text">Step ${tutorialState.currentStep + 1} of ${tutorial.steps.length}</span>
                        </div>
                    </div>

                    <div class="tutorial-step">
                        <h3>Step ${step.step}: ${step.title}</h3>
                        <div class="tutorial-content">
                            ${step.content.replace(/\n/g, '<br>')}
                        </div>

                        ${step.interactive ? `
                            <div class="tutorial-action">
                                <i class="fa-solid fa-hand-pointer" style="color: #10b981;"></i>
                                <span style="color: #10b981; font-weight: bold;">Action Required:</span> ${step.action}
                            </div>
                        ` : ''}
                    </div>

                    <div class="tutorial-nav">
                        <button onclick="prevTutorialStep()" ${tutorialState.currentStep === 0 ? 'disabled' : ''}>
                            <i class="fa-solid fa-arrow-left"></i> Previous
                        </button>
                        ${tutorialState.currentStep < tutorial.steps.length - 1 ? `
                            <button onclick="nextTutorialStep()" class="btn-primary">
                                Next <i class="fa-solid fa-arrow-right"></i>
                            </button>
                        ` : `
                            <button onclick="completeTutorial()" class="btn-success">
                                <i class="fa-solid fa-check"></i> Complete Tutorial
                            </button>
                        `}
                        <button onclick="exitTutorial()" class="btn-secondary">Exit</button>
                    </div>

                    ${step.interactive && step.button ? `
                        <div class="tutorial-hint">
                            <i class="fa-solid fa-lightbulb"></i>
                            Click the "${step.button}" button to proceed
                        </div>
                    ` : ''}
                </div>
            `;

            modalBody.innerHTML = html;
            modal.classList.add('active');
        }

        function nextTutorialStep() {
            if (tutorialState.currentStep < tutorialState.currentTutorial.steps.length - 1) {
                tutorialState.currentStep++;
                displayTutorial();
            }
        }

        function prevTutorialStep() {
            if (tutorialState.currentStep > 0) {
                tutorialState.currentStep--;
                displayTutorial();
            }
        }

        function completeTutorial() {
            const tutorialType = tutorialState.currentTutorial.title;
            tutorialState.completed.push(tutorialType);
            localStorage.setItem('completed_tutorials', JSON.stringify(tutorialState.completed));

            showToast(`Congratulations! You completed: ${tutorialType}`, 'success');
            exitTutorial();
        }

        function exitTutorial() {
            tutorialState.active = false;
            tutorialState.currentTutorial = null;
            tutorialState.currentStep = 0;
            closeAboutModal();
        }

        // =================== CURVE PRESETS LIBRARY =================== //

        let customPresets = [];

        function initCustomPresets() {
            const saved = localStorage.getItem('custom_curve_presets');
            if (saved) {
                try {
                    customPresets = JSON.parse(saved);
                } catch (e) {
                    customPresets = [];
                }
            }
        }

        function saveCurrentCurveAsPreset() {
            if (!currentCurve || !currentCurve.p) {
                showToast('Initialize a curve first', 'warning');
                return;
            }

            const name = prompt('Enter a name for this preset:', `Custom_${customPresets.length + 1}`);
            if (!name) return;

            const description = prompt('Enter a description (optional):', 'My custom curve');
            const security = prompt('Security notes (optional):', 'Educational use only');

            const preset = {
                id: Date.now(),
                name: name,
                a: currentCurve.a,
                b: currentCurve.b,
                p: currentCurve.p,
                description: description || 'Custom curve',
                security: security || 'Not evaluated',
                created: new Date().toISOString(),
                pointCount: currentPoints?.length || 0
            };

            customPresets.push(preset);
            localStorage.setItem('custom_curve_presets', JSON.stringify(customPresets));
            showToast(`Preset "${name}" saved!`, 'success');
            updateCustomPresetsUI();
        }

        function loadCustomPreset(id) {
            const preset = customPresets.find(p => p.id === id);
            if (!preset) {
                showToast('Preset not found', 'error');
                return;
            }

            document.getElementById('paramA').value = preset.a;
            document.getElementById('paramB').value = preset.b;
            document.getElementById('paramP').value = preset.p;
            document.getElementById('curveDescription').textContent = preset.description;
            document.getElementById('curvePreset').value = 'custom';

            showToast(`Loaded preset: ${preset.name}`, 'success');
        }

        function deleteCustomPreset(id) {
            if (!confirm('Delete this preset?')) return;

            customPresets = customPresets.filter(p => p.id !== id);
            localStorage.setItem('custom_curve_presets', JSON.stringify(customPresets));
            showToast('Preset deleted', 'success');
            updateCustomPresetsUI();
        }

        function updateCustomPresetsUI() {
            // This will be called to refresh the presets dropdown
            const container = document.getElementById('customPresetsContainer');
            if (!container) return;

            let html = '<h4 style="color: var(--text-primary); margin-top: 15px;">My Saved Presets</h4>';

            if (customPresets.length === 0) {
                html += '<p style="color: var(--text-muted);">No saved presets yet</p>';
            } else {
                html += '<div class="presets-list">';
                customPresets.forEach(preset => {
                    html += `
                        <div class="preset-item">
                            <div class="preset-info">
                                <strong>${preset.name}</strong>
                                <span>E_${preset.p}(${preset.a}, ${preset.b})</span>
                                <small>${preset.description}</small>
                            </div>
                            <div class="preset-actions">
                                <button onclick="loadCustomPreset(${preset.id})" class="btn-sm">Load</button>
                                <button onclick="deleteCustomPreset(${preset.id})" class="btn-sm btn-danger">Delete</button>
                            </div>
                        </div>
                    `;
                });
                html += '</div>';
            }

            container.innerHTML = html;
        }

        function showPresetsLibrary() {
            const modal = document.getElementById('aboutModal');
            const modalBody = modal.querySelector('.about-modal-body');

            let html = `
                <div class="presets-library">
                    <h2>Curve Presets Library</h2>
                    <p style="color: #888; margin-bottom: 20px;">Save and manage your favorite curve configurations</p>

                    <div class="presets-section">
                        <h3>Built-in Presets</h3>
                        <div class="presets-grid">
            `;

            Object.entries(curvePresets).forEach(([key, preset]) => {
                html += `
                    <div class="preset-card" onclick="loadCurvePreset('${key}'); closeAboutModal();">
                        <h4>${key.toUpperCase()}</h4>
                        <div class="preset-params">E_${preset.p}(${preset.a}, ${preset.b})</div>
                        <p>${preset.description}</p>
                    </div>
                `;
            });

            html += `
                        </div>
                    </div>

                    <div class="presets-section">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <h3>Custom Presets</h3>
                            <button onclick="saveCurrentCurveAsPreset()" class="btn-primary">
                                <i class="fa-solid fa-plus"></i> Save Current Curve
                            </button>
                        </div>
                        <div id="customPresetsContainer"></div>
                    </div>
                </div>
            `;

            modalBody.innerHTML = html;
            modal.classList.add('active');
            updateCustomPresetsUI();
        }

        // =================== EXPORTABLE MATH (LATEX & JSON) =================== //

        function exportResultAsLaTeX(data, operationType) {
            let latex = '';

            if (operationType === 'addition') {
                const P = data.P || data.p1;
                const Q = data.Q || data.p2;
                const R = data.result;

                latex = `\\text{Point Addition on } E_{${currentCurve.p}}(${currentCurve.a}, ${currentCurve.b})\n\n`;
                latex += `P = ${formatPointLaTeX(P)}\n`;
                latex += `Q = ${formatPointLaTeX(Q)}\n`;
                latex += `P + Q = ${formatPointLaTeX(R)}\n\n`;

                if (data.steps) {
                    latex += `\\text{Steps:}\n`;
                    data.steps.forEach((step, i) => {
                        latex += `${i + 1}. \\text{${step}}\n`;
                    });
                }
            } else if (operationType === 'multiplication') {
                const k = data.k;
                const P = data.point || data.P;
                const R = data.result;

                latex += `\\text{Scalar Multiplication on } E_{${currentCurve.p}}(${currentCurve.a}, ${currentCurve.b})\n\n`;
                latex += `k = ${k}\n`;
                latex += `P = ${formatPointLaTeX(P)}\n`;
                latex += `${k}P = ${formatPointLaTeX(R)}\n`;
            } else if (operationType === 'curve') {
                latex += `E_{${currentCurve.p}}(${currentCurve.a}, ${currentCurve.b}): y^2 \\equiv x^3 + ${currentCurve.a}x + ${currentCurve.b} \\pmod{${currentCurve.p}}\n\n`;
                latex += `\\text{Total Points: } ${currentPoints.length}\n`;
            }

            copyToClipboard(latex, 'LaTeX copied to clipboard!');
        }

        function formatPointLaTeX(point) {
            if (!point || point.x === null || point.x === undefined) {
                return '\\mathcal{O}';
            }
            return `(${point.x}, ${point.y})`;
        }

        function exportResultAsJSON(data, operationType) {
            const exportData = {
                curve: {
                    a: currentCurve.a,
                    b: currentCurve.b,
                    p: currentCurve.p,
                    equation: `y² ≡ x³ + ${currentCurve.a}x + ${currentCurve.b} (mod ${currentCurve.p})`
                },
                operation: operationType,
                timestamp: new Date().toISOString(),
                data: data
            };

            const json = JSON.stringify(exportData, null, 2);
            copyToClipboard(json, 'JSON copied to clipboard!');
        }

        function addExportButtons(containerId, data, operationType) {
            const container = document.getElementById(containerId);
            if (!container) return;

            const exportDiv = document.createElement('div');
            exportDiv.className = 'export-buttons';
            exportDiv.innerHTML = `
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--border-color);">
                    <h4 style="color: var(--text-primary); margin-bottom: 10px;">Export Options</h4>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <button onclick='exportResultAsLaTeX(${JSON.stringify(data).replace(/'/g, "\\'")}," + "'${operationType}')\" class=\"copy-btn\">
                            <i class=\"fa-solid fa-file-code\"></i> Copy as LaTeX
                        </button>
                        <button onclick='exportResultAsJSON(${JSON.stringify(data).replace(/'/g, "\\'")}," + "'${operationType}')\" class=\"copy-btn\">
                            <i class=\"fa-solid fa-file-export\"></i> Copy as JSON
                        </button>
                        <button onclick='downloadResultPDF(${JSON.stringify(data).replace(/'/g, "\\'")}," + "'${operationType}')\" class=\"copy-btn\">
                            <i class=\"fa-solid fa-file-pdf\"></i> Download PDF
                        </button>
                    </div>
                </div>
            `;

            // Check if export buttons already exist
            const existing = container.querySelector('.export-buttons');
            if (existing) {
                existing.remove();
            }

            container.appendChild(exportDiv);
        }

        function downloadResultPDF(data, operationType) {
            // For now, create a simple text version
            // In a real implementation, you'd generate a proper PDF
            let content = `Elliptic Curve Calculator - ${operationType}\n\n`;
            content += `Curve: E_${currentCurve.p}(${currentCurve.a}, ${currentCurve.b})\n`;
            content += `Equation: y² ≡ x³ + ${currentCurve.a}x + ${currentCurve.b} (mod ${currentCurve.p})\n\n`;
            content += `Result:\n${JSON.stringify(data, null, 2)}`;

            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ecc_${operationType}_${Date.now()}.txt`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Result downloaded!', 'success');
        }

        // =================== CURVE OVERLAY / COMPARISON =================== //

        let overlayState = {
            curves: [], // Array of {a, b, p, points, color}
            enabled: false
        };

        function toggleCurveOverlay() {
            overlayState.enabled = !overlayState.enabled;

            if (overlayState.enabled && overlayState.curves.length === 0) {
                // Add current curve as first overlay
                if (currentCurve && currentPoints) {
                    overlayState.curves.push({
                        a: currentCurve.a,
                        b: currentCurve.b,
                        p: currentCurve.p,
                        points: [...currentPoints],
                        color: '#2563eb'
                    });
                }
                showToast('Curve overlay enabled! Current curve saved.', 'info');
            }

            if (overlayState.enabled) {
                showToast('Add another curve to compare, then click "Show Overlay"', 'info');
            } else {
                overlayState.curves = [];
                redrawAllCurves();
                showToast('Curve overlay disabled', 'info');
            }
        }

        function addCurrentCurveToOverlay() {
            if (!currentCurve || !currentPoints) {
                showToast('Initialize a curve first', 'warning');
                return;
            }

            const colors = ['#2563eb', '#f97316', '#10b981', '#8b5cf6', '#ec4899'];
            const color = colors[overlayState.curves.length % colors.length];

            overlayState.curves.push({
                a: currentCurve.a,
                b: currentCurve.b,
                p: currentCurve.p,
                points: [...currentPoints],
                color: color
            });

            showToast(`Curve ${overlayState.curves.length} added to overlay`, 'success');
            drawOverlayCurves();
        }

        function drawOverlayCurves() {
            if (!overlayState.enabled || overlayState.curves.length === 0) {
                return;
            }

            const canvas = document.getElementById('additionCanvas');
            if (!canvas) return;

            const { ctx, cssWidth, cssHeight } = setupCanvas(canvas);
            clearCanvas(ctx, cssWidth, cssHeight);
            drawAxesGrid(ctx, canvas);

            // Draw each curve with its color
            overlayState.curves.forEach((curve, index) => {
                curve.points.forEach(pt => {
                    if (pt.x !== null) {
                        drawPoint(ctx, canvas, pt.x, pt.y, curve.color, 4, '');
                    }
                });
            });

            // Add legend
            const padding = 50;
            let legendY = padding + 20;
            ctx.font = '11px Arial';
            ctx.textAlign = 'left';

            overlayState.curves.forEach((curve, index) => {
                ctx.fillStyle = curve.color;
                ctx.fillRect(padding + 10, legendY, 10, 10);
                ctx.fillStyle = '#ccc';
                ctx.fillText(`E${curve.p}(${curve.a},${curve.b})`, padding + 25, legendY + 9);
                legendY += 20;
            });
        }
