"""
Simple Flask Server for Elliptic Curve Calculator
Imports elliptic_curve.py and provides API endpoints
"""

from flask import Flask, render_template, request, jsonify, session
from elliptic_curve import EllipticCurve, RealEllipticCurve
import secrets
import os
import sqlite3
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
import socket
# import dns.resolver  # Not used in this version
import json

app = Flask(__name__)
app.secret_key = secrets.token_hex(16)

DB_PATH = os.path.join(os.path.dirname(__file__), 'app.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT,
                password_hash TEXT,
                is_guest INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                operation TEXT NOT NULL,
                details TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
            """
        )
        # New table for detailed operation history
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS operation_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                operation_type TEXT NOT NULL,
                curve_type TEXT NOT NULL,
                parameters TEXT NOT NULL,
                result TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                session_id TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
            """
        )
        conn.commit()
    finally:
        conn.close()


def save_history(user_id, operation, details):
    if not user_id:
        return
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO history (user_id, operation, details, created_at) VALUES (?,?,?,?)",
            (user_id, operation, details, datetime.utcnow().isoformat()),
        )
        conn.commit()
    finally:
        conn.close()

def ensure_session_id():
    if not session.get('session_id'):
        session['session_id'] = secrets.token_hex(8)

def save_operation_history(user_id, operation_type, curve_type, parameters, result=None, session_id=None):
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO operation_history (user_id, operation_type, curve_type, parameters, result, session_id) VALUES (?,?,?,?,?,?)",
            (
                user_id,
                operation_type,
                curve_type,
                json.dumps(parameters, ensure_ascii=False),
                json.dumps(result, ensure_ascii=False) if result is not None else None,
                session_id,
            ),
        )
        conn.commit()
    finally:
        conn.close()


def get_current_user():
    uid = session.get('user_id')
    if not uid:
        return None
    conn = get_db()
    try:
        cur = conn.execute("SELECT id, username, email, is_guest FROM users WHERE id = ?", (uid,))
        row = cur.fetchone()
        if not row:
            return None
        return dict(row)
    finally:
        conn.close()

@app.route('/')
def index():
    """Serve the main page"""
    return render_template('calculator.html')

@app.route('/app')
def app_page():
    """Alias route for app redirect targets"""
    return render_template('calculator.html')


@app.route('/signup')
def signup_page():
    """Signup page (standalone card UI)"""
    return render_template('signup.html')

@app.route('/api/session', methods=['GET'])
def get_session_info():
    user = get_current_user()
    if user:
        return jsonify({'logged_in': True, 'username': user['username'], 'is_guest': bool(user['is_guest'])})
    return jsonify({'logged_in': False})

# Email existence endpoint removed (username-only auth)

@app.route('/api/signup', methods=['POST'])
def signup():
    """User registration"""
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '')

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
            (username, None, pw_hash, 0, datetime.utcnow().isoformat()),
        )
        conn.commit()
        # load user id
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
    """User login"""
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '')

    conn = get_db()
    try:
        if not username:
            return jsonify({'success': False, 'message': 'Username is required'}), 400
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
    """Logout"""
    session.pop('user_id', None)
    session.pop('username', None)
    session.pop('is_guest', None)
    return jsonify({'success': True})

# Removed resend_verification endpoint – username-only auth

@app.route('/api/guest', methods=['POST'])
@app.route('/api/auth/guest', methods=['POST'])
def guest():
    """Continue as guest - creates a transient guest user in DB"""
    # create a unique guest username
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

