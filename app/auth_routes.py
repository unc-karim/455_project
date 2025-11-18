from datetime import datetime
import os
import smtplib
import secrets
from datetime import timedelta
from datetime import datetime
from email.message import EmailMessage

from flask import jsonify, request, session
from werkzeug.security import check_password_hash, generate_password_hash

from .db_helpers import get_current_user, get_db

SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASS = os.getenv("SMTP_PASS")
SMTP_FROM = os.getenv("SMTP_FROM") or SMTP_USER
SMTP_USE_TLS = (os.getenv("SMTP_USE_TLS", "true").lower() == "true")


def _send_reset_email(to_email: str, token: str):
    """Send a password reset email if SMTP is configured."""
    if not (SMTP_HOST and SMTP_USER and SMTP_PASS and SMTP_FROM):
        return False, "Email not configured"

    reset_url = f"{request.host_url.rstrip('/')}/reset?token={token}"

    msg = EmailMessage()
    msg["Subject"] = "Reset your password"
    msg["From"] = SMTP_FROM
    msg["To"] = to_email
    msg.set_content(
        f"You requested a password reset.\n\n"
        f"Reset link: {reset_url}\n\n"
        f"If you did not request this, ignore this email."
    )

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            if SMTP_USE_TLS:
                server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)
        return True, None
    except Exception as exc:  # noqa: BLE001
        return False, str(exc)


