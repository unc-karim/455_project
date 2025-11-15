"""
Simple Flask Server for Elliptic Curve Calculator
Imports elliptic_curve.py and provides API endpoints
"""

import secrets

from flask import Flask, render_template

from advanced_routes import register_advanced_routes
from auth_routes import register_auth_routes
from db_helpers import init_db
from ecc_routes import register_ecc_routes
from encryption_routes import register_encryption_routes
from history_routes import register_history_routes
from tutorials import register_tutorial_routes

app = Flask(__name__)
app.secret_key = secrets.token_hex(16)

register_auth_routes(app)
register_ecc_routes(app)
register_history_routes(app)
register_encryption_routes(app)
register_advanced_routes(app)
register_tutorial_routes(app)


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


if __name__ == '__main__':
    print("=" * 70)
    print("🔐 Elliptic Curve Calculator Server")
    print("=" * 70)
    print("\n✅ Server starting...")
    print("📡 Open your browser to: http://localhost:5000")
    print("\n⚙️  Press CTRL+C to stop\n")
    init_db()
    app.run(debug=True, port=5000)