@app.route('/api/find_points', methods=['POST'])
def api_find_points():
    """Find all points on curve - USES elliptic_curve.py"""
    try:
        data = request.get_json()
        a = int(data['a'])
        b = int(data['b'])
        p = int(data['p'])
        
        # Import and use the Python implementation!
        curve = EllipticCurve(a, b, p)
        points = curve.find_all_points()
        
        # Format for JSON
        formatted_points = []
        for point in points:
            if point == (None, None):
                formatted_points.append({'x': None, 'y': None, 'display': 'O'})
            else:
                formatted_points.append({'x': point[0], 'y': point[1], 'display': f'({point[0]}, {point[1]})'})
        
        # Save to basic history and operation_history
        user = get_current_user()
        if user:
            save_history(user['id'], 'Find Points', f'Found {len(points)} points on E_{p}({a}, {b})')
        ensure_session_id()
        try:
            save_operation_history(
                user_id=session.get('user_id'),
                operation_type='init_fp',
                curve_type='Fp',
                parameters={'a': a, 'b': b, 'p': p},
                result={'count': len(points)},
                session_id=session.get('session_id'),
            )
        except Exception:
            pass
        
        return jsonify({
            'success': True,
            'points': formatted_points,
            'count': len(points)
        })
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/api/add_points', methods=['POST'])
def api_add_points():
    """Add two points - USES elliptic_curve.py"""
    try:
        data = request.get_json()
        a = int(data['a'])
        b = int(data['b'])
        p = int(data['p'])
        
        p1 = data['p1']
        p2 = data['p2']
        
        P = (None, None) if p1['x'] is None else (p1['x'], p1['y'])
        Q = (None, None) if p2['x'] is None else (p2['x'], p2['y'])
        
        # Import and use the Python implementation!
        curve = EllipticCurve(a, b, p)

        # Calculate steps for step-by-step display
        steps = []

        # Handle special cases first
        if P == (None, None):
            steps.append("P is the point at infinity (O)")
            steps.append("By definition: O + Q = Q")
            result = Q
        elif Q == (None, None):
            steps.append("Q is the point at infinity (O)")
            steps.append("By definition: P + O = P")
            result = P
        else:
            x1, y1 = P
            x2, y2 = Q

            steps.append(f"Given: P = ({x1}, {y1}), Q = ({x2}, {y2})")
            steps.append(f"Curve: y² ≡ x³ + {a}x + {b} (mod {p})")

            if x1 == x2:
                if y1 == y2:
                    # Point doubling
                    steps.append("Case: P = Q (point doubling)")
                    if y1 == 0:
                        steps.append("Special case: y₁ = 0, so 2P = O")
                        result = (None, None)
                    else:
                        numerator = (3 * x1**2 + a) % p
                        denominator = (2 * y1) % p
                        inv = curve.mod_inverse(denominator)
                        slope = (numerator * inv) % p

                        steps.append(f"Calculate slope: m = (3x₁² + a) / (2y₁) mod {p}")
                        steps.append(f"m = (3·{x1}² + {a}) / (2·{y1}) mod {p}")
                        steps.append(f"m = {numerator} / {denominator} mod {p}")
                        steps.append(f"m = {numerator} · {inv} mod {p}")
                        steps.append(f"m = {slope}")

                        x3 = (slope**2 - x1 - x2) % p
                        y3 = (slope * (x1 - x3) - y1) % p

                        steps.append(f"Calculate x₃: x₃ = m² - x₁ - x₂ mod {p}")
                        steps.append(f"x₃ = {slope}² - {x1} - {x2} mod {p}")
                        steps.append(f"x₃ = {x3}")

                        steps.append(f"Calculate y₃: y₃ = m(x₁ - x₃) - y₁ mod {p}")
                        steps.append(f"y₃ = {slope}·({x1} - {x3}) - {y1} mod {p}")
                        steps.append(f"y₃ = {y3}")

                        result = (x3, y3)
                else:
                    # P + (-P) = O
                    steps.append("Case: P and Q are inverses (x₁ = x₂, y₁ ≠ y₂)")
                    steps.append("Therefore: P + Q = O (point at infinity)")
                    result = (None, None)
            else:
                # General point addition
                steps.append("Case: P ≠ Q (general addition)")
                numerator = (y2 - y1) % p
                denominator = (x2 - x1) % p
                inv = curve.mod_inverse(denominator)
                slope = (numerator * inv) % p

                steps.append(f"Calculate slope: m = (y₂ - y₁) / (x₂ - x₁) mod {p}")
                steps.append(f"m = ({y2} - {y1}) / ({x2} - {x1}) mod {p}")
                steps.append(f"m = {numerator} / {denominator} mod {p}")
                steps.append(f"m = {numerator} · {inv} mod {p}")
                steps.append(f"m = {slope}")

                x3 = (slope**2 - x1 - x2) % p
                y3 = (slope * (x1 - x3) - y1) % p

                steps.append(f"Calculate x₃: x₃ = m² - x₁ - x₂ mod {p}")
                steps.append(f"x₃ = {slope}² - {x1} - {x2} mod {p}")
                steps.append(f"x₃ = {x3}")

                steps.append(f"Calculate y₃: y₃ = m(x₁ - x₃) - y₁ mod {p}")
                steps.append(f"y₃ = {slope}·({x1} - {x3}) - {y1} mod {p}")
                steps.append(f"y₃ = {y3}")

                result = (x3, y3)

        # Format result
        if result == (None, None):
            result_formatted = {'x': None, 'y': None, 'display': 'O'}
        else:
            result_formatted = {'x': result[0], 'y': result[1], 'display': f'({result[0]}, {result[1]})'}
        
        # Save to history
        user = get_current_user()
        if user:
            save_history(user['id'], 'Add Points', f'{p1["display"]} + {p2["display"]} = {result_formatted["display"]}')
        ensure_session_id()
        try:
            save_operation_history(
                user_id=session.get('user_id'),
                operation_type='add_fp',
                curve_type='Fp',
                parameters={'a': a, 'b': b, 'p': p, 'P': p1, 'Q': p2},
                result={'R': result_formatted},
                session_id=session.get('session_id'),
            )
        except Exception:
            pass
        
        return jsonify({
            'success': True,
            'result': result_formatted,
            'steps': steps
        })
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/api/scalar_multiply', methods=['POST'])
def api_scalar_multiply():
    """Scalar multiplication - USES elliptic_curve.py"""
    try:
        data = request.get_json()
        a = int(data['a'])
        b = int(data['b'])
        p = int(data['p'])
        k = int(data['k'])
        
        point_data = data['point']
        P = (None, None) if point_data['x'] is None else (point_data['x'], point_data['y'])
        
        # Import and use the Python implementation!
        curve = EllipticCurve(a, b, p)
        result = curve.scalar_multiply(k, P)
        
        # Calculate steps
        steps = []
        current = (None, None)
        for i in range(1, min(k + 1, 11)):
            current = curve.add_points(current, P)
            if current == (None, None):
                steps.append(f'{i}P = O')
            else:
                steps.append(f'{i}P = ({current[0]}, {current[1]})')
        
        # Format result
        if result == (None, None):
            result_formatted = {'x': None, 'y': None, 'display': 'O'}
        else:
            result_formatted = {'x': result[0], 'y': result[1], 'display': f'({result[0]}, {result[1]})'}
        
        # Save to history
        user = get_current_user()
        if user:
            save_history(user['id'], 'Scalar Multiply', f'{k} × {point_data["display"]} = {result_formatted["display"]}')
        ensure_session_id()
        try:
            save_operation_history(
                user_id=session.get('user_id'),
                operation_type='multiply_fp',
                curve_type='Fp',
                parameters={'a': a, 'b': b, 'p': p, 'k': k, 'P': point_data},
                result={'R': result_formatted, 'steps': steps},
                session_id=session.get('session_id'),
            )
        except Exception:
            pass
        
        return jsonify({
            'success': True,
            'result': result_formatted,
            'steps': steps
        })
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

