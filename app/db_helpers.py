import json
import os
import secrets
import sqlite3
from datetime import datetime
from pathlib import Path

from flask import session

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = Path(os.environ.get('DB_PATH', BASE_DIR / 'app.db'))


def get_db():
    conn = sqlite3.connect(str(DB_PATH))
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
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS password_resets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                used INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
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
