"""Server entry point for the Elliptic Curve Calculator Flask app."""

import os

from app import app


def _print_banner(port: int):
    """Print a friendly startup banner for local runs."""
    print("=" * 70)
    print("🔐 Elliptic Curve Calculator Server")
    print("=" * 70)
    print("\n✅ Server starting...")
    print(f"📡 Open your browser to: http://localhost:{port}")
    print("\n⚙️  Press CTRL+C to stop\n")


if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    _print_banner(port)
    app.run(debug=True, port=port, host="0.0.0.0")