# ========================= REAL CURVE (over R) API ========================= #

@app.route('/api/init_real_curve', methods=['POST'])
def api_init_real_curve():
    """Initialize a real-number elliptic curve E(a,b) over R.
    Validates parameters (non-singular) and returns a recommended axis range.
    """
    try:
        data = request.get_json() or {}
        a = float(data.get('a'))
        b = float(data.get('b'))

        curve = RealEllipticCurve(a, b)

        # For now, return a default viewing window; frontend may choose to adjust.
        rng = {
            'x_min': -10.0, 'x_max': 10.0,
            'y_min': -10.0, 'y_max': 10.0,
        }

        # Save to history if logged in
        user = get_current_user()
        if user:
            save_history(user['id'], 'Init Real Curve', f'E(a={a}, b={b}) over R')
        ensure_session_id()
        try:
            save_operation_history(
                user_id=session.get('user_id'),
                operation_type='init_real',
                curve_type='R',
                parameters={'a': a, 'b': b},
                result={'range': rng},
                session_id=session.get('session_id'),
            )
        except Exception:
            pass

        return jsonify({'success': True, 'message': 'Real curve initialized', 'range': rng})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


@app.route('/api/add_points_real', methods=['POST'])
def api_add_points_real():
    """Add two points on a real-number elliptic curve using RealEllipticCurve."""
    try:
        data = request.get_json() or {}
        a = float(data.get('a'))
        b = float(data.get('b'))
        p1 = data.get('p1') or {}
        p2 = data.get('p2') or {}

        P = (None, None) if p1.get('x') is None else (float(p1['x']), float(p1['y']))
        Q = (None, None) if p2.get('x') is None else (float(p2['x']), float(p2['y']))

        curve = RealEllipticCurve(a, b)

        # Calculate steps for step-by-step display
        steps = []
        tol = 1e-9

        # Handle special cases first
        if P == (None, None):
            steps.append("P is the point at infinity (O)")
            steps.append("By definition: O + Q = Q")
            R = Q
        elif Q == (None, None):
            steps.append("Q is the point at infinity (O)")
            steps.append("By definition: P + O = P")
            R = P
        else:
            x1, y1 = P
            x2, y2 = Q

            steps.append(f"Given: P = ({x1:.6g}, {y1:.6g}), Q = ({x2:.6g}, {y2:.6g})")
            steps.append(f"Curve: y² = x³ + {a}x + {b}")

            if abs(x1 - x2) <= tol and abs(y1 + y2) <= tol:
                # P + (-P) = O
                steps.append("Case: P and Q are inverses (vertical line)")
                steps.append("Therefore: P + Q = O (point at infinity)")
                R = (None, None)
            elif abs(x1 - x2) <= tol and abs(y1 - y2) <= tol:
                # Point doubling
                steps.append("Case: P = Q (point doubling)")
                if abs(y1) <= tol:
                    steps.append("Special case: y₁ = 0, so 2P = O")
                    R = (None, None)
                else:
                    slope = (3 * x1**2 + a) / (2 * y1)
                    steps.append(f"Calculate slope: m = (3x₁² + a) / (2y₁)")
                    steps.append(f"m = (3·{x1:.6g}² + {a}) / (2·{y1:.6g})")
                    steps.append(f"m = {slope:.6g}")

                    x3 = slope**2 - x1 - x2
                    y3 = slope * (x1 - x3) - y1

                    steps.append(f"Calculate x₃: x₃ = m² - x₁ - x₂")
                    steps.append(f"x₃ = {slope:.6g}² - {x1:.6g} - {x2:.6g}")
                    steps.append(f"x₃ = {x3:.6g}")

                    steps.append(f"Calculate y₃: y₃ = m(x₁ - x₃) - y₁")
                    steps.append(f"y₃ = {slope:.6g}·({x1:.6g} - {x3:.6g}) - {y1:.6g}")
                    steps.append(f"y₃ = {y3:.6g}")

                    R = (x3, y3)
            else:
                # General point addition
                steps.append("Case: P ≠ Q (general addition)")
                slope = (y2 - y1) / (x2 - x1)

                steps.append(f"Calculate slope: m = (y₂ - y₁) / (x₂ - x₁)")
                steps.append(f"m = ({y2:.6g} - {y1:.6g}) / ({x2:.6g} - {x1:.6g})")
                steps.append(f"m = {slope:.6g}")

                x3 = slope**2 - x1 - x2
                y3 = slope * (x1 - x3) - y1

                steps.append(f"Calculate x₃: x₃ = m² - x₁ - x₂")
                steps.append(f"x₃ = {slope:.6g}² - {x1:.6g} - {x2:.6g}")
                steps.append(f"x₃ = {x3:.6g}")

                steps.append(f"Calculate y₃: y₃ = m(x₁ - x₃) - y₁")
                steps.append(f"y₃ = {slope:.6g}·({x1:.6g} - {x3:.6g}) - {y1:.6g}")
                steps.append(f"y₃ = {y3:.6g}")

                R = (x3, y3)

        if R == (None, None):
            result_formatted = {'x': None, 'y': None, 'display': 'O'}
        else:
            result_formatted = {'x': R[0], 'y': R[1], 'display': f'({R[0]}, {R[1]})'}

        # History
        user = get_current_user()
        if user:
            def fmt(pt):
                if not pt or pt.get('x') is None:
                    return 'O'
                return f"({pt['x']}, {pt['y']})"
            save_history(user['id'], 'Add Points (R)', f"{fmt(p1)} + {fmt(p2)} = {result_formatted['display']}")
        ensure_session_id()
        try:
            save_operation_history(
                user_id=session.get('user_id'),
                operation_type='add_real',
                curve_type='R',
                parameters={'a': a, 'b': b, 'P': p1, 'Q': p2},
                result={'R': result_formatted},
                session_id=session.get('session_id'),
            )
        except Exception:
            pass

        return jsonify({'success': True, 'result': result_formatted, 'steps': steps})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


