        
        function setErr(id,msg){ const el=document.getElementById(id); if(!el) return; el.textContent=msg||''; }

        async function submitSignupCard(){
            const u = document.getElementById('suUsername').value.trim();
            
            const p = document.getElementById('suPassword').value;
            const c = document.getElementById('suConfirm').value;
            const msg = document.getElementById('suMsg');
            msg.textContent='';

            let ok = true;
            setErr('suUsernameErr', !u? 'Username is required':'' ); if(!u) ok=false;
            
            setErr('suPasswordErr', !p? 'Password is required':'' ); if(!p) ok=false;
            setErr('suConfirmErr', !c? 'Please confirm your password': (c!==p? 'Passwords do not match':'')); if(!c || c!==p) ok=false;
            if(!ok) return;

            msg.textContent='Creating account...';
            try{
                const res = await fetch('/api/signup', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({username:u, password:p}) });
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
