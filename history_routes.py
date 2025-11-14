import json

from flask import jsonify, session

from db_helpers import ensure_session_id, get_current_user, get_db


def register_history_routes(app):
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

    @app.route('/api/history', methods=['GET'])
    def get_history():
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
