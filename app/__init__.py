"""
Application factory for the Elliptic Curve Calculator.

Provides a single place to build the Flask app, register routes, and
prepare dependencies such as the database. This keeps the server entry
point thin while leaving the route logic unchanged.
"""

import os
import secrets
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, render_template, request

from . import advanced_routes, auth_routes, chat_routes, ecc_routes, encryption_routes, history_routes, tutorials
from .db_helpers import init_db

BASE_DIR = Path(__file__).resolve().parent.parent

# Exported for gunicorn/uwsgi discovery
__all__ = ["create_app", "app"]


def create_app():
    """Create and configure the Flask application."""
    load_dotenv(BASE_DIR / ".env")
    app = Flask(
        __name__,
        static_folder=str(BASE_DIR / "static"),
        template_folder=str(BASE_DIR / "templates"),
    )
    app.secret_key = os.environ.get("FLASK_SECRET_KEY") or secrets.token_hex(16)

    _register_routes(app)
    _register_base_pages(app)
    init_db()

    return app


def _register_routes(app):
    """Attach all API route groups to the app."""
    auth_routes.register_auth_routes(app)
    ecc_routes.register_ecc_routes(app)
    history_routes.register_history_routes(app)
    encryption_routes.register_encryption_routes(app)
    advanced_routes.register_advanced_routes(app)
    chat_routes.register_chat_routes(app)
    tutorials.register_tutorial_routes(app)


def _register_base_pages(app):
    """Register the simple page routes served by render_template."""

    @app.route('/')
    def index():
        """Serve the main page."""
        return render_template('calculator.html')

    @app.route('/app')
    def app_page():
        """Alias route for app redirect targets."""
        return render_template('calculator.html')

    @app.route('/signup')
    def signup_page():
        """Signup page (standalone card UI)."""
        return render_template('signup.html')

    @app.route('/reset')
    def reset_page():
        """Password reset page (token via query parameter)."""
        token = request.args.get('token', '')
        return render_template('reset.html', token=token)


# Provide a module-level application instance for WSGI servers.
app = create_app()
