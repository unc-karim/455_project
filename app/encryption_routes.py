import base64
import hashlib
import hmac
import secrets

from flask import jsonify, request, session

from .db_helpers import get_current_user, save_history
from .elliptic_curve import EllipticCurve


def register_encryption_routes(app):
    @app.route('/api/encryption/init', methods=['POST'])
    def api_init_encryption():
        try:
            data = request.get_json()
            a = int(data['a'])
            b = int(data['b'])
            p = int(data['p'])
            custom_private_key = data.get('private_key')

            print(f"\n{'='*70}")
            print(f"INIT: Received custom_private_key = {custom_private_key} (type: {type(custom_private_key).__name__})")

            curve = EllipticCurve(a, b, p)

            points = curve.find_all_points()
            valid_points = [pt for pt in points if pt != (None, None)]

            if len(valid_points) < 2:
                return jsonify({'success': False, 'error': 'Curve has too few points for encryption'}), 400

            # Choose a high-order generator so different private keys do not collapse
            # to the same public key/shared secret (small subgroup problem).
            curve_info = curve.classify_points()
            orders = {pt: order for pt, order in curve_info.get('orders', {}).items() if order and order > 1}
            if orders:
                generator = max(orders.items(), key=lambda kv: kv[1])[0]
                generator_order = orders[generator]
            else:
                generator = valid_points[0]
                generator_order = curve.get_order(generator)

            # Fallback to safe range if order computation failed
            if not generator_order or generator_order <= 1:
                generator_order = p

            key_source = 'generated'
            if custom_private_key not in (None, ''):
                try:
                    private_key = int(custom_private_key)
                except (TypeError, ValueError):
                    return jsonify({'success': False, 'error': 'Private key must be an integer'}), 400

                max_key = (generator_order - 1) if generator_order else (p - 1)
                if private_key <= 0 or private_key > max_key:
                    return jsonify({'success': False, 'error': f'Private key must be between 1 and {max_key}'}), 400

                key_source = 'custom'
            else:
                max_key = (generator_order - 1) if generator_order else (p - 1)
                private_key = secrets.randbelow(max_key) + 1

            public_key = curve.scalar_multiply(private_key, generator)

            print(f"INIT: Setting session private_key = {private_key} (source: {key_source})")

            session['encryption_params'] = {
                'a': a, 'b': b, 'p': p,
                'generator': generator,
                'private_key': private_key,
                'public_key': public_key,
                'key_source': key_source,
                'generator_order': generator_order
            }

            print(f"INIT: Session updated with private_key = {session['encryption_params']['private_key']}")
            print(f"{'='*70}\n")

            user = get_current_user()
            if user:
                save_history(user['id'], 'Init Encryption', f'Initialized encryption on E_{p}({a}, {b})')

            return jsonify({
                'success': True,
                'generator': {'x': generator[0], 'y': generator[1]},
                'private_key': private_key,
                'public_key': {'x': public_key[0], 'y': public_key[1]},
                'num_points': len(valid_points),
                'used_custom_key': key_source == 'custom',
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
            generator_order = enc_params.get('generator_order')

            curve = EllipticCurve(a, b, p)

            max_k = (generator_order - 1) if generator_order and generator_order > 1 else (p - 1)
            k = secrets.randbelow(max_k) + 1
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

            # Step 6: Generate HMAC tag for authentication
            # Use cryptographic hash of the full shared secret point to prevent ANY collisions
            point_str = f"{S[0]}:{S[1]}"
            hmac_key = hashlib.sha256(point_str.encode()).digest()
            hmac_tag = hmac.new(hmac_key, bytes(encrypted_bytes), hashlib.sha256).digest()
            hmac_tag_hex = hmac_tag.hex()
            steps.append(f"Step 6: Generate HMAC-SHA256 authentication tag")
            steps.append(f"       Using full shared secret point: ({S[0]}, {S[1]})")
            steps.append(f"       HMAC key = SHA256({S[0]}:{S[1]})")
            steps.append(f"       Tag (first 16 chars): {hmac_tag_hex[:16]}...")

            result = {
                'R': {'x': R[0], 'y': R[1]},
                'encrypted': encrypted_bytes,
                'shared_secret_point': {'x': S[0], 'y': S[1]},
                'k': k,
                'hmac_tag': hmac_tag_hex
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
            current_private_key = data.get('current_private_key')

            enc_params = session.get('encryption_params')
            if not enc_params:
                return jsonify({'success': False, 'error': 'Encryption system not initialized'}), 400

            a, b, p = enc_params['a'], enc_params['b'], enc_params['p']
            session_private_key = enc_params['private_key']
            generator_order = enc_params.get('generator_order')

            print(f"\n{'='*70}")
            print(f"DECRYPTION: Session private key = {session_private_key}")
            print(f"DECRYPTION: Received current_private_key = {current_private_key} (type: {type(current_private_key).__name__})")

            # Use current private key if provided and different from session
            private_key = session_private_key
            if current_private_key is not None and current_private_key != session_private_key:
                # Validate the provided private key
                max_key = (generator_order - 1) if generator_order and generator_order > 1 else (p - 1)
                if not isinstance(current_private_key, int) or current_private_key <= 0 or current_private_key > max_key:
                    return jsonify({'success': False, 'error': f'Invalid private key. Must be an integer between 1 and {max_key}'}), 400
                private_key = current_private_key
                print(f"DECRYPTION: ✓✓✓ USING DIFFERENT KEY {private_key} ✓✓✓")
            else:
                print(f"DECRYPTION: Using session key (no different key provided or key equals session key)")
            print(f"{'='*70}\n")

            curve = EllipticCurve(a, b, p)

            R = (ciphertext['R']['x'], ciphertext['R']['y'])
            encrypted_bytes = ciphertext['encrypted']
            stored_hmac_tag = ciphertext.get('hmac_tag')

            # CRITICAL: Require HMAC tag for security
            if not stored_hmac_tag:
                return jsonify({'success': False, 'error': 'CRITICAL: No HMAC tag found in ciphertext. This ciphertext is in old format or corrupted. Please re-encrypt your message with the current system.'}), 400

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

            # Step 5: Verify HMAC tag (MANDATORY)
            steps.append(f"Step 5: Verify HMAC-SHA256 authentication tag")
            hmac_verified = False
            error_message = None

            # HMAC verification is now mandatory (we already checked for tag above)
            # Use cryptographic hash of the full shared secret point to prevent ANY collisions
            point_str = f"{S[0]}:{S[1]}"
            hmac_key = hashlib.sha256(point_str.encode()).digest()
            computed_hmac = hmac.new(hmac_key, bytes(encrypted_bytes), hashlib.sha256).digest()
            computed_hmac_hex = computed_hmac.hex()

            # Use constant-time comparison to prevent timing attacks
            print(f"DEBUG: Verifying HMAC with shared_secret_point=({S[0]}, {S[1]})")
            print(f"DEBUG: HMAC key = SHA256({S[0]}:{S[1]})")
            print(f"DEBUG: Stored HMAC: {stored_hmac_tag[:16]}...")
            print(f"DEBUG: Computed HMAC: {computed_hmac_hex[:16]}...")

            if hmac.compare_digest(computed_hmac_hex, stored_hmac_tag):
                steps.append(f"       ✓ HMAC verification PASSED - correct key used!")
                print(f"DEBUG: HMAC verification PASSED!")
                hmac_verified = True
            else:
                steps.append(f"       ❌ HMAC verification FAILED!")
                steps.append(f"       Expected: {stored_hmac_tag[:16]}...")
                steps.append(f"       Got:      {computed_hmac_hex[:16]}...")
                steps.append(f"       ⚠️ WARNING: This output is GARBAGE! Wrong private key detected!")
                hmac_verified = False
                error_message = '⚠️ Authentication tag verification failed. Wrong private key? The output below is garbage data!'
                print(f"DEBUG: HMAC verification FAILED!")

            plaintext = ''.join(decrypted_chars)

            user = get_current_user()
            if user:
                save_history(user['id'], 'Decrypt Message', f'Decrypted {len(plaintext)} characters')

            # Return result with error warning if HMAC verification failed
            result = {
                'success': hmac_verified,
                'plaintext': plaintext,
                'steps': steps,
                'shared_secret_point': {'x': S[0], 'y': S[1]},
                'hmac_verified': hmac_verified
            }

            if error_message:
                result['error'] = error_message

            return jsonify(result)
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 400
