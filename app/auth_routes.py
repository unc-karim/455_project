from datetime import datetime
import secrets

from flask import jsonify, request, session
from werkzeug.security import check_password_hash, generate_password_hash

from .db_helpers import get_current_user, get_db


def register_auth_routes(app):
    @app.route('/api/session', methods=['GET'])
    def get_session_info():
        user = get_current_user()
        if user:
            return jsonify({'logged_in': True, 'username': user['username'], 'is_guest': bool(user['is_guest'])})
        return jsonify({'logged_in': False})

    @app.route('/api/signup', methods=['POST'])
    def signup():
        # Accept optional email so the UI (which only asks for username/password) succeeds.
        data = request.get_json(silent=True) or {}
        username = data.get('username', '').strip()
        password = data.get('password', '')
        email = (data.get('email') or '').strip() or None

        if not username or not password:
            return jsonify({'success': False, 'message': 'Username and password are required'}), 400

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
