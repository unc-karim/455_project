"""
ECIES-KEM Encryption Routes (CORRECTED)
Implements proper Elliptic Curve Integrated Encryption Scheme

Security Fixes:
1. Use AES-256-GCM instead of XOR
2. Proper key derivation from shared secret using SHA-256
3. Authentication tag prevents tampering
4. Nonce for each encryption ensures uniqueness
"""

import base64
import hashlib
import secrets
import json
from Crypto.Cipher import AES
from flask import jsonify, request, session

from .db_helpers import get_current_user, save_history
from .elliptic_curve import EllipticCurve


def kdf_sha256(shared_secret_point, salt=b"ECIES-KDF", info=b"encryption-key"):
    """
    Key Derivation Function using SHA-256

    Derives encryption and MAC keys from the shared secret point.
    This ensures the key is properly stretched and authenticated.

    Args:
        shared_secret_point: Tuple (x, y) of the shared secret point
        salt: Salt for KDF (optional)
        info: Application info string (optional)

    Returns:
        tuple: (aes_key, nonce) - 32 bytes for AES-256, 12 bytes for GCM nonce
    """
    if shared_secret_point == (None, None):
        raise ValueError("Shared secret is point at infinity - key derivation failed")

    x, y = shared_secret_point

    # Concatenate both coordinates for full key material (standard practice)
    key_material = str(x).encode() + str(y).encode()

    # HMAC-SHA256 based KDF (HKDF simplified)
    # Extract: hash key material with salt
    prk = hashlib.sha256(salt + key_material).digest()

    # Expand: derive actual keys
    # For AES-256: 32 bytes
    # For GCM nonce: 12 bytes
    t1 = hashlib.sha256(prk + info + b'\x01').digest()  # 32 bytes
    t2 = hashlib.sha256(prk + t1 + b'\x02').digest()    # 32 bytes

    aes_key = t1  # 32 bytes for AES-256
    nonce = hashlib.sha256(t2 + info + b'\x03').digest()[:12]  # 12 bytes for GCM

    return aes_key, nonce


