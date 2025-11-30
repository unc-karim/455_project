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
            const modalContent = modal.querySelector('.about-modal-content');

            // Reset scroll position to top
            if (modalContent) {
                modalContent.scrollTop = 0;
            }

            // Force a reflow to ensure smooth rendering
            modal.classList.remove('active');
            modal.offsetHeight; // Trigger reflow
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
                const changeUsernameModal = document.getElementById('changeUsernameModal');
                if (changeUsernameModal && changeUsernameModal.classList.contains('active')) {
                    closeChangeUsernameModal();
                }
                const changePasswordModal = document.getElementById('changePasswordModal');
                if (changePasswordModal && changePasswordModal.classList.contains('active')) {
                    closeChangePasswordModal();
                }
            }
        });

        // =================== ACCOUNT SETTINGS FUNCTIONS =================== //

        // Toggle account settings section visibility based on login status
        function updateAccountSettingsVisibility(isLoggedIn) {
            const settingsBtn = document.getElementById('menuSettingsBtn');
            const authBtn = document.getElementById('menuAuthBtn');
            if (settingsBtn) {
                settingsBtn.style.display = isLoggedIn ? 'block' : 'none';
            }
            if (authBtn) {
                authBtn.style.display = isLoggedIn ? 'none' : 'block';
            }
            // Update account settings section visibility
            const accountSection = document.getElementById('accountSettingsSection');
            if (accountSection) {
                accountSection.style.display = isLoggedIn ? 'block' : 'none';
            }
        }

        function toggleAccountSettings() {
            const accountSection = document.getElementById('accountSettingsSection');
            if (accountSection) {
                const isVisible = accountSection.style.display !== 'none';
                accountSection.style.display = isVisible ? 'none' : 'block';
            }
        }

        // Change Username Modal Functions
        function openChangeUsernameModal() {
            const modal = document.getElementById('changeUsernameModal');
            const usernameDisplay = document.getElementById('currentUsernameDisplay');
            const menuUserName = document.getElementById('menuUserName');

            if (usernameDisplay && menuUserName) {
                usernameDisplay.textContent = menuUserName.textContent;
            }

            document.getElementById('newUsername').value = '';
            document.getElementById('usernamePassword').value = '';
            document.getElementById('usernameError').style.display = 'none';

            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }

        function closeChangeUsernameModal() {
            const modal = document.getElementById('changeUsernameModal');
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }

        function submitChangeUsername() {
            const newUsername = document.getElementById('newUsername').value.trim();
            const password = document.getElementById('usernamePassword').value;
            const errorDiv = document.getElementById('usernameError');

            // Validation
            if (!newUsername) {
                errorDiv.textContent = 'Please enter a new username';
                errorDiv.style.display = 'block';
                return;
            }
            if (newUsername.length < 3) {
                errorDiv.textContent = 'Username must be at least 3 characters';
                errorDiv.style.display = 'block';
                return;
            }
            if (newUsername.length > 50) {
                errorDiv.textContent = 'Username must not exceed 50 characters';
                errorDiv.style.display = 'block';
                return;
            }
            if (!password) {
                errorDiv.textContent = 'Please enter your password for confirmation';
                errorDiv.style.display = 'block';
                return;
            }

            // Show loading state
            const btn = event.target;
            const originalText = btn.textContent;
            btn.textContent = 'Updating...';
            btn.disabled = true;

            // Send request to backend
            fetch('/api/account/change-username', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ new_username: newUsername, password })
            })
            .then(res => res.json())
            .then(data => {
                btn.textContent = originalText;
                btn.disabled = false;

                if (data.success) {
                    showToast('Username updated successfully!', 'success');
                    document.getElementById('menuUserName').textContent = newUsername;
                    closeChangeUsernameModal();
                } else {
                    errorDiv.textContent = data.error || 'Failed to update username';
                    errorDiv.style.display = 'block';
                }
            })
            .catch(err => {
                btn.textContent = originalText;
                btn.disabled = false;
                errorDiv.textContent = 'An error occurred. Please try again.';
                errorDiv.style.display = 'block';
                console.error(err);
            });
        }

        // Change Password Modal Functions
        function openChangePasswordModal() {
            const modal = document.getElementById('changePasswordModal');

            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
            document.getElementById('passwordError').style.display = 'none';
            document.getElementById('strengthLevel').textContent = '—';

            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }

        function closeChangePasswordModal() {
            const modal = document.getElementById('changePasswordModal');
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }

        // Check password strength and update UI
        document.addEventListener('DOMContentLoaded', () => {
            const newPasswordInput = document.getElementById('newPassword');
            if (newPasswordInput) {
                newPasswordInput.addEventListener('input', updatePasswordStrength);
            }
        });

        function updatePasswordStrength() {
            const password = document.getElementById('newPassword').value;
            const strengthBar = document.querySelector('.strength-bar');
            const strengthLevel = document.getElementById('strengthLevel');

            if (!strengthBar) return;

            // Remove all classes
            strengthBar.classList.remove('weak', 'medium', 'strong');

            if (!password) {
                strengthLevel.textContent = '—';
                return;
            }

            let strength = 0;
            if (password.length >= 8) strength++;
            if (password.length >= 12) strength++;
            if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
            if (/[0-9]/.test(password)) strength++;
            if (/[^a-zA-Z0-9]/.test(password)) strength++;

            if (strength < 2) {
                strengthBar.classList.add('weak');
                strengthLevel.textContent = 'Weak';
            } else if (strength < 4) {
                strengthBar.classList.add('medium');
                strengthLevel.textContent = 'Medium';
            } else {
                strengthBar.classList.add('strong');
                strengthLevel.textContent = 'Strong';
            }
        }

        function updateChangePasswordStrength() {
            const p = document.getElementById('newPassword').value;
            const strengthDiv = document.getElementById('newPasswordStrength');
            if (!strengthDiv) return;

            if (!p) {
                strengthDiv.innerHTML = '';
                return;
            }

            const req = {
                length: p.length >= 8,
                uppercase: /[A-Z]/.test(p),
                lowercase: /[a-z]/.test(p),
                number: /[0-9]/.test(p),
                special: /[!@#$%^&*()_+\-=\[\]{};:'"",.<>?/\\|`~]/.test(p)
            };

            let html = '';
            html += `<div style="color: ${req.length ? '#28a745' : '#dc3545'};">✓ At least 8 characters</div>`;
            html += `<div style="color: ${req.uppercase ? '#28a745' : '#dc3545'};">✓ One uppercase letter (A-Z)</div>`;
            html += `<div style="color: ${req.lowercase ? '#28a745' : '#dc3545'};">✓ One lowercase letter (a-z)</div>`;
            html += `<div style="color: ${req.number ? '#28a745' : '#dc3545'};">✓ One number (0-9)</div>`;
            html += `<div style="color: ${req.special ? '#28a745' : '#dc3545'};">✓ One special character (!@#$%^&*...)</div>`;
            strengthDiv.innerHTML = html;
        }

        function submitChangePassword() {
            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const errorDiv = document.getElementById('passwordError');

            // Validation
            if (!currentPassword) {
                errorDiv.textContent = 'Please enter your current password';
                errorDiv.style.display = 'block';
                return;
            }

            if (!newPassword) {
                errorDiv.textContent = 'Please enter a new password';
                errorDiv.style.display = 'block';
                return;
            }

            const req = {
                length: newPassword.length >= 8,
                uppercase: /[A-Z]/.test(newPassword),
                lowercase: /[a-z]/.test(newPassword),
                number: /[0-9]/.test(newPassword),
                special: /[!@#$%^&*()_+\-=\[\]{};:'"",.<>?/\\|`~]/.test(newPassword)
            };
            const passwordValid = req.length && req.uppercase && req.lowercase && req.number && req.special;

            if (!passwordValid) {
                errorDiv.textContent = 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character';
                errorDiv.style.display = 'block';
                return;
            }

            if (newPassword !== confirmPassword) {
                errorDiv.textContent = 'Passwords do not match';
                errorDiv.style.display = 'block';
                return;
            }

            // Show loading state
            const btn = document.querySelector('#changePasswordModal .account-modal-actions .btn-primary');
            const originalText = btn.textContent;
            btn.textContent = 'Updating...';
            btn.disabled = true;

            // Send request to backend
            fetch('/api/account/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword
                })
            })
            .then(res => res.json())
            .then(data => {
                btn.textContent = originalText;
                btn.disabled = false;

                if (data.success) {
                    showToast('Password updated successfully!', 'success');
                    closeChangePasswordModal();
                } else {
                    errorDiv.textContent = data.message || 'Failed to update password';
                    errorDiv.style.display = 'block';
                }
            })
            .catch(err => {
                btn.textContent = originalText;
                btn.disabled = false;
                errorDiv.textContent = 'An error occurred. Please try again.';
                errorDiv.style.display = 'block';
                console.error(err);
            });
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

                    // Use intermediate points directly from backend
                    scalarSteps = data.steps || [];
                    fpScalarPoints = data.points || [];
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
                    // Label points as intermediate results from double-and-add
                    const lbl = `R${i+1}`;
                    drawPoint(ctx, canvas, pt.x, pt.y, '#166534', 6, lbl);

                     // If toggled, also show coordinates for these intermediate results
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
                const lbl = `R${i+1}`;
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
            // Initialize history system
            initializeLocalHistoryId();
            loadUnifiedHistory();
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
            const menuLogout = document.getElementById('menuLogout');
            if (menuLogout) menuLogout.style.display = (isLoggedIn && !isGuest) ? 'block' : 'none';
            // Update account settings visibility based on login status
            updateAccountSettingsVisibility(isLoggedIn && !isGuest);
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

        function showForgotPassword(ev){
            if (ev && ev.preventDefault) ev.preventDefault();
            const loginForm = document.getElementById('loginForm');
            const forgotForm = document.getElementById('forgotForm');
            const loginUsername = document.getElementById('loginUsername');
            const forgotUsername = document.getElementById('forgotUsername');
            const msgEl = document.getElementById('forgotMsg');
            const errEl = document.getElementById('forgotUsernameErr');
            if (msgEl) msgEl.textContent = '';
            if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
            if (forgotUsername && loginUsername) {
                forgotUsername.value = (loginUsername.value || '').trim();
            }
            if (loginForm && forgotForm) {
                loginForm.style.display = 'none';
                forgotForm.style.display = 'block';
            }
        }

        function cancelForgotPassword(){
            const loginForm = document.getElementById('loginForm');
            const forgotForm = document.getElementById('forgotForm');
            const msgEl = document.getElementById('forgotMsg');
            const errEl = document.getElementById('forgotUsernameErr');
            if (msgEl) msgEl.textContent = '';
            if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
            if (loginForm && forgotForm) {
                forgotForm.style.display = 'none';
                loginForm.style.display = 'block';
            }
        }

        async function submitForgotPassword(){
            const usernameInput = document.getElementById('forgotUsername');
            const errEl = document.getElementById('forgotUsernameErr');
            const msgEl = document.getElementById('forgotMsg');
            const username = (usernameInput && usernameInput.value || '').trim();
            if (!username) {
                if (errEl) {
                    errEl.textContent = 'Username is required';
                    errEl.style.display = 'block';
                }
                return;
            }
            if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
            if (msgEl) msgEl.textContent = 'Sending reset link...';
            try{
                const res = await fetch('/api/password/forgot', {
                    method:'POST',
                    headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({username}),
                    credentials:'same-origin'
                });
                const data = await res.json();
                if(!res.ok || !data.success){
                    if (msgEl) msgEl.textContent = data.message || 'Could not start reset flow';
                    return;
                }
                let msg = data.message || 'If the account exists, a reset link was prepared.';
                if(data.masked_email){ msg += ` Email on file: ${data.masked_email}`; }
                if(data.dev_token){ msg += ' (Dev token present; email may not be sent in this environment.)'; }
                if (msgEl) msgEl.textContent = msg;
            }catch(e){
                if (msgEl) msgEl.textContent = 'Could not start reset flow';
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

        function drawRealPoint(ctx, canvas, pt, color, label, showLabel, size = 5){
            const {px, py} = mapRealToCanvas(canvas, pt.x, pt.y);
            ctx.fillStyle = color; ctx.beginPath(); ctx.arc(px, py, size, 0, 2*Math.PI); ctx.fill();
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
                let stepsHTML = '';
                if (data.steps && data.steps.length > 0) {
                    stepsHTML = `
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
                        <strong>P</strong> = (${formatNum(px)}, ${formatNum(py)})<br>
                        <strong>k</strong> = ${k}<br>
                        <strong>${k} × P</strong> = ${disp}
                    </div>
                    <div class="copy-btn-group">
                        <button class="copy-btn" onclick="copyResultAsText('${resultText}', 'Multiplication result')">📋 Copy Text</button>
                        <button class="copy-btn" onclick='copyResultAsJSON({P: {x: ${px}, y: ${py}}, k: ${k}, result: ${JSON.stringify(data.result)}, steps: ${JSON.stringify(data.steps || [])}}, "Multiplication result")'>📄 Copy JSON</button>
                    </div>
                    ${stepsHTML}
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

            // Draw all computed intermediate points from double-and-add algorithm
            if (realScalarPoints && realScalarPoints.length){
                // Color scheme matching addition style: different colors for each result
                const colors = ['#2563eb', '#f97316', '#166534', '#7c2d12', '#0e42a4'];

                // Draw points with simple style (like point addition visualization)
                for (let i = 0; i < realScalarPoints.length; i++){
                    const pt = realScalarPoints[i];
                    if (pt.x !== null){
                        const pxy = mapRealToCanvas(canvas, pt.x, pt.y);
                        const color = colors[i % colors.length];
                        const size = 6;

                        // Draw filled circle
                        ctx.fillStyle = color;
                        ctx.beginPath();
                        ctx.arc(pxy.px, pxy.py, size, 0, 2 * Math.PI);
                        ctx.fill();

                        // Draw stroke outline (like in point addition)
                        ctx.strokeStyle = color;
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.arc(pxy.px, pxy.py, size + 3, 0, 2 * Math.PI);
                        ctx.stroke();

                        // Draw label - show intermediate results from double-and-add
                        let label = `R${i+1}`;
                        ctx.fillStyle = color;
                        ctx.font = '12px Arial';
                        ctx.textAlign = 'left';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(`${label}`, pxy.px + size + 10, pxy.py);

                        // Show coordinates if toggled
                        if (showLabels){
                            const coord = `(${formatNum(pt.x)}, ${formatNum(pt.y)})`;
                            ctx.font = '10px monospace';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'top';
                            ctx.fillStyle = 'rgba(0,0,0,0.6)';
                            ctx.fillText(coord, pxy.px, pxy.py + 15 + 1);
                            ctx.fillStyle = '#bbb';
                            ctx.fillText(coord, pxy.px, pxy.py + 15);
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
                        const pxy = mapRealToCanvas(canvas, px, py);
                        const color = '#2563eb';
                        const size = 6;

                        // Draw filled circle
                        ctx.fillStyle = color;
                        ctx.beginPath();
                        ctx.arc(pxy.px, pxy.py, size, 0, 2 * Math.PI);
                        ctx.fill();

                        // Draw stroke outline
                        ctx.strokeStyle = color;
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.arc(pxy.px, pxy.py, size + 3, 0, 2 * Math.PI);
                        ctx.stroke();

                        // Draw label
                        ctx.fillStyle = color;
                        ctx.font = '12px Arial';
                        ctx.textAlign = 'left';
                        ctx.textBaseline = 'middle';
                        ctx.fillText('P', pxy.px + size + 10, pxy.py);
                    }
                }
            }
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
    if (type.includes('encrypt')) return '<i class="fa-solid fa-lock" aria-hidden="true"></i>';
    if (type.includes('decrypt')) return '<i class="fa-solid fa-lock-open" aria-hidden="true"></i>';
    if (type.includes('dh') || type.includes('key_exchange')) return '<i class="fa-solid fa-handshake" aria-hidden="true"></i>';
    if (type.includes('discrete_log') || type.includes('attack')) return '<i class="fa-solid fa-shield" aria-hidden="true"></i>';
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
                if (item.operation_type === 'encrypt'){
                    const inputLabel = p.input_type === 'file' ? `File: ${p.filename || 'unknown'}` : `Text: ${(p.plaintext || '').substring(0, 30)}${(p.plaintext || '').length > 30 ? '...' : ''}`;
                    return `${inputLabel} → Format: ${p.output_format === 'json' ? 'JSON' : 'Base64'}`;
                }
                if (item.operation_type === 'decrypt'){
                    const format = p.format_detected || 'Unknown';
                    const status = r.success ? '✓ Success' : '✗ Failed';
                    return `${status} - Format: ${format}`;
                }
                if (item.operation_type === 'key_exchange' || item.operation_type === 'diffie_hellman'){
                    return `DH Demo - Alice secret: ${p.alice_secret || '?'}, Bob secret: ${p.bob_secret || '?'}, Shared: ${r.match ? '✓' : '✗'}`;
                }
                if (item.operation_type === 'discrete_log_attack'){
                    return `Discrete Log Attack - Attempts: ${p.attempts || 0}, ${r.success ? '✓ Found' : '✗ Not found'}`;
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

        // =================== MENU SEARCH & FILTERING =================== //

        // Filter menu items based on search input
        function filterMenuItems() {
            const searchInput = document.getElementById('menuSearchInput');
            if (!searchInput) return; // Guard clause for missing search input

            const searchValue = searchInput.value.toLowerCase().trim();
            const menuCards = document.querySelectorAll('.menu-card');
            const menuSections = document.querySelectorAll('.menu-section');
            const searchClear = document.getElementById('menuSearchClear');

            // Show/hide clear button
            if (searchClear) {
                searchClear.style.display = searchValue ? 'block' : 'none';
            }

            // If search is empty, show everything
            if (!searchValue) {
                menuCards.forEach(card => card.classList.remove('hidden', 'search-highlight'));
                menuSections.forEach(section => {
                    section.classList.remove('hidden');
                    // Show all cards in section
                    section.querySelectorAll('.menu-card').forEach(card => {
                        card.classList.remove('hidden');
                    });
                });
                return;
            }

            // Hide all sections initially
            menuSections.forEach(section => section.classList.add('hidden'));

            // Filter and show matching items
            let hasVisibleItems = false;
            menuSections.forEach(section => {
                let sectionHasVisibleItems = false;
                const cardsInSection = section.querySelectorAll('.menu-card');

                cardsInSection.forEach(card => {
                    const cardText = card.getAttribute('data-menu-text') || '';
                    const cardLabel = card.querySelector('.menu-card-label')?.textContent.toLowerCase() || '';
                    const cardHint = card.querySelector('.menu-card-hint')?.textContent.toLowerCase() || '';
                    const cardTitle = card.getAttribute('title')?.toLowerCase() || '';

                    // Check if search matches any of the card's text fields
                    if (cardText.includes(searchValue) ||
                        cardLabel.includes(searchValue) ||
                        cardHint.includes(searchValue) ||
                        cardTitle.includes(searchValue)) {
                        card.classList.remove('hidden');
                        card.classList.add('search-highlight');
                        sectionHasVisibleItems = true;
                        hasVisibleItems = true;
                    } else {
                        card.classList.add('hidden');
                        card.classList.remove('search-highlight');
                    }
                });

                // Show section if it has visible items
                if (sectionHasVisibleItems) {
                    section.classList.remove('hidden');
                }
            });

            // If no items found, show a message
            if (!hasVisibleItems && document.querySelector('.menu-no-results') === null) {
                const noResultsMsg = document.createElement('div');
                noResultsMsg.className = 'menu-no-results';
                noResultsMsg.innerHTML = `
                    <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
                        <i class="fa-solid fa-search" style="font-size: 2em; margin-bottom: 10px; opacity: 0.5;"></i>
                        <p style="margin: 10px 0 0 0;">No menu items found</p>
                        <small style="font-size: 0.85em;">Try a different search term</small>
                    </div>
                `;
                document.querySelector('.history-panel-content').appendChild(noResultsMsg);
            } else if (hasVisibleItems && document.querySelector('.menu-no-results') !== null) {
                document.querySelector('.menu-no-results')?.remove();
            }
        }

        // Clear menu search
        function clearMenuSearch() {
            const searchInput = document.getElementById('menuSearchInput');
            const searchClear = document.getElementById('menuSearchClear');

            if (!searchInput) return; // Guard clause for missing search input

            searchInput.value = '';
            if (searchClear) {
                searchClear.style.display = 'none';
            }
            filterMenuItems();
            searchInput.focus();
        }

        function toggleMenuSection(header) {
            // Handle keyboard events (Enter or Space)
            if (event && event.type === 'keydown') {
                if (event.key !== 'Enter' && event.key !== ' ') {
                    return;
                }
                event.preventDefault();
            }
            // Don't toggle if clicking on buttons within the header
            else if (event && event.target.closest('button')) {
                event.stopPropagation();
                return;
            }

            const section = header.closest('.menu-section');
            const content = section.querySelector('.menu-section-content');
            const chevron = header.querySelector('.menu-section-chevron');
            const isExpanded = header.getAttribute('aria-expanded') === 'true';

            if (content) {
                content.style.display = isExpanded ? 'none' : 'grid';
                header.setAttribute('aria-expanded', !isExpanded);
                if (chevron) {
                    chevron.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(180deg)';
                }
            }
        }

        // =================== CLIENT-SIDE HISTORY MANAGEMENT =================== //

        // Storage key for local operations history
        const LOCAL_HISTORY_KEY = 'elliptic_curve_local_history';
        let localHistoryId = 0;

        // Add an operation to local history
        function addToLocalHistory(operationType, parameters, result) {
            try {
                const timestamp = new Date().toISOString();
                const entry = {
                    id: ++localHistoryId,
                    operation_type: operationType,
                    parameters,
                    result,
                    timestamp,
                    is_local: true
                };

                let history = JSON.parse(localStorage.getItem(LOCAL_HISTORY_KEY) || '[]');
                history.push(entry);

                // Keep only last 100 local operations
                if (history.length > 100) {
                    history = history.slice(-100);
                }

                localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(history));

                // Refresh the unified history display
                loadUnifiedHistory();

                return entry;
            } catch (error) {
                console.error('Failed to add local history:', error);
            }
        }

        // Get all local history from storage
        function getLocalHistory() {
            try {
                return JSON.parse(localStorage.getItem(LOCAL_HISTORY_KEY) || '[]');
            } catch (error) {
                console.error('Failed to retrieve local history:', error);
                return [];
            }
        }

        // Clear local history
        function clearLocalHistory() {
            try {
                localStorage.removeItem(LOCAL_HISTORY_KEY);
                localHistoryId = 0;
            } catch (error) {
                console.error('Failed to clear local history:', error);
            }
        }

        // Initialize local history ID from storage
        function initializeLocalHistoryId() {
            try {
                const history = getLocalHistory();
                if (history.length > 0) {
                    localHistoryId = Math.max(...history.map(h => h.id || 0));
                }
            } catch (error) {
                console.error('Failed to initialize history ID:', error);
            }
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

                // Include local history (encryption, decryption, DH demo, etc.)
                const localHistory = getLocalHistory().map(item => ({
                    ...item,
                    curveType: 'Local'
                }));

                const allHistory = [...fpHistory, ...realHistory, ...localHistory];

                // Sort by ID (descending) - assuming higher ID = more recent
                allHistory.sort((a, b) => (b.id || 0) - (a.id || 0));

                displayUnifiedHistory(allHistory);
            } catch (error) {
                console.error('Failed to load unified history:', error);
                const listElement = document.getElementById('unifiedHistoryList');

                // Show at least local history even if API fails
                const localHistory = getLocalHistory().map(item => ({
                    ...item,
                    curveType: 'Local'
                }));

                if (localHistory.length > 0) {
                    localHistory.sort((a, b) => (b.id || 0) - (a.id || 0));
                    displayUnifiedHistory(localHistory);
                } else if (listElement) {
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
                const curveTypeClass = item.curveType === 'Fp' ? 'fp' : item.curveType === 'ℝ' ? 'real' : 'local';
                const curveTypeBadge = `<span class="curveType-badge ${curveTypeClass}">${item.curveType}</span>`;
                const timestamp = new Date(item.timestamp).toLocaleString();

                return `
                    <div class="history-item" data-op="${item.operation_type || ''}" onclick="replayOperation(${item.id})">
                        <span class="operation-icon">${icon}</span>
                        <div class="operation-details">
                            <div class="operation-type">
                                ${item.operation_type.replace(/_/g, ' ').toUpperCase()}
                                ${curveTypeBadge}
                            </div>
                            <div class="operation-params">${desc}</div>
                            <div class="timestamp">${timestamp}</div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        function refreshUnifiedHistory(e) {
            if (e) {
                e.stopPropagation();
            }
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

        async function clearUnifiedHistory(e) {
            if (e) {
                e.stopPropagation();
            }
            if (!confirm('Clear all history (Fp, ℝ curves, and local operations)?')) return;

            try {
                await Promise.all([
                    fetch('/api/history/clear/fp', { method: 'DELETE' }),
                    fetch('/api/history/clear/real', { method: 'DELETE' })
                ]);

                // Also clear local history
                clearLocalHistory();

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
            usedCustomKey: false,
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
            const keyInput = document.getElementById('encryptionPrivateKey');
            const keyRaw = keyInput ? keyInput.value.trim() : '';
            let customPrivateKey = null;

            if (keyRaw !== '') {
                customPrivateKey = parseInt(keyRaw, 10);
                if (isNaN(customPrivateKey)) {
                    showToast('Please enter a valid number for the private key', 'error');
                    return;
                }
                if (customPrivateKey <= 0 || customPrivateKey >= p) {
                    showToast('Private key must be between 1 and p-1', 'error');
                    return;
                }
            }

            if (isNaN(a) || isNaN(b) || isNaN(p)) {
                showToast('Please enter valid curve parameters', 'error');
                return;
            }

            showLoading('Initializing encryption system...');

            try {
                const payload = { a, b, p };
                if (customPrivateKey !== null) {
                    payload.private_key = customPrivateKey;
                    console.log('INIT: Sending custom private_key:', customPrivateKey);
                } else {
                    console.log('INIT: No custom key provided - backend will generate random key');
                }

                console.log('INIT: Full payload:', payload);

                const response = await fetch('/api/encryption/init', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();
                hideLoading();

                if (data.success) {
                    encryptionState.initialized = true;
                    encryptionState.curve = { a, b, p };
                    encryptionState.generator = data.generator;
                    encryptionState.privateKey = data.private_key;
                    encryptionState.publicKey = data.public_key;
                    encryptionState.usedCustomKey = !!data.used_custom_key;

                    // Display system information
                    const infoDiv = document.getElementById('encryptionSystemInfo');
                    infoDiv.innerHTML = '<div class="result-box success"><h3>✓ ' + data.message + '</h3><p>Total points on curve: ' + data.num_points + '</p></div>';

                    // Display key information
                    const keyInfoDiv = document.getElementById('encryptionKeyInfo');
                    const keySourceText = data.used_custom_key ? 'Using your provided private key.' : 'Private key generated randomly.';
                    keyInfoDiv.innerHTML = '<div class="result-box"><h3>Curve Parameters</h3><p><strong>Equation:</strong> y² = x³ + ' + a + 'x + ' + b + ' (mod ' + p + ')</p><p><strong>Generator G:</strong> (' + data.generator.x + ', ' + data.generator.y + ')</p><hr style="margin: 10px 0; border: none; border-top: 1px solid #444;"><h3>Your Keys</h3><p><strong>Private Key (d):</strong> ' + data.private_key + (data.used_custom_key ? ' (custom)' : ' (generated)') + '</p><p><strong>Public Key (Q):</strong> (' + data.public_key.x + ', ' + data.public_key.y + ')</p><p style="font-size: 0.9em; color: #888; margin-top: 10px;">Q = d × G. ' + keySourceText + '</p></div>';

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
                    const outputFormat = document.getElementById('encryptionOutputFormat')?.value || 'json';

                    let outputText, outputLabel;
                    if (outputFormat === 'ciphertext') {
                        // Convert ciphertext to base64 compact format
                        const ciphertextCompact = btoa(JSON.stringify(data.ciphertext));
                        outputText = ciphertextCompact;
                        outputLabel = 'Ciphertext (Base64)';
                    } else {
                        // JSON format
                        outputText = JSON.stringify(data.ciphertext, null, 2);
                        outputLabel = 'Ciphertext (JSON)';
                    }

                    resultDiv.innerHTML = '<div class="result-box success"><h3>✓ Message Encrypted</h3>' + detailHtml + '<p><strong>Length:</strong> ' + payloadLength + ' bytes</p><p><strong>Format:</strong> ' + (outputFormat === 'json' ? 'JSON (Full Details)' : 'Ciphertext (Compact)') + '</p><hr style="margin: 10px 0; border: none; border-top: 1px solid #444;"><h4>' + outputLabel + ':</h4><textarea readonly rows="6" style="width: 100%; font-family: monospace; font-size: 0.85em;">' + outputText + '</textarea><button onclick="copyCiphertextToDecrypt()" style="margin-top: 10px;">Copy to Decrypt Tab</button></div>';

                    document.getElementById('encryptionStepsDisplay').innerHTML = '';
                    displayEncryptionSteps(data.steps);

                    drawEncryptionVisualization(data.ciphertext);

                    enableEncryptionAnimationControls(data.steps.length);

                    if (fileInput) {
                        fileInput.value = '';
                    }

                    // Log to history
                    addToLocalHistory('encrypt', {
                        input_type: file ? 'file' : 'text',
                        filename: file?.name || null,
                        plaintext: plaintext || null,
                        output_format: outputFormat,
                        payload_length: payloadLength
                    }, {
                        success: true,
                        ciphertext_length: outputText.length
                    });

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
            // IMPORTANT: Require HMAC tag for authentication
            if (!obj.hmac_tag || typeof obj.hmac_tag !== 'string') {
                console.warn('WARNING: No HMAC tag found in ciphertext. Using old format without authentication.');
                return true; // Accept old format but log warning
            }
            return true;
        }

        async function decryptMessage() {
            if (!encryptionState.initialized) {
                showToast('Please initialize the encryption system first', 'error');
                return;
            }

            console.log('DEBUG: Starting decryption...');
            const ciphertextField = document.getElementById('ciphertextInput');
            const fileInput = document.getElementById('decryptionFileInput');
            const file = fileInput?.files?.[0];
            let ciphertextText = '';

            if (file) {
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

            // Auto-detect format: try JSON first, then base64 ciphertext
            let ciphertext;
            try {
                // Try parsing as JSON
                ciphertext = JSON.parse(ciphertextText);
                console.log('DEBUG: Parsed ciphertext object:', ciphertext);
                console.log('DEBUG: Has HMAC tag?', !!ciphertext.hmac_tag);
                if (!isValidCiphertextObject(ciphertext)) {
                    throw new Error('Invalid JSON structure');
                }
            } catch (e) {
                // If JSON parsing fails, try decoding as base64 ciphertext
                try {
                    const decodedText = atob(ciphertextText.trim());
                    ciphertext = JSON.parse(decodedText);
                    console.log('DEBUG: Decoded base64 ciphertext object:', ciphertext);
                    console.log('DEBUG: Has HMAC tag?', !!ciphertext.hmac_tag);
                    if (!isValidCiphertextObject(ciphertext)) {
                        showToast('Invalid ciphertext format', 'error');
                        return;
                    }
                    showToast('Detected compact ciphertext format', 'info');
                } catch (decodeError) {
                    showToast('Invalid format. Please provide JSON or base64 ciphertext.', 'error');
                    return;
                }
            }

            showLoading('Decrypting message...');

            try {
                // Always use session key for decryption (initialized key)
                const currentPrivateKeyValue = null;
                console.log('DECRYPTION: Using session key (private key set during initialization)');

                const response = await fetch('/api/encryption/decrypt', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ciphertext,
                        current_private_key: currentPrivateKeyValue
                    })
                });

                const data = await response.json();
                hideLoading();

                console.log('DEBUG: Backend response:', data);
                console.log('DEBUG: HMAC verified?', data.hmac_verified);

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

                    // Log to history
                    let formatDetected = 'JSON';
                    try {
                        JSON.parse(ciphertextText);
                    } catch {
                        formatDetected = 'Base64';
                    }

                    addToLocalHistory('decrypt', {
                        format_detected: formatDetected,
                        plaintext_length: data.plaintext?.length || 0
                    }, {
                        success: true,
                        plaintext: data.plaintext?.substring(0, 50) || null
                    });

                    showToast('Message decrypted successfully!', 'success');
                } else if (!data.hmac_verified) {
                    // HMAC verification failed - DO NOT show plaintext at all
                    const resultDiv = document.getElementById('decryptionResult');
                    const errorHtml = `
                        <div class="result-box error" style="border: 3px solid #ef4444;">
                            <h3 style="color: #ef4444;">❌ DECRYPTION FAILED</h3>
                            <p style="color: #ef4444; font-size: 1.1em; font-weight: bold;">Authentication Tag Verification FAILED!</p>
                            <p style="color: #ef4444;"><strong>${data.error}</strong></p>
                            <div style="padding: 15px; background: #1a1a1a; border-radius: 8px; margin: 15px 0; border: 2px dashed #ef4444;">
                                <p style="font-size: 0.9em; color: #aaa;">⚠️ <strong>OUTPUT NOT DISPLAYED</strong> - The decryption failed cryptographic verification.</p>
                                <p style="font-size: 0.85em; color: #888;">The HMAC authentication tag does not match. This indicates that either:</p>
                                <ul style="color: #888; font-size: 0.85em;">
                                    <li>The wrong private key was used to decrypt</li>
                                    <li>The ciphertext has been corrupted or tampered with</li>
                                </ul>
                            </div>
                            <p style="color: #ef4444; font-size: 0.9em; margin-top: 15px;"><strong>Action:</strong> Use the correct private key or verify the ciphertext is valid.</p>
                        </div>
                    `;
                    resultDiv.innerHTML = errorHtml;

                    // Display steps
                    displayDecryptionSteps(data.steps);

                    // Draw visualization
                    drawDecryptionVisualization(ciphertext, data.shared_secret_point);

                    if (fileInput) {
                        fileInput.value = '';
                    }

                    addToLocalHistory('decrypt', {
                        format_detected: 'JSON',
                        plaintext_length: data.plaintext?.length || 0,
                        hmac_verified: false
                    }, {
                        success: false,
                        error: 'Wrong private key detected',
                        plaintext: data.plaintext?.substring(0, 50) || null
                    });

                    showToast('❌ Wrong private key! Output is garbage data.', 'error');
                } else {
                    showToast('Error: ' + data.error, 'error');
                }
            } catch (error) {
                hideLoading();
                showToast('Failed to decrypt message', 'error');
                console.error(error);
            }
        }

        // Helper functions for encryption/decryption UI
        function switchEncryptInputMethod(method) {
            const textTab = document.getElementById('encryptTextTab');
            const fileTab = document.getElementById('encryptFileTab');
            const textInput = document.getElementById('encryptTextInput');
            const fileInput = document.getElementById('encryptFileInput');

            if (method === 'text') {
                textTab.classList.add('active');
                fileTab.classList.remove('active');
                textInput.classList.add('active');
                fileInput.classList.remove('active');
            } else {
                textTab.classList.remove('active');
                fileTab.classList.add('active');
                textInput.classList.remove('active');
                fileInput.classList.add('active');
            }
        }

        function switchDecryptInputMethod(method) {
            const pasteTab = document.getElementById('decryptPasteTab');
            const fileTab = document.getElementById('decryptFileTab');
            const pasteInput = document.getElementById('decryptPasteInput');
            const fileInput = document.getElementById('decryptFileInput');

            if (method === 'paste') {
                pasteTab.classList.add('active');
                fileTab.classList.remove('active');
                pasteInput.classList.add('active');
                fileInput.classList.remove('active');
            } else {
                pasteTab.classList.remove('active');
                fileTab.classList.add('active');
                pasteInput.classList.remove('active');
                fileInput.classList.add('active');
            }
        }

        function updateCharCount() {
            const textarea = document.getElementById('plaintextInput');
            const charCountEl = document.getElementById('charCount');
            const count = textarea?.value?.length || 0;
            charCountEl.textContent = count + ' character' + (count !== 1 ? 's' : '');
        }

        function updateFileInfo(input, targetId) {
            const file = input.files[0];
            const infoDiv = document.getElementById(targetId);
            if (file) {
                const size = (file.size / 1024).toFixed(2);
                infoDiv.innerHTML = `
                    <div class="file-selected">
                        <i class="fa-solid fa-file-check"></i>
                        <div class="file-details">
                            <strong>${file.name}</strong>
                            <span>${size} KB • ${file.type || 'Unknown type'}</span>
                        </div>
                        <button type="button" onclick="clearFileInput('${input.id}', '${targetId}')" class="file-remove-btn">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                `;
            } else {
                infoDiv.innerHTML = '';
            }
        }

        function clearFileInput(inputId, infoId) {
            const input = document.getElementById(inputId);
            const infoDiv = document.getElementById(infoId);
            if (input) input.value = '';
            if (infoDiv) infoDiv.innerHTML = '';
        }

        function selectFormat(format) {
            const jsonRadio = document.getElementById('formatJson');
            const ciphertextRadio = document.getElementById('formatCiphertext');
            const select = document.getElementById('encryptionOutputFormat');

            if (format === 'json') {
                jsonRadio.checked = true;
                select.value = 'json';
            } else {
                ciphertextRadio.checked = true;
                select.value = 'ciphertext';
            }
        }

        function updateCiphertextInfo() {
            const textarea = document.getElementById('ciphertextInput');
            const formatBadge = document.getElementById('ciphertextFormat');
            const lengthBadge = document.getElementById('ciphertextLength');
            const text = textarea?.value || '';

            lengthBadge.textContent = text.length + ' chars';

            if (!text) {
                formatBadge.innerHTML = '<i class="fa-solid fa-circle-question"></i> Waiting for input';
                formatBadge.className = 'format-badge';
                return;
            }

            try {
                JSON.parse(text);
                formatBadge.innerHTML = '<i class="fa-solid fa-code"></i> JSON detected';
                formatBadge.className = 'format-badge json';
            } catch {
                formatBadge.innerHTML = '<i class="fa-solid fa-compress"></i> Ciphertext detected';
                formatBadge.className = 'format-badge ciphertext';
            }
        }

        function clearCiphertext() {
            document.getElementById('ciphertextInput').value = '';
            updateCiphertextInfo();
        }

        function pasteSampleCiphertext() {
            showToast('Generate a ciphertext first using the Encrypt tab', 'info');
        }

        function copyCiphertextToDecrypt() {
            const ciphertext = JSON.stringify(encryptionState.currentCiphertext, null, 2);
            document.getElementById('ciphertextInput').value = ciphertext;
            selectEncryptionPane('decryptPane');
            updateCiphertextInfo();
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
            demoData: null,
            animFrame: null,
            animTick: 0
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

            let html = '';
            data.steps.forEach((step, index) => {
                const isActive = index === dhState.currentStep ? 'active' : '';
                html += `
                    <div class="step-item ${isActive}" id="dh-tab-step-${index}" data-step-number="${index + 1}">
                        <div class="step-header">
                            <span>${step.description}</span>
                        </div>
                        <div class="step-content">
                            ${step.detail}
                            ${step.calculation ? '<br><code>' + step.calculation + '</code>' : ''}
                        </div>
                    </div>
                `;
            });

            container.innerHTML = html;

            // Show summary
            resultDiv.innerHTML = `
                <div class="result-box">
                    <h3>Key Exchange Complete</h3>
                    <p><strong>Base Point (G):</strong> (${data.summary.base_point.x}, ${data.summary.base_point.y})</p>
                    <p><strong>Alice's Private Key (a):</strong> ${data.summary.alice_private}</p>
                    <p><strong>Alice's Public Key (A):</strong> (${data.summary.alice_public.x}, ${data.summary.alice_public.y})</p>
                    <p><strong>Bob's Private Key (b):</strong> ${data.summary.bob_private}</p>
                    <p><strong>Bob's Public Key (B):</strong> (${data.summary.bob_public.x}, ${data.summary.bob_public.y})</p>
                    <p style="color: #10b981; font-size: 1.05em; margin-top: 12px;"><strong>🔑 Shared Secret:</strong> (${data.summary.shared_secret.x}, ${data.summary.shared_secret.y})</p>
                </div>
            `;

            // Show animation controls and canvas
            const controls = document.getElementById('dhAnimControls');
            controls.classList.add('active');

            const slider = document.getElementById('dhStepSlider');
            slider.max = Math.max(0, data.steps.length - 1);
            slider.value = 0;

            const canvas = document.getElementById('dhCanvas');
            const canvasHint = document.getElementById('dhCanvasHint');
            if (canvas && canvasHint) {
                if (data.steps.length) {
                    canvas.style.display = 'block';
                    canvas.classList.add('visible');
                    canvasHint.style.display = 'none';
                } else {
                    canvas.style.display = 'none';
                    canvas.classList.remove('visible');
                    canvasHint.style.display = 'flex';
                }
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
            const playBtn = document.getElementById('dhPlayBtn');
            if (dhState.animationInterval) {
                clearInterval(dhState.animationInterval);
                dhState.animationInterval = null;
                playBtn.innerHTML = '<i class="fa-solid fa-play"></i><span>Play</span>';
            } else {
                playBtn.innerHTML = '<i class="fa-solid fa-pause"></i><span>Pause</span>';
                dhState.animationInterval = setInterval(() => {
                    if (dhState.currentStep < dhState.steps.length - 1) {
                        nextDHStep();
                    } else {
                        clearInterval(dhState.animationInterval);
                        dhState.animationInterval = null;
                        playBtn.innerHTML = '<i class="fa-solid fa-play"></i><span>Play</span>';
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
            ensureDHAnimationLoop();
        }

        function ensureDHAnimationLoop() {
            if (dhState.animFrame) return;
            const tick = () => {
                dhState.animTick = (dhState.animTick + 1) % 1000000;
                drawDHVisualization();
                dhState.animFrame = requestAnimationFrame(tick);
            };
            dhState.animFrame = requestAnimationFrame(tick);
        }

        function drawDHVisualization() {
            const canvas = document.getElementById('dhCanvas');
            if (!canvas || !dhState.demoData) return;

            const ctx = canvas.getContext('2d');
            const width = canvas.width;
            const height = canvas.height;

            ctx.clearRect(0, 0, width, height);

            const stepIndex = dhState.currentStep;
            const currentStep = dhState.steps[stepIndex] || {};
            const totalSteps = dhState.steps.length || 1;

            const t = dhState.animTick || 0;
            const pulse = 0.35 + 0.3 * Math.sin(t * 0.06);
            const pulseSlow = 0.35 + 0.25 * Math.sin(t * 0.03);
            const travel = (t % 320) / 320;
            const travelOffset = ((t + 160) % 320) / 320;

            const isDark = document.body.getAttribute('data-theme') === 'dark';
            const colors = {
                alice: '#f472b6', // soft coral
                bob: '#38bdf8',   // sky blue
                shared: '#22c55e',
                base: '#facc15',
                channel: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(56,189,248,0.08)',
                text: isDark ? '#e8edff' : '#0f172a',
                textSubtle: isDark ? '#cdd6f5' : '#475569',
                border: isDark ? 'rgba(232,237,255,0.25)' : 'rgba(15,23,42,0.08)',
                bgTop: isDark ? '#0c1224' : '#f9fafb',
                bgBottom: isDark ? '#111a33' : '#edf2ff'
            };

            const aliceX = 170;
            const bobX = width - 170;
            const actorY = 220;
            const channelTop = 120;
            const channelHeight = 170;
            const baseY = 80;
            const sharedY = height - 58;

            const showBase = stepIndex >= 0;
            const showAlicePrivate = stepIndex >= 1;
            const showAlicePublic = stepIndex >= 2;
            const showBobPrivate = stepIndex >= 3;
            const showBobPublic = stepIndex >= 4;
            const showExchange = stepIndex >= 5;
            const showComputeAlice = stepIndex >= 6;
            const showComputeBob = stepIndex >= 7;
            const showSharedSecret = stepIndex >= 8;

            // Soft gradient backdrop
            const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
            bgGradient.addColorStop(0, colors.bgTop);
            bgGradient.addColorStop(1, colors.bgBottom);
            ctx.fillStyle = bgGradient;
            ctx.fillRect(0, 0, width, height);

            // Ambient blobs for depth
            drawBlob(ctx, width * 0.22, height * 0.18, 200, isDark ? 'rgba(56,189,248,0.08)' : 'rgba(56,189,248,0.12)');
            drawBlob(ctx, width * 0.78, height * 0.85, 240, isDark ? 'rgba(244,114,182,0.08)' : 'rgba(244,114,182,0.12)');

            // Decorative glow behind canvas content
            if (showSharedSecret) {
                drawHalo(ctx, width / 2, sharedY, 120 + 20 * pulseSlow, colors.shared, 0.08);
            }
            if (showBase) {
                drawHalo(ctx, width / 2, baseY, 90 + 15 * pulseSlow, colors.base, 0.06);
            }

            // Public channel band
            drawRoundedRect(ctx, 70, channelTop, width - 140, channelHeight, 18, colors.channel, colors.border, 10);
            ctx.fillStyle = colors.textSubtle;
            ctx.font = '12.5px "Inter", system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Public channel (visible to everyone)', width / 2, channelTop + 18);

            // Title and active step
            ctx.fillStyle = colors.text;
            ctx.font = '600 18px "Inter", system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Diffie-Hellman Key Exchange', width / 2, 22);
            ctx.fillStyle = colors.textSubtle;
            ctx.font = '13px "Inter", system-ui, sans-serif';
            const stepLabel = currentStep.description ? `Step ${stepIndex + 1}/${totalSteps}: ${currentStep.description}` : `Step ${stepIndex + 1}/${totalSteps}`;
            ctx.fillText(stepLabel, width / 2, 42);
            drawProgressPill(ctx, width - 200, 18, 160, 12, stepIndex, totalSteps, colors);

            // Base point card
            if (showBase) {
                drawInfoCard(
                    ctx,
                    width / 2 - 105,
                    baseY - 20,
                    210,
                    55,
                    colors.base,
                    'Base point G',
                    `(${dhState.demoData.summary.base_point.x}, ${dhState.demoData.summary.base_point.y})`
                );
            }

            // Participants
            drawActor(ctx, aliceX, actorY, colors.alice, 'Alice', pulseSlow);
            drawActor(ctx, bobX, actorY, colors.bob, 'Bob', pulseSlow);

            if (showAlicePrivate) {
                drawTag(ctx, aliceX, actorY + 54, colors.alice, `Private: a = ${dhState.demoData.summary.alice_private}`);
            }
            if (showBobPrivate) {
                drawTag(ctx, bobX, actorY + 54, colors.bob, `Private: b = ${dhState.demoData.summary.bob_private}`);
            }

            // Public keys derived from G
            if (showAlicePublic) {
                drawArrow(ctx, width / 2 - 10, baseY + 30, aliceX, actorY - 35, colors.alice, 2.5, false, true, -t * 0.5);
                drawMovingDot(ctx, width / 2 - 10, baseY + 30, aliceX, actorY - 35, colors.alice, travel, 5.5);
                drawTag(ctx, aliceX, actorY - 55, colors.alice, 'A = a × G');
                drawSubLabel(ctx, aliceX, actorY - 68, colors.textSubtle, `(${dhState.demoData.summary.alice_public.x}, ${dhState.demoData.summary.alice_public.y})`);
            }

            if (showBobPublic) {
                drawArrow(ctx, width / 2 + 10, baseY + 30, bobX, actorY - 35, colors.bob, 2.5, false, true, -t * 0.5);
                drawMovingDot(ctx, width / 2 + 10, baseY + 30, bobX, actorY - 35, colors.bob, travelOffset, 5.5);
                drawTag(ctx, bobX, actorY - 55, colors.bob, 'B = b × G');
                drawSubLabel(ctx, bobX, actorY - 68, colors.textSubtle, `(${dhState.demoData.summary.bob_public.x}, ${dhState.demoData.summary.bob_public.y})`);
            }

            // Exchange over the public channel
            if (showExchange) {
                drawArrow(ctx, aliceX + 38, actorY - 8, bobX - 38, actorY - 8, colors.alice, 3.2, true, false, -t * 1.6);
                drawArrow(ctx, bobX - 38, actorY + 18, aliceX + 38, actorY + 18, colors.bob, 3.2, true, false, t * 1.6);
                drawMovingDot(ctx, aliceX + 38, actorY - 8, bobX - 38, actorY - 8, colors.alice, travel, 6);
                drawMovingDot(ctx, bobX - 38, actorY + 18, aliceX + 38, actorY + 18, colors.bob, travelOffset, 6);
                drawSubLabel(ctx, (aliceX + bobX) / 2, actorY - 20, colors.textSubtle, 'Send A openly');
                drawSubLabel(ctx, (aliceX + bobX) / 2, actorY + 35, colors.textSubtle, 'Send B openly');
            }

            if (showComputeAlice) {
                drawTag(ctx, aliceX, actorY + 82, colors.alice, 'Compute S = a × B');
            }
            if (showComputeBob) {
                drawTag(ctx, bobX, actorY + 82, colors.bob, 'Compute S = b × A');
            }

            // Shared secret visualization
            if (showSharedSecret) {
                drawArrow(ctx, aliceX + 12, actorY + 35, width / 2 - 30, sharedY - 25, colors.shared, 2, false, true, -t);
                drawArrow(ctx, bobX - 12, actorY + 35, width / 2 + 30, sharedY - 25, colors.shared, 2, false, true, t);
                drawMovingDot(ctx, aliceX + 12, actorY + 35, width / 2 - 30, sharedY - 25, colors.shared, travel, 6);
                drawMovingDot(ctx, bobX - 12, actorY + 35, width / 2 + 30, sharedY - 25, colors.shared, travelOffset, 6);

                ctx.save();
                ctx.shadowColor = colors.shared;
                ctx.shadowBlur = 16 + 7 * pulse;
                ctx.fillStyle = colors.shared;
                ctx.beginPath();
                ctx.arc(width / 2, sharedY, 26 + 2.5 * pulse, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();

                ctx.fillStyle = '#fff';
                ctx.font = 'bold 17px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('🔑', width / 2, sharedY + 6);
                ctx.fillStyle = colors.text;
                ctx.font = '12px "Inter", system-ui, sans-serif';
                ctx.fillText('Shared secret', width / 2, sharedY - 34);
                ctx.fillStyle = colors.textSubtle;
                ctx.fillText(`(${dhState.demoData.summary.shared_secret.x}, ${dhState.demoData.summary.shared_secret.y})`, width / 2, sharedY - 18);
            }

            // Legend for quick reading
            drawLegend(ctx, width - 175, 20, colors, isDark);

            function drawRoundedRect(context, x, y, w, h, r, fill, stroke, shadow = 0) {
                context.save();
                if (shadow) {
                    context.shadowColor = 'rgba(0,0,0,0.15)';
                    context.shadowBlur = shadow;
                    context.shadowOffsetY = 4;
                }
                context.beginPath();
                context.moveTo(x + r, y);
                context.lineTo(x + w - r, y);
                context.quadraticCurveTo(x + w, y, x + w, y + r);
                context.lineTo(x + w, y + h - r);
                context.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
                context.lineTo(x + r, y + h);
                context.quadraticCurveTo(x, y + h, x, y + h - r);
                context.lineTo(x, y + r);
                context.quadraticCurveTo(x, y, x + r, y);
                context.closePath();
                context.fillStyle = fill;
                context.fill();
                context.strokeStyle = stroke;
                context.lineWidth = 1;
                context.stroke();
                context.restore();
            }

            function drawInfoCard(context, x, y, w, h, color, title, subtitle) {
                drawRoundedRect(context, x, y, w, h, 10, `${color}22`, colors.border);
                context.fillStyle = color;
                context.font = 'bold 12px sans-serif';
                context.textAlign = 'center';
                context.fillText(title, x + w / 2, y + 18);
                context.fillStyle = colors.text;
                context.font = '12px sans-serif';
                context.fillText(subtitle, x + w / 2, y + h - 12);
            }

            function drawActor(context, x, y, color, label, pulse = 0.5) {
                context.save();
                context.shadowColor = `${color}66`;
                context.shadowBlur = 14 + 6 * pulse;
                context.fillStyle = color;
                context.beginPath();
                context.arc(x, y, 34, 0, Math.PI * 2);
                context.fill();
                context.restore();

                // Outer ring
                context.strokeStyle = `${color}55`;
                context.lineWidth = 3;
                context.beginPath();
                context.arc(x, y, 38 + 2 * pulse, 0, Math.PI * 2);
                context.stroke();

                context.fillStyle = '#fff';
                context.font = 'bold 18px "Inter", system-ui, sans-serif';
                context.textAlign = 'center';
                context.fillText(label[0], x, y + 6);
                context.fillStyle = colors.text;
                context.font = '14px "Inter", system-ui, sans-serif';
                context.fillText(label, x, y - 48);
            }

            function drawTag(context, x, y, color, text) {
                context.save();
                const padding = 8;
                context.font = '11.5px "Inter", system-ui, sans-serif';
                const textWidth = context.measureText(text).width;
                const boxWidth = textWidth + padding * 2;
                const boxHeight = 20;
                drawRoundedRect(context, x - boxWidth / 2, y - boxHeight / 2, boxWidth, boxHeight, 10, `${color}1a`, `${color}55`);
                context.fillStyle = color;
                context.textAlign = 'center';
                context.textBaseline = 'middle';
                context.fillText(text, x, y);
                context.restore();
            }

            function drawSubLabel(context, x, y, color, text) {
                context.fillStyle = color;
                context.font = '11px sans-serif';
                context.textAlign = 'center';
                context.fillText(text, x, y);
            }

            function drawLegend(context, x, y, palette, darkMode) {
                const entries = [
                    { color: palette.alice, label: 'Alice' },
                    { color: palette.bob, label: 'Bob' },
                    { color: palette.base, label: 'Base point G' },
                    { color: palette.shared, label: 'Shared secret S' }
                ];

                drawRoundedRect(context, x, y, 150, 90, 10, darkMode ? 'rgba(14,19,34,0.7)' : 'rgba(255,255,255,0.85)', palette.border);
                context.font = '12px sans-serif';
                context.fillStyle = colors.textSubtle;
                context.textAlign = 'left';
                context.fillText('Legend', x + 10, y + 16);
                entries.forEach((item, idx) => {
                    const itemY = y + 32 + idx * 16;
                    context.fillStyle = item.color;
                    context.beginPath();
                    context.arc(x + 12, itemY, 5, 0, Math.PI * 2);
                    context.fill();
                    context.fillStyle = colors.text;
                    context.fillText(item.label, x + 24, itemY + 4);
                });
            }

            function drawBlob(context, x, y, radius, color) {
                context.save();
                const gradient = context.createRadialGradient(x, y, radius * 0.1, x, y, radius);
                gradient.addColorStop(0, color);
                gradient.addColorStop(1, 'rgba(255,255,255,0)');
                context.fillStyle = gradient;
                context.beginPath();
                context.arc(x, y, radius, 0, Math.PI * 2);
                context.fill();
                context.restore();
            }

            function drawProgressPill(context, x, y, width, height, idx, total, palette) {
                if (!total) return;
                const progress = Math.max(0, Math.min(1, (idx + 1) / total));
                drawRoundedRect(context, x, y, width, height, height / 2, palette.channel, palette.border);
                drawRoundedRect(context, x, y, width * progress, height, height / 2, `${palette.shared}99`, 'transparent');
                context.fillStyle = palette.text;
                context.font = '11.5px "Inter", system-ui, sans-serif';
                context.textAlign = 'center';
                context.fillText(`Step ${idx + 1} of ${total}`, x + width / 2, y + height - 4);
            }
        }

        function drawArrow(ctx, fromX, fromY, toX, toY, color, width = 2, dashed = false, curved = false, dashOffset = 0) {
            ctx.save();
            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            ctx.lineWidth = width;
            if (dashed) {
                ctx.setLineDash([10, 6]);
                ctx.lineDashOffset = dashOffset;
            }
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

        function drawMovingDot(context, fromX, fromY, toX, toY, color, progress, size = 6) {
            const x = fromX + (toX - fromX) * progress;
            const y = fromY + (toY - fromY) * progress;
            context.save();
            context.fillStyle = color;
            context.shadowColor = color;
            context.shadowBlur = 12;
            context.beginPath();
            context.arc(x, y, size, 0, Math.PI * 2);
            context.fill();
            context.restore();
        }

        function drawHalo(context, x, y, radius, color, alpha) {
            context.save();
            context.fillStyle = `${color}${alphaHex(alpha)}`;
            context.beginPath();
            context.arc(x, y, radius, 0, Math.PI * 2);
            context.fill();
            context.restore();
        }

        function alphaHex(alpha) {
            const clamped = Math.max(0, Math.min(1, alpha));
            return Math.round(clamped * 255).toString(16).padStart(2, '0');
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

        // =================== ECC EXPERT CHAT =================== //

        function initChatAssistant() {
            const chatWindow = document.getElementById('chatWindow');
            const toggleBtn = document.getElementById('chatToggleBtn');
            const closeBtn = document.getElementById('chatCloseBtn');
            const chatForm = document.getElementById('chatForm');
            const chatInput = document.getElementById('chatInput');
            const chatMessages = document.getElementById('chatMessages');
            const chatStatus = document.getElementById('chatStatus');
            const chatAssistant = document.querySelector('.chat-assistant');

            if (!chatWindow || !toggleBtn || !chatForm || !chatMessages || !chatStatus || !chatAssistant) return;

            let sending = false;
            const history = [];
            let dragging = false;
            let dragMoved = false;
            let suppressToggle = false;
            let customPosition = false;
            let dragStart = { x: 0, y: 0 };
            let startPosition = { x: 0, y: 0 };

            function scrollMessages() {
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }

            function toggleChat(forceOpen) {
                const shouldOpen = forceOpen !== undefined ? forceOpen : !chatWindow.classList.contains('open');
                chatWindow.classList.toggle('open', shouldOpen);
                toggleBtn.classList.toggle('active', shouldOpen);
                if (shouldOpen) {
                    setTimeout(() => chatInput && chatInput.focus(), 120);
                }
            }

            // Allow users to drag the floating assistant to a comfortable spot.
            function moveAssistant(left, top) {
                const padding = 8;
                const isOpen = chatWindow.classList.contains('open');
                const fabWidth = toggleBtn.offsetWidth || 60;
                const fabHeight = toggleBtn.offsetHeight || 60;

                // Use only a portion of the chat window size so dragging feels less constrained.
                const targetWidth = isOpen
                    ? Math.max(Math.floor((chatWindow.offsetWidth || fabWidth) * 0.65), fabWidth)
                    : fabWidth;
                const targetHeight = isOpen
                    ? Math.max(Math.floor((chatWindow.offsetHeight || fabHeight) * 0.4), fabHeight)
                    : fabHeight;

                const minLeft = -Math.min(targetWidth * 0.3, 120);
                const maxLeft = window.innerWidth - padding;
                const minTop = -Math.min(targetHeight * 0.15, 60);
                const maxTop = window.innerHeight - padding;

                const clampedLeft = Math.min(Math.max(left, minLeft), maxLeft);
                const clampedTop = Math.min(Math.max(top, minTop), maxTop);

                chatAssistant.style.left = `${clampedLeft}px`;
                chatAssistant.style.top = `${clampedTop}px`;
                chatAssistant.style.right = 'auto';
                chatAssistant.style.bottom = 'auto';
            }

            function startDrag(event) {
                if (event.button !== undefined && event.button !== 0) return;
                dragging = true;
                dragMoved = false;
                dragStart = { x: event.clientX, y: event.clientY };
                const rect = chatAssistant.getBoundingClientRect();
                startPosition = { x: rect.left, y: rect.top };
                chatAssistant.classList.add('dragging');
                window.addEventListener('pointermove', onDragMove);
                window.addEventListener('pointerup', endDrag);
                window.addEventListener('pointercancel', endDrag);
            }

            function onDragMove(event) {
                if (!dragging) return;
                event.preventDefault();
                const deltaX = event.clientX - dragStart.x;
                const deltaY = event.clientY - dragStart.y;
                if (Math.abs(deltaX) + Math.abs(deltaY) > 3) {
                    dragMoved = true;
                }
                moveAssistant(startPosition.x + deltaX, startPosition.y + deltaY);
            }

            function endDrag() {
                if (!dragging) return;
                dragging = false;
                chatAssistant.classList.remove('dragging');
                window.removeEventListener('pointermove', onDragMove);
                window.removeEventListener('pointerup', endDrag);
                window.removeEventListener('pointercancel', endDrag);
                if (dragMoved) {
                    customPosition = true;
                    suppressToggle = true;
                    setTimeout(() => { suppressToggle = false; }, 200);
                }
            }

            function renderMessage(role, content, variant) {
                const wrapper = document.createElement('div');
                wrapper.className = `chat-message ${role}${variant === 'error' ? ' error' : ''}`.trim();

                const avatar = document.createElement('div');
                avatar.className = 'chat-avatar';
                avatar.innerHTML = role === 'user'
                    ? '<i class="fa-solid fa-user"></i>'
                    : '<i class="fa-solid fa-robot"></i>';

                const bubble = document.createElement('div');
                bubble.className = 'chat-bubble';
                if (variant === 'typing') bubble.classList.add('chat-typing');
                bubble.textContent = content;

                wrapper.appendChild(avatar);
                wrapper.appendChild(bubble);
                chatMessages.appendChild(wrapper);
                scrollMessages();
                return wrapper;
            }

            async function sendChat(event) {
                event.preventDefault();
                if (sending) return;

                const text = (chatInput.value || '').trim();
                if (!text) return;

                sending = true;
                chatInput.value = '';
                renderMessage('user', text);
                history.push({ role: 'user', content: text });
                chatStatus.textContent = 'Thinking...';

                const thinking = renderMessage('bot', 'Working on it...', 'typing');

                try {
                    const resp = await fetch('/api/chatbot', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: text, messages: history })
                    });

                    const data = await resp.json();
                    if (!resp.ok || !data.success) {
                        throw new Error(data.error || 'Chat request failed');
                    }

                    const reply = data.reply || 'No reply received.';
                    thinking.remove();
                    renderMessage('bot', reply);
                    history.push({ role: 'assistant', content: reply });
                    chatStatus.textContent = 'Ready';
                } catch (err) {
                    if (thinking && thinking.remove) thinking.remove();
                    renderMessage('bot', err.message || 'Unable to reach assistant', 'error');
                    chatStatus.textContent = 'Try again';
                } finally {
                    sending = false;
                    scrollMessages();
                }
            }

            toggleBtn.addEventListener('pointerdown', startDrag);
            toggleBtn.addEventListener('click', (e) => {
                if (suppressToggle) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                toggleChat();
            });
            if (closeBtn) closeBtn.addEventListener('click', () => toggleChat(false));
            chatForm.addEventListener('submit', sendChat);
            if (chatInput) {
                chatInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        chatForm.requestSubmit();
                    }
                });
            }

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && chatWindow.classList.contains('open')) {
                    toggleChat(false);
                }
            });

            window.addEventListener('resize', () => {
                if (!customPosition) return;
                const rect = chatAssistant.getBoundingClientRect();
                moveAssistant(rect.left, rect.top);
            });
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initChatAssistant);
        } else {
            initChatAssistant();
        }

        // =================== DISCRETE LOGARITHM DEMO =================== //

        let dlogCurrentCurve = null;
        let dlogPoints = [];
        let dlogBasePoint = null;
        let dlogPublicKey = null;
        let dlogPrivateKey = null;

        async function initDiscreteLogDemo() {
        console.log('[Discrete Log] Step 1: Initializing curve');
        const a = parseInt(document.getElementById('dlogParamA').value) || 5;
        const b = parseInt(document.getElementById('dlogParamB').value) || 7;
        const p = parseInt(document.getElementById('dlogParamP').value) || 47;

        showLoading('Initializing curve...', 'Finding all points');

        try {
        const response = await fetch('/api/find_points', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ a, b, p })
        });

        const data = await response.json();
        hideLoading();

        if (!data.success) {
            showToast(data.error || 'Failed to initialize curve', 'error');
            return;
        }

        dlogCurrentCurve = { a, b, p };
        dlogPoints = data.points;
        dlogBasePoint = null;
        dlogPublicKey = null;

        // Display curve info
        const infoDiv = document.getElementById('dlogCurveInfo');
        const nonInfinityPoints = data.points.filter(p => p.x !== null);
        infoDiv.innerHTML = `
            <div class="result-box" style="background: rgba(59, 130, 246, 0.1); border-left: 4px solid #3b82f6;">
                <h4 style="color: #2563eb; margin-top: 0;">✓ Curve Initialized</h4>
                <p><strong>Curve equation:</strong> y² ≡ x³ + ${a}x + ${b} (mod ${p})</p>
                <p><strong>Points found:</strong> ${data.count} total (including point at infinity)</p>
                <p><strong>Non-infinity points:</strong> ${nonInfinityPoints.length}</p>
                <p style="color: #059669; font-weight: 600;">✓ Ready for Step 2: Choose a base point G and private key k</p>
            </div>
        `;

        // Enable step 2 and select random base point
        document.getElementById('dlogStep2Panel').style.opacity = '1';
        document.getElementById('dlogComputeBtn').disabled = false;
        document.getElementById('dlogKRange').textContent = `(1-${nonInfinityPoints.length})`;

        // Auto-select a point with large order as the base point (generator)
        // Skip the first few points (0-indexed) which may have small order
        // Use point index 2 if available, otherwise use the last point
        if (nonInfinityPoints.length > 2) {
            dlogBasePoint = nonInfinityPoints[2];  // Use the 3rd point which has large order
        } else if (nonInfinityPoints.length > 0) {
            dlogBasePoint = nonInfinityPoints[nonInfinityPoints.length - 1];  // Use last point
        }
        document.getElementById('dlogScalar').max = nonInfinityPoints.length;

        showToast('Curve initialized! Now choose your private key k.', 'success');
        } catch (error) {
        hideLoading();
        console.error('[Discrete Log] Error in step 1:', error);
        showToast('Error initializing curve: ' + error.message, 'error');
        }
        }

        async function computeDiscreteLogPublicKey() {
        console.log('[Discrete Log] Step 2: Computing public key', { dlogCurrentCurve, dlogBasePoint });
        if (!dlogCurrentCurve || !dlogBasePoint) {
        showToast('Please initialize the curve first', 'warning');
        return;
        }

        const k = parseInt(document.getElementById('dlogScalar').value);
        if (!k || k < 1) {
        showToast('Enter a valid private key k (must be > 0)', 'error');
        return;
        }

        const nonInfinityPoints = dlogPoints.filter(p => p.x !== null);
        if (k > nonInfinityPoints.length) {
        showToast(`k must be between 1 and ${nonInfinityPoints.length}`, 'error');
        return;
        }

        showLoading('Computing Q = k × G...', 'Performing scalar multiplication');

        try {
        const response = await fetch('/api/scalar_multiply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                a: dlogCurrentCurve.a,
                b: dlogCurrentCurve.b,
                p: dlogCurrentCurve.p,
                k: k,
                point: {
                    x: dlogBasePoint.x,
                    y: dlogBasePoint.y,
                    display: `(${dlogBasePoint.x}, ${dlogBasePoint.y})`
                }
            })
        });

        const data = await response.json();
        hideLoading();

        if (!data.success) {
            showToast(data.error || 'Failed to compute public key', 'error');
            return;
        }

        if (!data.result) {
            showToast('Invalid response from server', 'error');
            return;
        }

        dlogPrivateKey = k;
        dlogPublicKey = {
            x: data.result.x,
            y: data.result.y,
            display: data.result.display || `(${data.result.x}, ${data.result.y})`
        };

        const resultDiv = document.getElementById('dlogPublicKeyResult');
        resultDiv.innerHTML = `
            <div class="result-box" style="background: rgba(16, 185, 129, 0.1); border-left: 4px solid #10b981;">
                <h4 style="color: #059669; margin-top: 0;">✓ Public Key Computed</h4>
                <p><strong>Private key:</strong> k = ${k}</p>
                <p><strong>Base point:</strong> G = (${dlogBasePoint.x}, ${dlogBasePoint.y})</p>
                <p><strong>Public key:</strong> Q = ${k} × G = ${dlogPublicKey.display}</p>
                <p style="color: #059669; font-weight: 600;">✓ Public key is ready. Now attacker knows G and Q, but not k!</p>
            </div>
        `;

        // Enable step 3
        document.getElementById('dlogStep3Panel').style.opacity = '1';
        document.getElementById('dlogBruteforceBtn').disabled = false;

        showToast('Public key computed! Now launch the brute-force attack.', 'success');
        } catch (error) {
        hideLoading();
        console.error('[Discrete Log] Error in step 2:', error);
        showToast('Error computing public key: ' + error.message, 'error');
        }
        }

        async function bruteForceDiscreteLog() {
        console.log('[Discrete Log] Step 3: Launching attack', { dlogCurrentCurve, dlogBasePoint, dlogPublicKey, dlogPrivateKey });
        if (!dlogCurrentCurve || !dlogBasePoint || !dlogPublicKey) {
        showToast('Please complete steps 1 and 2 first', 'warning');
        return;
        }

        const useBsgs = document.getElementById('dlogUseBsgs').checked;
        const resultDiv = document.getElementById('dlogBruteforceResult');
        const stepsDiv = document.getElementById('dlogStepsContainer');

        showLoading('Launching attack...', 'Computing attempts');

        try {
        resultDiv.innerHTML = '';
        stepsDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">Searching for k...</div>';

        const response = await fetch('/api/discrete_log_solve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                a: dlogCurrentCurve.a,
                b: dlogCurrentCurve.b,
                p: dlogCurrentCurve.p,
                gx: dlogBasePoint.x,
                gy: dlogBasePoint.y,
                qx: dlogPublicKey.x,
                qy: dlogPublicKey.y,
                use_bsgs: useBsgs
            })
        });

        const data = await response.json();
        hideLoading();

        if (!data.success) {
            showToast(data.error || 'Attack failed', 'error');
            resultDiv.innerHTML = `<div class="result-box error" style="color: #dc2626;">❌ Error: ${data.error}</div>`;
            return;
        }

        const foundKey = data.found_key;
        const attempts = data.attempts || [];
        const isCorrect = foundKey === dlogPrivateKey;

        // Display result
        const resultHtml = `
            <div class="result-box" style="background: ${isCorrect ? 'rgba(239, 68, 68, 0.1)' : 'rgba(156, 163, 175, 0.1)'}; border-left: 4px solid ${isCorrect ? '#ef4444' : '#9ca3af'};">
                <h4 style="color: ${isCorrect ? '#dc2626' : '#4b5563'}; margin-top: 0;">
                    ${isCorrect ? '⚠️ KEY CRACKED!' : '❌ Key Not Found'}
                </h4>
                <p><strong>Found k:</strong> ${foundKey || 'Not found'}</p>
                <p><strong>Correct k:</strong> ${dlogPrivateKey}</p>
                <p><strong>Attempts:</strong> ${data.total_attempts} computations</p>
                ${useBsgs ? `<p><strong>Algorithm:</strong> Baby-step Giant-step (O(√n))</p>` : `<p><strong>Algorithm:</strong> Brute Force (O(n))</p>`}
                <p style="margin-top: 12px; color: var(--text-secondary);">
                    ${isCorrect
                        ? '⚠️ This shows why ECC is secure: even small keys are infeasible to crack with brute force!'
                        : '✓ This demonstrates the hardness of the discrete logarithm problem.'}
                </p>
            </div>
        `;

        resultDiv.innerHTML = resultHtml;

        // Display all attack attempts with educational context
        if (attempts.length > 0) {
            const targetPoint = `(${dlogPublicKey.x}, ${dlogPublicKey.y})`;
            const totalAttempts = data.total_attempts;
            const efficiency = Math.round((attempts.length / totalAttempts) * 100);

            let stepsHtml = `
                <div style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%); padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #3b82f6;">
                    <h4 style="margin: 0 0 10px 0; color: #2563eb;">🔍 Brute Force Attack - Finding the Secret Key</h4>
                    <p style="margin: 5px 0; font-size: 0.9em; color: #555;">
                        <strong>Goal:</strong> Find which k satisfies: k × G = Q
                    </p>
                    <p style="margin: 5px 0; font-size: 0.9em; color: #555;">
                        <strong>Target Q:</strong> <span style="font-family: monospace; background: #f3f4f6; padding: 2px 6px; border-radius: 3px;">${targetPoint}</span>
                    </p>
                    <p style="margin: 5px 0; font-size: 0.9em; color: #555;">
                        <strong>Found in:</strong> ${attempts.length} of ${totalAttempts} possible keys (${efficiency}% efficiency)
                    </p>
                </div>

                <div style="background: rgba(251, 191, 36, 0.05); padding: 12px; border-radius: 8px; margin-bottom: 12px; border-left: 3px solid #f59e0b;">
                    <strong style="color: #d97706;">💡 Educational Note:</strong> Each attempt computes k × G and checks if it equals Q. The attacker must try many values before finding the secret key - this is why discrete log is computationally hard!
                </div>

                <div style="border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden;">
                    <div style="background: #f9fafb; padding: 10px; border-bottom: 1px solid var(--border-color); font-weight: 600; font-size: 0.9em; display: grid; grid-template-columns: 60px 80px 200px 80px; gap: 10px;">
                        <div>#</div>
                        <div>Try k</div>
                        <div>Computed: k × G</div>
                        <div>Result</div>
                    </div>
                    <div style="max-height: 450px; overflow-y: auto;">
            `;

            attempts.forEach((attempt, idx) => {
                const isFound = attempt.found;
                const isSecret = attempt.k_attempt === dlogPrivateKey;
                const resultPoint = `(${attempt.result_x}, ${attempt.result_y})`;
                const matches = isFound ? '✓ MATCH!' : '✗ No match';

                let bgColor = 'transparent';
                let borderColor = 'transparent';
                let textColor = '#666';

                if (isFound) {
                    bgColor = 'rgba(239, 68, 68, 0.15)';
                    borderColor = '#dc2626';
                    textColor = '#dc2626';
                } else if (isSecret) {
                    bgColor = 'rgba(249, 115, 22, 0.15)';
                    borderColor = '#ea580c';
                    textColor = '#ea580c';
                }

                stepsHtml += `
                    <div style="padding: 10px; background: ${bgColor}; border-left: 3px solid ${borderColor}; display: grid; grid-template-columns: 60px 80px 200px 80px; gap: 10px; align-items: center; font-size: 0.85em; font-family: monospace; border-bottom: 1px solid #e5e7eb;">
                        <div style="font-weight: 600;">${idx + 1}</div>
                        <div style="color: ${textColor}; font-weight: 600;">${attempt.k_attempt}</div>
                        <div style="color: #666; word-break: break-all;">${resultPoint}</div>
                        <div style="font-weight: 600; color: ${textColor};">
                            ${isFound ? '✓ FOUND' : isSecret ? '⚡ Secret' : '✗'}
                        </div>
                    </div>
                `;
            });

            stepsHtml += `
                    </div>
                </div>

                <div style="background: rgba(16, 185, 129, 0.05); padding: 12px; border-radius: 8px; margin-top: 12px; border-left: 3px solid #10b981;">
                    <strong style="color: #059669;">✓ Key Insight:</strong> The attacker had to try ${attempts.length} different values before finding the secret key. In real cryptography with large numbers, this search is computationally infeasible!
                </div>
            `;

            stepsDiv.innerHTML = stepsHtml;
        } else {
            stepsDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">No attack attempts recorded.</div>';
        }

        showToast(isCorrect ? '❌ Private key cracked!' : '✓ Attack completed', isCorrect ? 'error' : 'info');
        } catch (error) {
        hideLoading();
        console.error('[Discrete Log] Error in step 3:', error);
        showToast('Error launching attack: ' + error.message, 'error');
        }
        }

        // Expose functions globally for onclick handlers
        window.initDiscreteLogDemo = initDiscreteLogDemo;
        window.computeDiscreteLogPublicKey = computeDiscreteLogPublicKey;
        window.bruteForceDiscreteLog = bruteForceDiscreteLog;