@app.route('/api/scalar_multiply_real', methods=['POST'])
def api_scalar_multiply_real():
    """Scalar multiplication k*P over reals using RealEllipticCurve.
    Also returns intermediate multiples up to 10 for visualization.
    """
    try:
        data = request.get_json() or {}
        a = float(data.get('a'))
        b = float(data.get('b'))
        k = int(data.get('k'))
        point_data = data.get('point') or {}
        P = (None, None) if point_data.get('x') is None else (float(point_data['x']), float(point_data['y']))

        curve = RealEllipticCurve(a, b)
        result = curve.scalar_multiply(k, P)

        # Build intermediate steps list (1..min(|k|, 10))
        steps = []
        pts = []
        S = (None, None)
        limit = min(abs(k), 10)
        addend = (P[0], P[1]) if not (P[0] is None) else (None, None)
        for i in range(1, limit + 1):
            S = curve.add_points(S, addend)
            if S == (None, None):
                steps.append(f'{i}P = O')
                pts.append({'x': None, 'y': None})
            else:
                steps.append(f'{i}P = ({S[0]}, {S[1]})')
                pts.append({'x': S[0], 'y': S[1]})

        if result == (None, None):
            result_formatted = {'x': None, 'y': None, 'display': 'O'}
        else:
            result_formatted = {'x': result[0], 'y': result[1], 'display': f'({result[0]}, {result[1]})'}

        # History
        user = get_current_user()
        if user:
            dispP = 'O' if point_data.get('x') is None else f"({point_data['x']}, {point_data['y']})"
            save_history(user['id'], 'Scalar Multiply (R)', f"{k} × {dispP} = {result_formatted['display']}")
        ensure_session_id()
        try:
            save_operation_history(
                user_id=session.get('user_id'),
                operation_type='multiply_real',
                curve_type='R',
                parameters={'a': a, 'b': b, 'k': k, 'P': point_data},
                result={'R': result_formatted, 'steps': steps},
                session_id=session.get('session_id'),
            )
        except Exception:
            pass

        return jsonify({'success': True, 'result': result_formatted, 'steps': steps, 'points': pts})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/api/history', methods=['GET'])
