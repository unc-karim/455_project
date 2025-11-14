import base64
import secrets

from flask import jsonify, request, session

from db_helpers import get_current_user, save_history
from elliptic_curve import EllipticCurve


def register_encryption_routes(app):
    @app.route('/api/encryption/init', methods=['POST'])
    def api_init_encryption():
        try:
            data = request.get_json()
            a = int(data['a'])
            b = int(data['b'])
            p = int(data['p'])

            curve = EllipticCurve(a, b, p)

            points = curve.find_all_points()
            valid_points = [pt for pt in points if pt != (None, None)]

            if len(valid_points) < 2:
                return jsonify({'success': False, 'error': 'Curve has too few points for encryption'}), 400

            generator = valid_points[0]
            private_key = secrets.randbelow(p - 1) + 1
            public_key = curve.scalar_multiply(private_key, generator)

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
        try:
            data = request.get_json()
            plaintext = data.get('plaintext', '')
            file_data_b64 = data.get('file_data')
            file_name = data.get('file_name')

            enc_params = session.get('encryption_params')
            if not enc_params:
                return jsonify({'success': False, 'error': 'Encryption system not initialized'}), 400

            a, b, p = enc_params['a'], enc_params['b'], enc_params['p']
            generator = tuple(enc_params['generator'])
            public_key = tuple(enc_params['public_key'])

            curve = EllipticCurve(a, b, p)

            k = secrets.randbelow(p - 1) + 1
            R = curve.scalar_multiply(k, generator)
            S = curve.scalar_multiply(k, public_key)
            shared_secret = S[0] if S[0] is not None else 0

            payload_bytes = plaintext.encode('utf-8')
            payload_type = 'text'
            payload_label = 'text message'
            if file_data_b64:
                try:
                    payload_bytes = base64.b64decode(file_data_b64)
                except Exception:
                    return jsonify({'success': False, 'error': 'Invalid file data'}), 400
                payload_type = 'file'
                if file_name:
                    payload_label = f'file: {file_name}'
                else:
                    payload_label = 'uploaded file'

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

            for i, byte_val in enumerate(payload_bytes):
                key_byte = (shared_secret + i) % 256
                encrypted_byte = byte_val ^ key_byte
                encrypted_bytes.append(encrypted_byte)
                if i < 3:
                    if payload_type == 'text' and 32 <= byte_val <= 126:
                        char_display = f"'{chr(byte_val)}' (ASCII {byte_val})"
                    else:
                        char_display = f"byte {byte_val}"
                    steps.append(f"       {char_display} XOR {key_byte} = {encrypted_byte}")

            if len(payload_bytes) > 3:
                steps.append(f"       ... ({len(payload_bytes) - 3} more bytes)")

            result = {
                'R': {'x': R[0], 'y': R[1]},
                'encrypted': encrypted_bytes,
                'shared_secret_point': {'x': S[0], 'y': S[1]},
                'k': k
            }

            user = get_current_user()
            if user:
                save_history(user['id'], 'Encrypt Message', f'Encrypted {len(payload_bytes)} bytes ({payload_label})')

            return jsonify({
                'success': True,
                'ciphertext': result,
                'steps': steps,
                'payload_length': len(payload_bytes),
                'payload_type': payload_type,
                'payload_label': payload_label,
                'file_name': file_name
            })
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 400

    @app.route('/api/encryption/decrypt', methods=['POST'])
    def api_decrypt():
        try:
            data = request.get_json()
            ciphertext = data['ciphertext']

            enc_params = session.get('encryption_params')
            if not enc_params:
                return jsonify({'success': False, 'error': 'Encryption system not initialized'}), 400

            a, b, p = enc_params['a'], enc_params['b'], enc_params['p']
            private_key = enc_params['private_key']

            curve = EllipticCurve(a, b, p)

            R = (ciphertext['R']['x'], ciphertext['R']['y'])
            encrypted_bytes = ciphertext['encrypted']
            S = curve.scalar_multiply(private_key, R)
            shared_secret = S[0] if S[0] is not None else 0

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