def register_auth_routes(app):
    @app.route('/api/session', methods=['GET'])
    def get_session_info():
        user = get_current_user()
        if user:
            return jsonify({'logged_in': True, 'username': user['username'], 'is_guest': bool(user['is_guest'])})
        return jsonify({'logged_in': False})

    @app.route('/api/signup', methods=['POST'])
    def signup():
        data = request.get_json(silent=True) or {}
        username = data.get('username', '').strip()
        password = data.get('password', '')
        email = (data.get('email') or '').strip()

        if not username or not password or not email:
            return jsonify({'success': False, 'message': 'Email, username, and password are required'}), 400
        if '@' not in email or '.' not in email or ' ' in email:
            return jsonify({'success': False, 'message': 'Enter a valid email address'}), 400

        conn = get_db()
        try:
            cur = conn.execute("SELECT id FROM users WHERE username = ?", (username,))
            if cur.fetchone():
                return jsonify({'success': False, 'message': 'Username exists'}), 400
            pw_hash = generate_password_hash(password)
            conn.execute(
                "INSERT INTO users (username, email, password_hash, is_guest, created_at) VALUES (?,?,?,?,?)",
                (username, email, pw_hash, 0, datetime.utcnow().isoformat()),
            )
            conn.commit()
            cur = conn.execute("SELECT id FROM users WHERE username = ?", (username,))
            row = cur.fetchone()
            user_id = row['id']
            session['user_id'] = user_id
            session['username'] = username
            session['is_guest'] = 0
        finally:
            conn.close()

        return jsonify({'success': True, 'message': 'Account created!'})

    @app.route('/api/password/forgot', methods=['POST'])
    def forgot_password():
        data = request.get_json(silent=True) or {}
        username = (data.get('username') or '').strip()
        email = (data.get('email') or '').strip()

        if not username and not email:
            return jsonify({'success': False, 'message': 'Username or email is required'}), 400

        conn = get_db()
        try:
            if username:
                cur = conn.execute("SELECT id, username, email FROM users WHERE username = ?", (username,))
            else:
                cur = conn.execute("SELECT id, username, email FROM users WHERE email = ?", (email,))
            row = cur.fetchone()

            # Always respond success to avoid leaking which users exist
            if not row or not row['email']:
                return jsonify({'success': True, 'message': 'If the account exists, a reset link was prepared.'})

            token = secrets.token_hex(16)
            expires_at = (datetime.utcnow() + timedelta(hours=1)).isoformat()
            conn.execute(
                "INSERT INTO password_resets (user_id, token, expires_at, used) VALUES (?,?,?,0)",
                (row['id'], token, expires_at),
            )
            conn.commit()

            masked = row['email']
            if '@' in masked:
                name, domain = masked.split('@', 1)
                masked = f"{name[:1]}***@{domain}"

            sent, err = _send_reset_email(row['email'], token)

            # Surface dev token if email not configured or failed
            resp = {
                'success': True,
                'message': 'Reset link prepared.' + ('' if sent else ' (Email delivery not configured.)'),
                'masked_email': masked,
            }
            if not sent:
                resp['dev_token'] = token
                resp['email_error'] = err
            return jsonify(resp)
        finally:
            conn.close()

    @app.route('/api/password/reset', methods=['POST'])
    def reset_password():
        data = request.get_json(silent=True) or {}
        token = (data.get('token') or '').strip()
        new_pw = data.get('password') or ''
        if not token or not new_pw:
            return jsonify({'success': False, 'message': 'Token and new password are required'}), 400

        conn = get_db()
        try:
            cur = conn.execute(
                "SELECT pr.id, pr.user_id, pr.expires_at, pr.used, u.username FROM password_resets pr JOIN users u ON pr.user_id = u.id WHERE pr.token = ?",
                (token,)
            )
            row = cur.fetchone()
            if not row:
                return jsonify({'success': False, 'message': 'Invalid or expired token'}), 400
            if row['used']:
                return jsonify({'success': False, 'message': 'Token already used'}), 400

            expires_at = datetime.fromisoformat(row['expires_at'])
            if datetime.utcnow() > expires_at:
                return jsonify({'success': False, 'message': 'Token expired'}), 400

            pw_hash = generate_password_hash(new_pw)
            conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (pw_hash, row['user_id']))
            conn.execute("UPDATE password_resets SET used = 1 WHERE id = ?", (row['id'],))
            conn.commit()
            return jsonify({'success': True, 'message': 'Password updated. You can now log in.'})
        finally:
            conn.close()

    @app.route('/api/login', methods=['POST'])
    @app.route('/api/auth/login', methods=['POST'])
    def login():
        data = request.get_json(silent=True) or {}
        username = data.get('username', '').strip()
        password = data.get('password', '')

        if not username or not password:
            return jsonify({'success': False, 'message': 'Username and password are required'}), 400

        conn = get_db()
        try:
            cur = conn.execute(
                "SELECT id, username, password_hash, is_guest FROM users WHERE username = ?",
                (username,),
            )
            row = cur.fetchone()
            if not row or not row['password_hash'] or not check_password_hash(row['password_hash'], password):
                return jsonify({'success': False, 'message': 'Invalid credentials'}), 401
            session['user_id'] = row['id']
            session['username'] = row['username']
            session['is_guest'] = row['is_guest']
        finally:
            conn.close()

        return jsonify({'success': True, 'message': 'Login successful!'})

    @app.route('/api/logout', methods=['POST'])
    def logout():
        session.pop('user_id', None)
        session.pop('username', None)
        session.pop('is_guest', None)
        return jsonify({'success': True})

    @app.route('/api/guest', methods=['POST'])
    @app.route('/api/auth/guest', methods=['POST'])
    def guest():
        suffix = secrets.token_hex(3)
        username = f"guest_{suffix}"
        conn = get_db()
        try:
            conn.execute(
                "INSERT INTO users (username, email, password_hash, is_guest, created_at) VALUES (?,?,?,?,?)",
                (username, None, None, 1, datetime.utcnow().isoformat()),
            )
            conn.commit()
            cur = conn.execute("SELECT id FROM users WHERE username = ?", (username,))
            row = cur.fetchone()
            session['user_id'] = row['id']
            session['username'] = username
            session['is_guest'] = 1
        finally:
            conn.close()
        return jsonify({'success': True, 'message': 'Continuing as guest', 'username': username})