def get_history():
    """Get user's calculation history"""
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'message': 'Not logged in'}), 401
    conn = get_db()
    try:
        cur = conn.execute(
            "SELECT operation, details, created_at FROM history WHERE user_id = ? ORDER BY id DESC",
            (user['id'],),
        )
        rows = cur.fetchall()
        history_items = [dict(row) for row in rows]
    finally:
        conn.close()
    return jsonify({'success': True, 'history': history_items})

# ---------- Operation History APIs ----------

def _fetch_history(curve_type):
    ensure_session_id()
    uid = session.get('user_id')
    sid = session.get('session_id')
    conn = get_db()
    try:
        cur = conn.execute(
            "SELECT id, operation_type, curve_type, parameters, result, timestamp FROM operation_history WHERE curve_type = ? AND (user_id = ? OR (user_id IS NULL AND session_id = ?)) ORDER BY id DESC",
            (curve_type, uid, sid),
        )
        rows = cur.fetchall()
        out = []
        for r in rows:
            out.append({
                'id': r['id'],
                'operation_type': r['operation_type'],
                'curve_type': r['curve_type'],
                'parameters': json.loads(r['parameters']) if r['parameters'] else {},
                'result': json.loads(r['result']) if r['result'] else None,
                'timestamp': r['timestamp'],
            })
        return out
    finally:
        conn.close()

@app.route('/api/history/fp', methods=['GET'])
def api_history_fp():
    return jsonify(_fetch_history('Fp'))

@app.route('/api/history/real', methods=['GET'])
def api_history_real():
    return jsonify(_fetch_history('R'))

@app.route('/api/history/replay/<int:hid>', methods=['POST'])
def api_history_replay(hid):
    ensure_session_id()
    uid = session.get('user_id')
    sid = session.get('session_id')
    conn = get_db()
    try:
        cur = conn.execute(
            "SELECT id, operation_type, curve_type, parameters, result, timestamp FROM operation_history WHERE id = ? AND (user_id = ? OR (user_id IS NULL AND session_id = ?))",
            (hid, uid, sid),
        )
        r = cur.fetchone()
        if not r:
            return jsonify({'success': False, 'error': 'Not found'}), 404
        return jsonify({
            'success': True,
            'id': r['id'],
            'operation_type': r['operation_type'],
            'curve_type': r['curve_type'],
            'parameters': json.loads(r['parameters']) if r['parameters'] else {},
            'result': json.loads(r['result']) if r['result'] else None,
            'timestamp': r['timestamp'],
        })
    finally:
        conn.close()

