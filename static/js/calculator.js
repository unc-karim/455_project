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
            const icon = document.querySelector('.theme-icon');
            if (icon) {
                icon.textContent = theme === 'dark' ? '☀️' : '🌙';
            }
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
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
            
            document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
            document.getElementById(tabId).classList.add('active');
            // Defer redraw so canvases have non-zero size once visible
            _deferRedraw(() => { redrawAllCurves(); redrawRealCanvases(); });
        }

        function switchSubtab(group, paneId){
            const container = (group === 'real') ? document.getElementById('realTab') : document.getElementById('fpTab');
            if (!container) return;
            container.querySelectorAll('.subtab-btn').forEach(btn => btn.classList.remove('active'));
            container.querySelectorAll('.subtab-pane').forEach(p => p.classList.remove('active'));
            const btn = container.querySelector(`[data-subtab="${paneId}"]`);
            if (btn) btn.classList.add('active');
            const pane = document.getElementById(paneId);
            if (pane) pane.classList.add('active');
            if (group === 'real') { _deferRedraw(() => redrawRealCanvases()); } else { _deferRedraw(() => redrawAllCurves()); }
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
            return { ctx, cssWidth, cssHeight, dpr };
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
                    // Draw points on canvases right away
                    redrawAllCurves();
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
                        ctx.clearRect(0, 0, cssWidth, cssHeight);
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
                        ctx.clearRect(0, 0, cssWidth, cssHeight);
                        drawAxesGrid(ctx, mulCanvas);
                        drawCurvePoints(ctx, mulCanvas, '#8a8a8a', document.getElementById('multiplicationShowLabels')?.checked);
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
                            ctx.clearRect(0, 0, cssWidth, cssHeight);
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
                select.innerHTML = '<option value="">Select a point</option>';
                
                currentPoints.forEach((point, index) => {
                    const option = document.createElement('option');
                    option.value = index;
                    option.textContent = point.display;
                    select.appendChild(option);
                });
            });
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
            ctx.clearRect(0, 0, cssWidth, cssHeight);
            
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

        // Pulse animation for Fp addition
        let _fpAddAnim = { active:false, raf:null, started:0, duration:1300 };
        function startFpAdditionAnimation(P, Q, R){
            const canvas = document.getElementById('additionCanvas');
            if (!canvas) return;
            if (_fpAddAnim.raf) cancelAnimationFrame(_fpAddAnim.raf);
            _fpAddAnim = { active:true, raf:null, started: performance.now(), duration:1300 };
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
                ctx.clearRect(0,0,cssWidth,cssHeight);
                drawAxesGrid(ctx, canvas);
                drawCurvePoints(ctx, canvas, '#8a8a8a', document.getElementById('additionShowLabels')?.checked);
                if (P.x !== null) drawPoint(ctx, canvas, P.x, P.y, '#2563eb', 6, 'P');
                if (Q.x !== null) drawPoint(ctx, canvas, Q.x, Q.y, '#f97316', 6, 'Q');
                if (R.x !== null) drawPoint(ctx, canvas, R.x, R.y, '#166534', 7, 'R');
                const t = Math.min(1, (now - _fpAddAnim.started) / _fpAddAnim.duration);
                const pulse = (base, color)=>{
                    ctx.strokeStyle = color; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.arc(base.x, base.y, 10 + 8*Math.sin(t*Math.PI), 0, 2*Math.PI); ctx.stroke();
                };
                if (P.x !== null){ const p = map(P.x, P.y); pulse(p, '#2563eb'); }
                if (Q.x !== null){ const q = map(Q.x, Q.y); pulse(q, '#f97316'); }
                if (R.x !== null && t>0.5){ const r = map(R.x, R.y); pulse(r, '#166534'); }
                if (t < 1){ _fpAddAnim.raf = requestAnimationFrame(tick); }
                else { _fpAddAnim.active = false; _fpAddAnim.raf = null; visualizeAddition(P, Q, R); }
            };
            _fpAddAnim.raf = requestAnimationFrame(tick);
        }

        function renderFpScalarAll() {
            const canvas = document.getElementById('multiplicationCanvas');
            if (!canvas) return;
            const { ctx, cssWidth, cssHeight } = setupCanvas(canvas);
            ctx.clearRect(0, 0, cssWidth, cssHeight);
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

        function renderFpScalarPartial(count) {
            const canvas = document.getElementById('multiplicationCanvas');
            if (!canvas) return;
            const { ctx, cssWidth, cssHeight } = setupCanvas(canvas);
            ctx.clearRect(0, 0, cssWidth, cssHeight);
            drawAxesGrid(ctx, canvas);
            drawCurvePoints(ctx, canvas, '#8a8a8a', false);

            const padding = 50;
            const cW = (canvas.clientWidth || canvas.width);
            const cH = (canvas.clientHeight || canvas.height);
            const width = cW - 2 * padding;
            const height = cH - 2 * padding;
            const maxVal = Math.max(1, (currentCurve.p || 1) - 1);

            const n = Math.min(count, fpScalarPoints.length);
            for (let i=0;i<n;i++){
                const pt = fpScalarPoints[i];
                if (!pt || pt.x === null) continue;
                const lbl = `${i+1}P`;
                drawPoint(ctx, canvas, pt.x, pt.y, '#166534', 6, lbl);
            }
        }

        function startFpMultiplicationAnimation(){
            if (!fpScalarPoints || !fpScalarPoints.length) { renderFpScalarAll(); return; }
            if (_fpMulAnim.raf) cancelAnimationFrame(_fpMulAnim.raf);
            _fpMulAnim.active = true;
            const start = performance.now();
            const per = 280; // ms per point
            const tick = (now)=>{
                const elapsed = now - start;
                const shown = Math.min(fpScalarPoints.length, Math.floor(elapsed / per) + 1);
                renderFpScalarPartial(shown);
                if (shown < fpScalarPoints.length) {
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
            loadSession();
            initPresetMonitor();
            initValidation();
            // Load initial preset description
            loadCurvePreset('e97');
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
        function shouldForceLogin(){
            try { if (localStorage.getItem('force_login') === '1') return true; } catch(_) {}
            const qs = new URLSearchParams(window.location.search);
            return qs.get('login') === '1';
        }

        async function loadSession() {
            try {
                const res = await fetch('/api/session');
                const data = await res.json();
                const force = shouldForceLogin();
                updateAuthUI(data);
                if (!data || !data.logged_in) {
                    if (!force) ensureGuestSession();
                }
            } catch (e) {
                // attempt guest if session fetch fails (unless we force login view)
                if (!shouldForceLogin()) ensureGuestSession();
            }
        }

        function updateAuthUI(session) {
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
        }

        // Auto-create a guest session on first load
        let _guestAttempted = false;
        async function ensureGuestSession(){
            if (_guestAttempted) return; _guestAttempted = true;
            try {
                let res = await fetch('/api/auth/guest', {method:'POST'});
                if(!res.ok){ res = await fetch('/api/guest', {method:'POST'}); }
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
                let res = await fetch('/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
                if(!res.ok){
                    res = await fetch('/api/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
                }
                const data = await res.json();
                if(!res.ok || !data.success){
                    msgEl.textContent = data.message || 'Invalid credentials';
                    return;
                }
                msgEl.textContent = '';
                // Redirect to /app
                window.location.href = '/app';
            } catch(e){
                msgEl.textContent = 'Login error';
            }
        }

        function openSignupPage(){ window.location.href = '/signup'; }

        async function continueAsGuestCard(){
            const msgEl = document.getElementById('authMsgOverlay');
            msgEl.textContent = '';
            try {
                let res = await fetch('/api/auth/guest', {method:'POST'});
                if(!res.ok){ res = await fetch('/api/guest', {method:'POST'}); }
                if(res.ok){ window.location.href = '/app'; return; }
            } catch(_){}
            try { localStorage.setItem('guest_session_id', (crypto && crypto.randomUUID? crypto.randomUUID(): String(Date.now()))); } catch(_) {}
            window.location.href = '/app';
        }

        async function doLogout() {
            try {
                await fetch('/api/logout', {method: 'POST'});
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
                selectedMultiplicationIndex = idx;
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
        let realScalarSteps = [];
        let realScalarPoints = [];
        let realCurrentStep = 0;
        let realAnimInterval = null;
        let realPickPhase = 'P';

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
                // Read desired symmetric range from inputs: x,y ∈ [min, max]
                const rmin = parseFloat(document.getElementById('realRangeMin').value);
                const rmax = parseFloat(document.getElementById('realRangeMax').value);
                if ([rmin,rmax].some(v => Number.isNaN(v))) {
                    alert('Please enter valid numeric ranges');
                    return;
                }
                if (!(rmin < rmax)){
                    alert('Range must satisfy min < max');
                    return;
                }
                realRange = { xMin: rmin, xMax: rmax, yMin: rmin, yMax: rmax };
                // reset selections
                realP = null; realQ = null; realR = null;
                redrawRealCanvases();
                startRealCurveDrawAnimation();
            } catch(e){ alert('Connection error'); }
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
            ctx.clearRect(0,0,cssWidth,cssHeight);
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
            const duration = 900;
            const step = (now)=>{
                _realCurveAnim.t = Math.min(1, (now - start)/duration);
                drawRealCurveOnly();
                if (_realCurveAnim.t < 1) _realCurveAnim.raf = requestAnimationFrame(step);
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

            // Preview on the multiplication canvas
            visualizeRealScalarStep(0);
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
            resDiv.innerHTML = '<p style="color:#888;">Calculating...</p>';
            try{
                const r = await fetch('/api/add_points_real',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({a, b, p1:{x:p1x,y:p1y,display:''}, p2:{x:p2x,y:p2y,display:''}})});
                const data = await r.json();
                if (!r.ok || !data.success){ resDiv.innerHTML = `<div class="error">${data.error||'Error'}</div>`; return; }
                realCurve = {a,b};
                realP = {x:p1x, y:p1y};
                realQ = {x:p2x, y:p2y};
                realR = data.result.x === null ? null : {x:data.result.x, y:data.result.y};
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
            }catch(e){ resDiv.innerHTML = '<div class="error">Connection error</div>'; }
        }

        function drawRealAdditionScene(){
            const canvas = document.getElementById('realAdditionCanvas');
            if (!canvas) return;
            const showLabels = document.getElementById('realAdditionShowLabels')?.checked;
            const { ctx, cssWidth, cssHeight } = setupCanvas(canvas);
            ctx.clearRect(0,0,cssWidth,cssHeight);
            drawRealAxesGrid(ctx, canvas);
            drawRealCurve(ctx, canvas, realCurve.a, realCurve.b);

            // Draw points and line
            if (realP){ drawRealPoint(ctx, canvas, realP, '#2563eb', 'P', showLabels); }
            if (realQ){ drawRealPoint(ctx, canvas, realQ, '#f97316', 'Q', showLabels); }
            if (realP && realQ && !(_realAddAnim && _realAddAnim.active)){
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
            const phaseDur = { line: 800, hold: 250, reflect: 700, reveal: 250 };
            const x1 = realRange.xMin, x2 = realRange.xMax;
            let m = null, vertical=false;
            if (Math.abs(realP.x - realQ.x) < 1e-12 && Math.abs(realP.y - realQ.y) < 1e-12) {
                if (Math.abs(realP.y) < 1e-12) vertical = true; else m = (3*realP.x*realP.x + realCurve.a) / (2*realP.y);
            } else { if (Math.abs(realQ.x - realP.x) < 1e-12) vertical = true; else m = (realQ.y - realP.y) / (realQ.x - realP.x); }
            const yAt = (x)=> m*(x - realP.x) + realP.y;
            const minusR = realR? {x: realR.x, y: -realR.y} : null;

            const tick = (now)=>{
                const elapsed = now - start;
                const t1 = Math.min(1, elapsed / phaseDur.line);
                const t2 = Math.min(1, Math.max(0, (elapsed - phaseDur.line - phaseDur.hold) / phaseDur.reflect));
                const t3 = Math.min(1, Math.max(0, (elapsed - phaseDur.line - phaseDur.hold - phaseDur.reflect) / phaseDur.reveal));

                const canvas = document.getElementById('realAdditionCanvas');
                const { ctx, cssWidth, cssHeight } = setupCanvas(canvas);
                ctx.clearRect(0,0,cssWidth,cssHeight);
                drawRealAxesGrid(ctx, canvas);
                drawRealCurve(ctx, canvas, realCurve.a, realCurve.b);
                drawRealPoint(ctx, canvas, realP, '#2563eb', 'P', true);
                drawRealPoint(ctx, canvas, realQ, '#f97316', 'Q', true);

                // animate chord/tangent line
                if (vertical){
                    const x = realP.x;
                    const yStart = realRange.yMin; const yEnd = realRange.yMax;
                    const a = mapRealToCanvas(canvas, x, yStart);
                    const b = mapRealToCanvas(canvas, x, yStart + t1*(yEnd - yStart));
                    ctx.strokeStyle = '#999'; ctx.lineWidth = 1.5;
                    ctx.beginPath(); ctx.moveTo(a.px, a.py); ctx.lineTo(b.px, b.py); ctx.stroke();
                } else {
                    const xa = x1; const xb = x1 + t1*(x2 - x1);
                    const pA = mapRealToCanvas(canvas, xa, yAt(xa));
                    const pB = mapRealToCanvas(canvas, xb, yAt(xb));
                    ctx.strokeStyle = '#999'; ctx.lineWidth = 1.5;
                    ctx.beginPath(); ctx.moveTo(pA.px, pA.py); ctx.lineTo(pB.px, pB.py); ctx.stroke();
                }

                if (minusR && elapsed > phaseDur.line){
                    const alpha = 0.2 + 0.8 * Math.min(1, (elapsed - phaseDur.line)/200);
                    ctx.globalAlpha = alpha; drawRealPoint(ctx, canvas, minusR, '#9ca3af', '-R', true); ctx.globalAlpha = 1;
                }
                if (realR && elapsed > phaseDur.line + phaseDur.hold){
                    const up = mapRealToCanvas(canvas, realR.x, realR.y);
                    const dn = mapRealToCanvas(canvas, realR.x, -realR.y);
                    const midY = up.py + t2*(dn.py - up.py);
                    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.setLineDash([4,4]);
                    ctx.beginPath(); ctx.moveTo(up.px, up.py); ctx.lineTo(up.px, midY); ctx.stroke(); ctx.setLineDash([]);
                }
                if (realR && elapsed > phaseDur.line + phaseDur.hold + phaseDur.reflect){
                    ctx.globalAlpha = t3; drawRealPoint(ctx, canvas, realR, '#166534', 'R', true); ctx.globalAlpha = 1;
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
            }catch(e){ resDiv.innerHTML = '<div class="error">Connection error</div>'; }
        }

        function visualizeRealScalarStep(step){
            const canvas = document.getElementById('realMultiplicationCanvas');
            if (!canvas) return;
            const showLabels = document.getElementById('realMultiplicationShowLabels')?.checked;
            const { ctx, cssWidth, cssHeight } = setupCanvas(canvas);
            ctx.clearRect(0,0,cssWidth,cssHeight);
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
            ctx.clearRect(0,0,cssWidth,cssHeight);
            drawRealAxesGrid(ctx, canvas);
            drawRealCurve(ctx, canvas, realCurve.a, realCurve.b);
            const n = Math.min(count, realScalarPoints.length);
            for (let i=0;i<n;i++){
                const pt = realScalarPoints[i];
                if (!pt || pt.x === null) continue;
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
            }
        }
        function startRealMultiplicationAnimation(){
            if (!realScalarPoints || !realScalarPoints.length){ renderRealScalarAll(); return; }
            if (_realMulAnim.raf) cancelAnimationFrame(_realMulAnim.raf);
            _realMulAnim.active = true;
            const start = performance.now();
            const per = 320;
            const step = (now)=>{
                const elapsed = now - start;
                const shown = Math.min(realScalarPoints.length, Math.floor(elapsed / per) + 1);
                renderRealScalarPartial(shown);
                if (shown < realScalarPoints.length){ _realMulAnim.raf = requestAnimationFrame(step); }
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
            if (!type) return '📝';
            if (type.includes('add')) return '➕';
            if (type.includes('multiply')) return '✖️';
            if (type.includes('init')) return '📐';
            return '📝';
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

            // Load history when opening
            loadUnifiedHistory();
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
