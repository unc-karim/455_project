
        function setErr(id,msg){ const el=document.getElementById(id); if(!el) return; el.textContent=msg||''; }

        function checkPasswordStrength(password) {
            const requirements = {
                length: password.length >= 8,
                uppercase: /[A-Z]/.test(password),
                lowercase: /[a-z]/.test(password),
                number: /[0-9]/.test(password),
                special: /[!@#$%^&*()_+\-=\[\]{};:'"",.<>?/\\|`~]/.test(password)
            };
            return requirements;
        }

        function updatePasswordStrength() {
            const p = document.getElementById('suPassword').value;
            const strengthDiv = document.getElementById('suPasswordStrength');
            if (!strengthDiv) return;

            if (!p) {
                strengthDiv.innerHTML = '';
                return;
            }

            const req = checkPasswordStrength(p);
            const allMet = req.length && req.uppercase && req.lowercase && req.number && req.special;

            let html = '<div style="font-size: 12px; margin-top: 8px;">';
            html += `<div style="color: ${req.length ? '#28a745' : '#dc3545'};">✓ At least 8 characters</div>`;
            html += `<div style="color: ${req.uppercase ? '#28a745' : '#dc3545'};">✓ One uppercase letter (A-Z)</div>`;
            html += `<div style="color: ${req.lowercase ? '#28a745' : '#dc3545'};">✓ One lowercase letter (a-z)</div>`;
            html += `<div style="color: ${req.number ? '#28a745' : '#dc3545'};">✓ One number (0-9)</div>`;
            html += `<div style="color: ${req.special ? '#28a745' : '#dc3545'};">✓ One special character (!@#$%^&*...)</div>`;
            html += '</div>';
            strengthDiv.innerHTML = html;

            const btn = document.getElementById('suBtn');
            if (btn) btn.disabled = !allMet;
        }

        async function submitSignupCard(){
            const e = document.getElementById('suEmail').value.trim();
            const u = document.getElementById('suUsername').value.trim();

            const p = document.getElementById('suPassword').value;
            const c = document.getElementById('suConfirm').value;
            const msg = document.getElementById('suMsg');
            msg.textContent='';

            let ok = true;
            const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
            setErr('suEmailErr', !e? 'Email is required': (!emailValid? 'Enter a valid email':'') ); if(!e || !emailValid) ok=false;
            setErr('suUsernameErr', !u? 'Username is required':'' ); if(!u) ok=false;

            setErr('suPasswordErr', !p? 'Password is required':'' ); if(!p) ok=false;
            setErr('suConfirmErr', !c? 'Please confirm your password': (c!==p? 'Passwords do not match':'')); if(!c || c!==p) ok=false;

            const req = checkPasswordStrength(p);
            const pwValid = req.length && req.uppercase && req.lowercase && req.number && req.special;
            setErr('suPasswordErr', !pwValid && p? 'Password does not meet requirements':(!p? 'Password is required':'')); if(!pwValid && p) ok=false;

            if(!ok) return;

            msg.textContent='Creating account...';
            try{
                const res = await fetch('/api/signup', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email:e, username:u, password:p}) });
                const data = await res.json();
                if(!res.ok || !data.success){ msg.textContent = data.message || 'Could not create account'; return; }
                window.location.href = '/app';
            }catch(err){ msg.textContent = 'Network error'; }
        }

        async function continueAsGuestCard(){
            try { let r = await fetch('/api/auth/guest', {method:'POST'}); if(!r.ok){ r = await fetch('/api/guest', {method:'POST'}); } if(r.ok){ window.location.href='/app'; return; } } catch(_){}
            try { localStorage.setItem('guest_session_id', (crypto && crypto.randomUUID? crypto.randomUUID(): String(Date.now()))); } catch(_) {}
            window.location.href = '/app';
        }

        function goLogin(){
            try { localStorage.setItem('force_login','1'); } catch(_) {}
            window.location.href = '/';
        }