@app.route('/api/history/<int:hid>', methods=['DELETE'])
def api_history_delete(hid):
    ensure_session_id()
    uid = session.get('user_id')
    sid = session.get('session_id')
    conn = get_db()
    try:
        conn.execute("DELETE FROM operation_history WHERE id = ? AND (user_id = ? OR (user_id IS NULL AND session_id = ?))", (hid, uid, sid))
        conn.commit()
        return jsonify({'success': True})
    finally:
        conn.close()

@app.route('/api/history/clear/<string:ctype>', methods=['DELETE'])
def api_history_clear(ctype):
    curve = 'Fp' if ctype.lower() == 'fp' else 'R'
    ensure_session_id()
    uid = session.get('user_id')
    sid = session.get('session_id')
    conn = get_db()
    try:
        conn.execute("DELETE FROM operation_history WHERE curve_type = ? AND (user_id = ? OR (user_id IS NULL AND session_id = ?))", (curve, uid, sid))
        conn.commit()
        return jsonify({'success': True})
    finally:
        conn.close()

# Removed email verification helpers and verify route – username-only auth

# ========================= ENCRYPTION API ========================= #

@app.route('/api/encryption/init', methods=['POST'])
def api_init_encryption():
    """Initialize encryption system with curve parameters and generate keys"""
    try:
        data = request.get_json()
        a = int(data['a'])
        b = int(data['b'])
        p = int(data['p'])

        # Initialize curve
        curve = EllipticCurve(a, b, p)

        # Find all points to use as generator
        points = curve.find_all_points()
        # Filter out point at infinity
        valid_points = [pt for pt in points if pt != (None, None)]

        if len(valid_points) < 2:
            return jsonify({'success': False, 'error': 'Curve has too few points for encryption'}), 400

        # Choose a generator point (first non-infinity point)
        generator = valid_points[0]

        # Generate random private key (between 1 and p-1)
        import secrets
        private_key = secrets.randbelow(p - 1) + 1

        # Compute public key: public_key = private_key * generator
        public_key = curve.scalar_multiply(private_key, generator)

        # Store in session for this user
        session['encryption_params'] = {
            'a': a, 'b': b, 'p': p,
            'generator': generator,
            'private_key': private_key,
            'public_key': public_key
        }

        user = get_current_user()
        if user:
            save_history(user['id'], 'Init Encryption', f'Initialized encryption on E_{p}({a}, {b})')

        return jsonify({
            'success': True,
            'generator': {'x': generator[0], 'y': generator[1]},
            'private_key': private_key,
            'public_key': {'x': public_key[0], 'y': public_key[1]},
            'num_points': len(valid_points),
            'message': f'Encryption system initialized on E_{p}({a}, {b})'
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


@app.route('/api/encryption/encrypt', methods=['POST'])
def api_encrypt():
    """Encrypt a message using elliptic curve cryptography"""
    try:
        data = request.get_json()
        plaintext = data['plaintext']

        # Get encryption parameters from session
        enc_params = session.get('encryption_params')
        if not enc_params:
            return jsonify({'success': False, 'error': 'Encryption system not initialized'}), 400

        a, b, p = enc_params['a'], enc_params['b'], enc_params['p']
        generator = tuple(enc_params['generator'])
        public_key = tuple(enc_params['public_key'])

        curve = EllipticCurve(a, b, p)

        # Generate random ephemeral key k
        import secrets
        k = secrets.randbelow(p - 1) + 1

        # Compute R = k * G
        R = curve.scalar_multiply(k, generator)

        # Compute shared secret: S = k * public_key
        S = curve.scalar_multiply(k, public_key)

        # Use x-coordinate of S as encryption key
        shared_secret = S[0] if S[0] is not None else 0

        # Simple XOR encryption with the shared secret
        # Convert message to bytes and encrypt each byte
        encrypted_bytes = []
        steps = []

        steps.append(f"Step 1: Generate random ephemeral key k = {k}")
        steps.append(f"Step 2: Compute R = k × G = {k} × ({generator[0]}, {generator[1]})")
        steps.append(f"       Result: R = ({R[0]}, {R[1]})")
        steps.append(f"Step 3: Compute shared secret S = k × PublicKey")
        steps.append(f"       S = {k} × ({public_key[0]}, {public_key[1]})")
        steps.append(f"       Result: S = ({S[0]}, {S[1]})")
        steps.append(f"Step 4: Extract encryption key from S.x = {shared_secret}")
        steps.append(f"Step 5: Encrypt message using XOR with derived key")

        # Create a pseudo-random stream from the shared secret
        for i, char in enumerate(plaintext):
            byte_val = ord(char)
            # Use shared_secret with position to create encryption key
            key_byte = (shared_secret + i) % 256
            encrypted_byte = byte_val ^ key_byte
            encrypted_bytes.append(encrypted_byte)
            if i < 3:  # Show first 3 for brevity
                steps.append(f"       '{char}' (ASCII {byte_val}) XOR {key_byte} = {encrypted_byte}")

        if len(plaintext) > 3:
            steps.append(f"       ... ({len(plaintext) - 3} more characters)")

        # Format result
        result = {
            'R': {'x': R[0], 'y': R[1]},
            'encrypted': encrypted_bytes,
            'shared_secret_point': {'x': S[0], 'y': S[1]},
            'k': k  # Include for visualization (normally kept secret)
        }

        user = get_current_user()
        if user:
            save_history(user['id'], 'Encrypt Message', f'Encrypted {len(plaintext)} characters')

        return jsonify({
            'success': True,
            'ciphertext': result,
            'steps': steps,
            'plaintext_length': len(plaintext)
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


@app.route('/api/encryption/decrypt', methods=['POST'])
def api_decrypt():
    """Decrypt a ciphertext using elliptic curve cryptography"""
    try:
        data = request.get_json()
        ciphertext = data['ciphertext']

        # Get encryption parameters from session
        enc_params = session.get('encryption_params')
        if not enc_params:
            return jsonify({'success': False, 'error': 'Encryption system not initialized'}), 400

        a, b, p = enc_params['a'], enc_params['b'], enc_params['p']
        private_key = enc_params['private_key']

        curve = EllipticCurve(a, b, p)

        # Extract R from ciphertext
        R = (ciphertext['R']['x'], ciphertext['R']['y'])
        encrypted_bytes = ciphertext['encrypted']

        # Compute shared secret: S = private_key * R
        S = curve.scalar_multiply(private_key, R)

        # Use x-coordinate of S as decryption key
        shared_secret = S[0] if S[0] is not None else 0

        # Decrypt using XOR
        decrypted_chars = []
        steps = []

        steps.append(f"Step 1: Extract R from ciphertext: R = ({R[0]}, {R[1]})")
        steps.append(f"Step 2: Compute shared secret S = PrivateKey × R")
        steps.append(f"       S = {private_key} × ({R[0]}, {R[1]})")
        steps.append(f"       Result: S = ({S[0]}, {S[1]})")
        steps.append(f"Step 3: Extract decryption key from S.x = {shared_secret}")
        steps.append(f"Step 4: Decrypt message using XOR with derived key")

        for i, encrypted_byte in enumerate(encrypted_bytes):
            key_byte = (shared_secret + i) % 256
            decrypted_byte = encrypted_byte ^ key_byte
            decrypted_char = chr(decrypted_byte)
            decrypted_chars.append(decrypted_char)
            if i < 3:
                steps.append(f"       {encrypted_byte} XOR {key_byte} = {decrypted_byte} ('{decrypted_char}')")

        if len(encrypted_bytes) > 3:
            steps.append(f"       ... ({len(encrypted_bytes) - 3} more characters)")

        plaintext = ''.join(decrypted_chars)

        user = get_current_user()
        if user:
            save_history(user['id'], 'Decrypt Message', f'Decrypted {len(plaintext)} characters')

        return jsonify({
            'success': True,
            'plaintext': plaintext,
            'steps': steps,
            'shared_secret_point': {'x': S[0], 'y': S[1]}
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


if __name__ == '__main__':
    print("=" * 70)
    print("🔐 Elliptic Curve Calculator Server")
    print("=" * 70)
    print("\n✅ Server starting...")
    print("📡 Open your browser to: http://localhost:5000")
    print("\n⚙️  Press CTRL+C to stop\n")
    init_db()
    app.run(debug=True, port=5000)