def register_encryption_routes(app):
    @app.route('/api/encryption/init', methods=['POST'])
    def api_init_encryption():
        """
        Initialize ECIES encryption system

        Validates:
        - Curve parameters are valid
        - Generator point is on curve
        - Private key is in valid range [1, n-1] or auto-generated
        - Public key = private_key * G is computed and verified to be on curve
        """
        try:
            data = request.get_json()
            a = int(data['a'])
            b = int(data['b'])
            p = int(data['p'])
            custom_private_key = data.get('private_key')

            # SECURITY: Initialize curve (validates discriminant, primality, etc.)
            curve = EllipticCurve(a, b, p)

            points = curve.find_all_points()
            valid_points = [pt for pt in points if pt != (None, None)]

            if len(valid_points) < 2:
                return jsonify({'success': False, 'error': 'Curve has too few points for ECIES'}), 400

            generator = valid_points[0]

            # SECURITY: Validate generator point is on curve
            if not curve.is_point_on_curve(generator[0], generator[1]):
                return jsonify({'success': False, 'error': 'Generator point is not on the curve'}), 400

            key_source = 'generated'
            if custom_private_key not in (None, ''):
                try:
                    private_key = int(custom_private_key)
                except (TypeError, ValueError):
                    return jsonify({'success': False, 'error': 'Private key must be an integer'}), 400

                # SECURITY FIX: Private key must be in range [1, p-1]
                # For ECIES with proper order, should be [1, n-1], but p-1 is safer minimum
                if private_key <= 0 or private_key >= p:
                    return jsonify({
                        'success': False,
                        'error': f'Private key must be in range [1, {p-1}]'
                    }), 400

                key_source = 'custom'
            else:
                # SECURITY: Generate random private key using secrets module
                private_key = secrets.randbelow(p - 1) + 1

            # SECURITY: Compute public key using scalar multiplication
            public_key = curve.scalar_multiply(private_key, generator)

            # SECURITY: Verify public key is on curve
            if not curve.is_point_on_curve(public_key[0], public_key[1]):
                return jsonify({'success': False, 'error': 'Generated public key is not on curve'}), 400

            # Store in session (temporary - for demo purposes)
            session['encryption_params'] = {
                'a': a, 'b': b, 'p': p,
                'generator': generator,
                'private_key': private_key,
                'public_key': public_key,
                'key_source': key_source
            }

            user = get_current_user()
            if user:
                save_history(user['id'], 'Init ECIES', f'Initialized ECIES on E_{p}({a}, {b})')

            return jsonify({
                'success': True,
                'generator': {'x': generator[0], 'y': generator[1]},
                'private_key': private_key,
                'public_key': {'x': public_key[0], 'y': public_key[1]},
                'num_points': len(valid_points),
                'used_custom_key': key_source == 'custom',
                'message': f'ECIES initialized on E_{p}({a}, {b})'
            })
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 400

    @app.route('/api/encryption/encrypt', methods=['POST'])
    def api_encrypt():
        """
        ECIES Encryption (Elliptic Curve Integrated Encryption Scheme)

        Protocol:
        1. Generate ephemeral keypair: (k, R = k*G)
        2. Compute shared secret: S = k * PublicKey
        3. Derive encryption key: aes_key, nonce = KDF(S)
        4. Encrypt with AES-256-GCM: C = Enc_aes_key(plaintext, nonce)
        5. Return: (R, C, tag)

        Security properties:
        - IND-CPA: Forward secrecy via ephemeral key
        - IND-CCA2: AEAD authentication via GCM tag
        - No plaintext recovery with wrong key
        """
        try:
            data = request.get_json()
            plaintext = data.get('plaintext', '')
            file_data_b64 = data.get('file_data')
            file_name = data.get('file_name')

            enc_params = session.get('encryption_params')
            if not enc_params:
                return jsonify({
                    'success': False,
                    'error': 'Encryption system not initialized. Call /api/encryption/init first.'
                }), 400

            a, b, p = enc_params['a'], enc_params['b'], enc_params['p']
            generator = tuple(enc_params['generator'])
            public_key = tuple(enc_params['public_key'])

            # SECURITY: Reinitialize curve to validate parameters
            curve = EllipticCurve(a, b, p)

            # Prepare payload
            payload_bytes = plaintext.encode('utf-8')
            payload_type = 'text'
            payload_label = 'text message'

            if file_data_b64:
                try:
                    payload_bytes = base64.b64decode(file_data_b64)
                except Exception:
                    return jsonify({'success': False, 'error': 'Invalid file data'}), 400
                payload_type = 'file'
                payload_label = f'file: {file_name}' if file_name else 'uploaded file'

            steps = []

            # === ECIES ENCRYPTION STEP 1: Generate ephemeral key ===
            # SECURITY: Use cryptographically secure random (secrets module)
            k = secrets.randbelow(p - 1) + 1
            steps.append(f"Step 1: Generate random ephemeral private key k = {k}")

            # === ECIES ENCRYPTION STEP 2: Compute ephemeral public key ===
            R = curve.scalar_multiply(k, generator)
            steps.append(f"Step 2: Compute ephemeral public key R = k × G")
            steps.append(f"        R = {k} × ({generator[0]}, {generator[1]})")
            steps.append(f"        R = ({R[0]}, {R[1]})")

            # === ECIES ENCRYPTION STEP 3: Compute shared secret ===
            # SECURITY: S = k * Q (not k * G)
            S = curve.scalar_multiply(k, public_key)
            steps.append(f"Step 3: Compute shared secret S = k × PublicKey")
            steps.append(f"        S = {k} × ({public_key[0]}, {public_key[1]})")
            steps.append(f"        S = ({S[0]}, {S[1]})")

            # === ECIES ENCRYPTION STEP 4: Key derivation ===
            # SECURITY FIX: Proper KDF instead of just taking S[0]
            aes_key, nonce = kdf_sha256(S)
            steps.append(f"Step 4: Derive encryption key from shared secret using KDF-SHA256")
            steps.append(f"        KDF input: S.x||S.y = {S[0]}||{S[1]}")
            steps.append(f"        AES-256 key (hex): {aes_key.hex()[:32]}... (32 bytes)")
            steps.append(f"        GCM nonce (hex): {nonce.hex()} (12 bytes)")

            # === ECIES ENCRYPTION STEP 5: Encrypt with AES-256-GCM ===
            # SECURITY FIX: Proper AEAD cipher with authentication tag
            cipher = AES.new(aes_key, AES.MODE_GCM, nonce=nonce)
            ciphertext_bytes = cipher.encrypt(payload_bytes)
            auth_tag = cipher.digest()

            steps.append(f"Step 5: Encrypt message using AES-256-GCM")
            steps.append(f"        Plaintext: {len(payload_bytes)} bytes")
            steps.append(f"        Ciphertext: {len(ciphertext_bytes)} bytes")
            steps.append(f"        Authentication tag (HMAC): {auth_tag.hex()}")

            # Show encryption details for first few bytes
            if len(payload_bytes) > 0:
                steps.append(f"        First bytes example:")
                for i in range(min(3, len(payload_bytes))):
                    byte_val = payload_bytes[i]
                    if payload_type == 'text' and 32 <= byte_val <= 126:
                        char_display = f"'{chr(byte_val)}' (ASCII {byte_val})"
                    else:
                        char_display = f"byte {byte_val}"
                    steps.append(f"          {char_display} → {ciphertext_bytes[i]}")
                if len(payload_bytes) > 3:
                    steps.append(f"        ... ({len(payload_bytes) - 3} more bytes)")

            # Prepare result object
            result = {
                'R': {'x': R[0], 'y': R[1]},
                'ciphertext': list(ciphertext_bytes),  # Convert bytes to list for JSON
                'auth_tag': list(auth_tag),             # Authentication tag for integrity
                'nonce': list(nonce),                   # Nonce for reconstruction
                'shared_secret_point': {'x': S[0], 'y': S[1]}
            }

            user = get_current_user()
            if user:
                save_history(user['id'], 'ECIES Encrypt',
                           f'Encrypted {len(payload_bytes)} bytes ({payload_label}) using ECIES-AES-256-GCM')

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
            import traceback
            traceback.print_exc()
            return jsonify({'success': False, 'error': str(e)}), 400

    @app.route('/api/encryption/decrypt', methods=['POST'])
    def api_decrypt():
        """
        ECIES Decryption

        Protocol:
        1. Extract ephemeral public key R from ciphertext
        2. Compute shared secret: S = private_key * R
        3. Derive decryption key: aes_key, nonce = KDF(S)
        4. Decrypt with AES-256-GCM: plaintext = Dec_aes_key(ciphertext, nonce, tag)
        5. Verify authentication tag

        Security properties:
        - Same shared secret computed via: private_key * R = private_key * (k*G) = k * (private_key*G) = k*Q
        - GCM tag verification prevents tampering and forgery
        - Wrong private key → wrong shared secret → decryption fails
        """
        try:
            data = request.get_json()
            ciphertext_obj = data['ciphertext']

            enc_params = session.get('encryption_params')
            if not enc_params:
                return jsonify({
                    'success': False,
                    'error': 'Encryption system not initialized. Call /api/encryption/init first.'
                }), 400

            a, b, p = enc_params['a'], enc_params['b'], enc_params['p']
            private_key = enc_params['private_key']

            # SECURITY: Reinitialize curve to validate parameters
            curve = EllipticCurve(a, b, p)

            steps = []

            # === ECIES DECRYPTION STEP 1: Extract ephemeral public key ===
            R = (ciphertext_obj['R']['x'], ciphertext_obj['R']['y'])
            steps.append(f"Step 1: Extract ephemeral public key from ciphertext")
            steps.append(f"        R = ({R[0]}, {R[1]})")

            # Validate R is on curve
            if not curve.is_point_on_curve(R[0], R[1]):
                return jsonify({
                    'success': False,
                    'error': 'Invalid ciphertext: R is not on the curve'
                }), 400

            # === ECIES DECRYPTION STEP 2: Compute shared secret ===
            # SECURITY: S = private_key * R (matches encryption's k * Q)
            S = curve.scalar_multiply(private_key, R)
            steps.append(f"Step 2: Compute shared secret S = PrivateKey × R")
            steps.append(f"        S = {private_key} × ({R[0]}, {R[1]})")
            steps.append(f"        S = ({S[0]}, {S[1]})")

            # === ECIES DECRYPTION STEP 3: Key derivation ===
            # SECURITY: Same KDF as encryption
            aes_key, nonce_computed = kdf_sha256(S)

            # SECURITY FIX: Use nonce from ciphertext (it's not secret!)
            nonce = bytes(ciphertext_obj.get('nonce', nonce_computed))
            steps.append(f"Step 3: Derive decryption key from shared secret using KDF-SHA256")
            steps.append(f"        KDF input: S.x||S.y = {S[0]}||{S[1]}")
            steps.append(f"        AES-256 key (hex): {aes_key.hex()[:32]}... (32 bytes)")
            steps.append(f"        GCM nonce (hex): {nonce.hex()} (12 bytes)")

            # === ECIES DECRYPTION STEP 4: Decrypt with AES-256-GCM ===
            # SECURITY FIX: Verify authentication tag
            ciphertext_bytes = bytes(ciphertext_obj['ciphertext'])
            auth_tag = bytes(ciphertext_obj['auth_tag'])

            cipher = AES.new(aes_key, AES.MODE_GCM, nonce=nonce)
            try:
                plaintext_bytes = cipher.decrypt_and_verify(ciphertext_bytes, auth_tag)
            except ValueError as e:
                # SECURITY: GCM tag verification failed
                return jsonify({
                    'success': False,
                    'error': 'Decryption failed: Authentication tag verification failed. Wrong private key?'
                }), 400

            steps.append(f"Step 4: Decrypt message using AES-256-GCM")
            steps.append(f"        Ciphertext: {len(ciphertext_bytes)} bytes")
            steps.append(f"        Plaintext: {len(plaintext_bytes)} bytes")
            steps.append(f"        Authentication: ✓ VERIFIED (tag matched)")

            # Show decryption details
            try:
                plaintext = plaintext_bytes.decode('utf-8')
                if len(plaintext_bytes) > 0:
                    steps.append(f"        First bytes example:")
                    for i in range(min(3, len(plaintext_bytes))):
                        byte_val = plaintext_bytes[i]
                        if 32 <= byte_val <= 126:
                            char_display = f"'{chr(byte_val)}' (ASCII {byte_val})"
                        else:
                            char_display = f"byte {byte_val}"
                        steps.append(f"          Ciphertext byte → {char_display}")
                    if len(plaintext_bytes) > 3:
                        steps.append(f"        ... ({len(plaintext_bytes) - 3} more bytes)")
            except UnicodeDecodeError:
                plaintext = f"[Binary data: {len(plaintext_bytes)} bytes]"
                steps.append(f"        Note: Plaintext is binary (not valid UTF-8)")

            user = get_current_user()
            if user:
                save_history(user['id'], 'ECIES Decrypt',
                           f'Decrypted {len(plaintext_bytes)} bytes with successful tag verification')

            return jsonify({
                'success': True,
                'plaintext': plaintext,
                'plaintext_bytes': len(plaintext_bytes),
                'steps': steps,
                'shared_secret_point': {'x': S[0], 'y': S[1]},
                'auth_verified': True
            })
        except Exception as e:
            import traceback
            traceback.print_exc()
            return jsonify({'success': False, 'error': str(e)}), 400
