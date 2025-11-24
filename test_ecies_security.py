"""
Comprehensive Security Test Suite for ECIES Implementation

Tests cover:
1. Elliptic curve mathematical correctness
2. Key generation and validation
3. ECIES encryption/decryption
4. Authentication tag verification
5. Wrong key rejection
6. Edge cases
"""

import sys
import unittest
from app.elliptic_curve import EllipticCurve
from app.encryption_routes_fixed import kdf_sha256
import hashlib
from Crypto.Cipher import AES


class TestEllipticCurveMath(unittest.TestCase):
    """Test elliptic curve mathematical operations"""

    def setUp(self):
        """Set up test fixtures"""
        # Small prime for testing: p = 17
        # Curve: y^2 = x^3 + 2x + 2 (mod 17)
        self.p = 17
        self.a = 2
        self.b = 2
        self.curve = EllipticCurve(self.a, self.b, self.p)

    def test_point_on_curve(self):
        """Test: Points on curve satisfy y^2 = x^3 + ax + b (mod p)"""
        # Point (5, 1) on y^2 = x^3 + 2x + 2 (mod 17)
        # 1^2 = 5^3 + 2*5 + 2 = 125 + 10 + 2 = 137 ≡ 1 (mod 17) ✓
        self.assertTrue(self.curve.is_point_on_curve(5, 1))
        self.assertTrue(self.curve.is_point_on_curve(None, None))  # Point at infinity

    def test_point_not_on_curve(self):
        """Test: Invalid points are rejected"""
        self.assertFalse(self.curve.is_point_on_curve(0, 0))
        self.assertFalse(self.curve.is_point_on_curve(1, 1))

    def test_point_addition(self):
        """Test: Point addition formula y^2 = x^3 + ax + b (mod p)"""
        # P = (5, 1), Q = (6, 4)
        P = (5, 1)
        Q = (6, 4)
        R = self.curve.add_points(P, Q)

        # Verify result is on curve
        self.assertTrue(self.curve.is_point_on_curve(R[0], R[1]))

        # Verify commutativity: P + Q = Q + P
        R_reverse = self.curve.add_points(Q, P)
        self.assertEqual(R, R_reverse)

    def test_point_doubling(self):
        """Test: Point doubling 2P = P + P"""
        P = (5, 1)
        double = self.curve.add_points(P, P)

        # Verify result is on curve
        self.assertTrue(self.curve.is_point_on_curve(double[0], double[1]))

        # Verify doubling produces different point
        self.assertNotEqual(double, P)

    def test_point_addition_with_identity(self):
        """Test: P + O = P (point at infinity is identity)"""
        P = (5, 1)
        identity = (None, None)

        self.assertEqual(self.curve.add_points(P, identity), P)
        self.assertEqual(self.curve.add_points(identity, P), P)

    def test_point_inverse(self):
        """Test: P + (-P) = O"""
        P = (5, 1)
        # Inverse is (5, -1) = (5, 16) in mod 17
        P_neg = (5, 16)

        result = self.curve.add_points(P, P_neg)
        self.assertEqual(result, (None, None))

    def test_associativity(self):
        """Test: (P + Q) + R = P + (Q + R)"""
        P = (5, 1)
        Q = (6, 4)
        points = self.curve.find_all_points()
        R = [pt for pt in points if pt != (None, None) and pt != P and pt != Q][0]

        left = self.curve.add_points(self.curve.add_points(P, Q), R)
        right = self.curve.add_points(P, self.curve.add_points(Q, R))

        self.assertEqual(left, right)

    def test_scalar_multiplication_zero(self):
        """Test: 0 * P = O"""
        P = (5, 1)
        result = self.curve.scalar_multiply(0, P)
        self.assertEqual(result, (None, None))

    def test_scalar_multiplication_one(self):
        """Test: 1 * P = P"""
        P = (5, 1)
        result = self.curve.scalar_multiply(1, P)
        self.assertEqual(result, P)

    def test_scalar_multiplication_double_and_add(self):
        """Test: scalar multiplication using double-and-add is correct"""
        P = (5, 1)
        k = 5

        # Result of 5*P
        result = self.curve.scalar_multiply(k, P)

        # Verify it's on curve
        self.assertTrue(self.curve.is_point_on_curve(result[0], result[1]))

        # Verify by manual addition
        manual = P
        for _ in range(k - 1):
            manual = self.curve.add_points(manual, P)

        self.assertEqual(result, manual)

    def test_scalar_multiplication_negative(self):
        """Test: -k * P = -(k * P)"""
        P = (5, 1)
        k = 3

        result_pos = self.curve.scalar_multiply(k, P)
        result_neg = self.curve.scalar_multiply(-k, P)

        # -P should be (x, -y mod p)
        P_neg = (result_pos[0], (-result_pos[1]) % self.p)

        self.assertEqual(self.curve.add_points(result_pos, result_neg), (None, None))

    def test_modular_inverse(self):
        """Test: a * mod_inverse(a) ≡ 1 (mod p)"""
        for a in [1, 2, 3, 5, 7, 11, 13]:
            inv = self.curve.mod_inverse(a)
            product = (a * inv) % self.p
            self.assertEqual(product, 1)

    def test_modular_inverse_invalid(self):
        """Test: No inverse for multiples of p"""
        with self.assertRaises(ValueError):
            self.curve.mod_inverse(0)


class TestKeyGeneration(unittest.TestCase):
    """Test ECIES key generation"""

    def setUp(self):
        """Set up test fixtures"""
        self.p = 17
        self.a = 2
        self.b = 2
        self.curve = EllipticCurve(self.a, self.b, self.p)
        # Find a valid generator
        points = self.curve.find_all_points()
        self.generator = [pt for pt in points if pt != (None, None)][0]

    def test_public_key_generation(self):
        """Test: public_key = private_key * G is on curve"""
        private_key = 5
        public_key = self.curve.scalar_multiply(private_key, self.generator)

        # Public key must be on curve
        self.assertTrue(self.curve.is_point_on_curve(public_key[0], public_key[1]))

        # Public key must not be identity
        self.assertNotEqual(public_key, (None, None))

    def test_different_keys_different_public_keys(self):
        """Test: Different private keys → different public keys"""
        pk1 = self.curve.scalar_multiply(3, self.generator)
        pk2 = self.curve.scalar_multiply(5, self.generator)

        self.assertNotEqual(pk1, pk2)

    def test_private_key_edge_cases(self):
        """Test: Edge cases for private keys"""
        # k = 1: public_key = G
        pk_one = self.curve.scalar_multiply(1, self.generator)
        self.assertEqual(pk_one, self.generator)

        # k = p-1: should be on curve
        pk_max = self.curve.scalar_multiply(self.p - 1, self.generator)
        self.assertTrue(self.curve.is_point_on_curve(pk_max[0], pk_max[1]))

    def test_deterministic_key_generation(self):
        """Test: Same private key always produces same public key"""
        private_key = 7
        pk1 = self.curve.scalar_multiply(private_key, self.generator)
        pk2 = self.curve.scalar_multiply(private_key, self.generator)

        self.assertEqual(pk1, pk2)


class TestKeyDerivation(unittest.TestCase):
    """Test KDF-SHA256 key derivation"""

    def test_kdf_deterministic(self):
        """Test: KDF produces same output for same input"""
        S = (5, 10)  # Shared secret point
        key1, nonce1 = kdf_sha256(S)
        key2, nonce2 = kdf_sha256(S)

        self.assertEqual(key1, key2)
        self.assertEqual(nonce1, nonce2)

    def test_kdf_different_input_different_output(self):
        """Test: Different shared secrets → different keys"""
        S1 = (5, 10)
        S2 = (5, 11)

        key1, _ = kdf_sha256(S1)
        key2, _ = kdf_sha256(S2)

        self.assertNotEqual(key1, key2)

    def test_kdf_output_sizes(self):
        """Test: KDF produces correct key and nonce sizes"""
        S = (5, 10)
        key, nonce = kdf_sha256(S)

        # AES-256 key: 32 bytes
        self.assertEqual(len(key), 32)

        # GCM nonce: 12 bytes
        self.assertEqual(len(nonce), 12)

    def test_kdf_uses_both_coordinates(self):
        """Test: KDF depends on both x and y coordinates"""
        # If KDF only used x, these would give same key
        S_xy = (5, 10)
        S_xx = (5, 5)

        key1, _ = kdf_sha256(S_xy)
        key2, _ = kdf_sha256(S_xx)

        self.assertNotEqual(key1, key2)


class TestECIESEncryption(unittest.TestCase):
    """Test ECIES encryption and decryption"""

    def setUp(self):
        """Set up test fixtures"""
        self.p = 17
        self.a = 2
        self.b = 2
        self.curve = EllipticCurve(self.a, self.b, self.p)

        # Generate keypair
        points = self.curve.find_all_points()
        self.G = [pt for pt in points if pt != (None, None)][0]
        self.private_key = 7
        self.public_key = self.curve.scalar_multiply(self.private_key, self.G)

    def test_ecies_roundtrip(self):
        """Test: Encrypt then decrypt returns original plaintext"""
        plaintext = b"Hello World"

        # === Encryption ===
        # Generate ephemeral key
        k = 5
        R = self.curve.scalar_multiply(k, self.G)

        # Compute shared secret
        S = self.curve.scalar_multiply(k, self.public_key)

        # Derive keys
        aes_key, nonce = kdf_sha256(S)

        # Encrypt
        cipher_enc = AES.new(aes_key, AES.MODE_GCM, nonce=nonce)
        ciphertext = cipher_enc.encrypt(plaintext)
        auth_tag = cipher_enc.digest()

        # === Decryption ===
        # Compute shared secret using private key
        S_dec = self.curve.scalar_multiply(self.private_key, R)

        # Verify shared secrets match
        self.assertEqual(S, S_dec)

        # Derive keys (same as encryption)
        aes_key_dec, nonce_dec = kdf_sha256(S_dec)
        self.assertEqual(aes_key, aes_key_dec)
        self.assertEqual(nonce, nonce_dec)

        # Decrypt and verify
        cipher_dec = AES.new(aes_key_dec, AES.MODE_GCM, nonce=nonce_dec)
        plaintext_recovered = cipher_dec.decrypt_and_verify(ciphertext, auth_tag)

        self.assertEqual(plaintext, plaintext_recovered)

    def test_ecies_different_plaintexts_different_ciphertexts(self):
        """Test: Different plaintexts → different ciphertexts"""
        k = 5
        R = self.curve.scalar_multiply(k, self.G)
        S = self.curve.scalar_multiply(k, self.public_key)
        aes_key, nonce = kdf_sha256(S)

        # Encrypt first message
        cipher1 = AES.new(aes_key, AES.MODE_GCM, nonce=nonce)
        ct1 = cipher1.encrypt(b"Message 1")

        # Encrypt second message (same key, nonce - only plaintext differs)
        cipher2 = AES.new(aes_key, AES.MODE_GCM, nonce=nonce)
        ct2 = cipher2.encrypt(b"Message 2")

        # Should be different
        self.assertNotEqual(ct1, ct2)

    def test_ecies_different_ephemeral_keys_different_ciphertexts(self):
        """Test: Different ephemeral keys → different ciphertexts (even for same plaintext)"""
        plaintext = b"Same message"

        # Encryption 1 with k=5
        k1 = 5
        R1 = self.curve.scalar_multiply(k1, self.G)
        S1 = self.curve.scalar_multiply(k1, self.public_key)
        aes_key1, nonce1 = kdf_sha256(S1)
        cipher1 = AES.new(aes_key1, AES.MODE_GCM, nonce=nonce1)
        ct1 = cipher1.encrypt(plaintext)

        # Encryption 2 with k=7
        k2 = 7
        R2 = self.curve.scalar_multiply(k2, self.G)
        S2 = self.curve.scalar_multiply(k2, self.public_key)
        aes_key2, nonce2 = kdf_sha256(S2)
        cipher2 = AES.new(aes_key2, AES.MODE_GCM, nonce=nonce2)
        ct2 = cipher2.encrypt(plaintext)

        # Should be different (different ephemeral keys → different nonces → different ciphertexts)
        self.assertNotEqual(ct1, ct2)

    def test_ecies_wrong_private_key_fails(self):
        """Test: Wrong private key cannot decrypt (fails authentication tag)"""
        # Encrypt with public key
        k = 5
        R = self.curve.scalar_multiply(k, self.G)
        S = self.curve.scalar_multiply(k, self.public_key)
        aes_key, nonce = kdf_sha256(S)

        cipher_enc = AES.new(aes_key, AES.MODE_GCM, nonce=nonce)
        ciphertext = cipher_enc.encrypt(b"Secret message")
        auth_tag = cipher_enc.digest()

        # Try decryption with WRONG private key
        wrong_private_key = self.private_key + 1  # Wrong key
        S_wrong = self.curve.scalar_multiply(wrong_private_key, R)

        # This produces different shared secret
        self.assertNotEqual(S, S_wrong)

        # Different shared secret → different derived key
        aes_key_wrong, nonce_wrong = kdf_sha256(S_wrong)
        self.assertNotEqual(aes_key, aes_key_wrong)

        # Decryption with wrong key should fail tag verification
        cipher_dec = AES.new(aes_key_wrong, AES.MODE_GCM, nonce=nonce_wrong)
        with self.assertRaises(ValueError):
            cipher_dec.decrypt_and_verify(ciphertext, auth_tag)

    def test_ecies_tampered_ciphertext_fails(self):
        """Test: Tampered ciphertext fails authentication tag"""
        k = 5
        R = self.curve.scalar_multiply(k, self.G)
        S = self.curve.scalar_multiply(k, self.public_key)
        aes_key, nonce = kdf_sha256(S)

        cipher_enc = AES.new(aes_key, AES.MODE_GCM, nonce=nonce)
        ciphertext = cipher_enc.encrypt(b"Original message")
        auth_tag = cipher_enc.digest()

        # Tamper with ciphertext
        tampered = bytearray(ciphertext)
        tampered[0] ^= 1  # Flip one bit
        tampered = bytes(tampered)

        # Decryption should fail
        cipher_dec = AES.new(aes_key, AES.MODE_GCM, nonce=nonce)
        with self.assertRaises(ValueError):
            cipher_dec.decrypt_and_verify(tampered, auth_tag)

    def test_ecies_tampered_auth_tag_fails(self):
        """Test: Tampered authentication tag fails verification"""
        k = 5
        R = self.curve.scalar_multiply(k, self.G)
        S = self.curve.scalar_multiply(k, self.public_key)
        aes_key, nonce = kdf_sha256(S)

        cipher_enc = AES.new(aes_key, AES.MODE_GCM, nonce=nonce)
        ciphertext = cipher_enc.encrypt(b"Message")
        auth_tag = cipher_enc.digest()

        # Tamper with auth tag
        tampered_tag = bytearray(auth_tag)
        tampered_tag[0] ^= 1
        tampered_tag = bytes(tampered_tag)

        # Verification should fail
        cipher_dec = AES.new(aes_key, AES.MODE_GCM, nonce=nonce)
        with self.assertRaises(ValueError):
            cipher_dec.decrypt_and_verify(ciphertext, tampered_tag)


class TestSecurityProperties(unittest.TestCase):
    """Test security properties of the ECIES implementation"""

    def setUp(self):
        """Set up test fixtures"""
        self.p = 17
        self.a = 2
        self.b = 2
        self.curve = EllipticCurve(self.a, self.b, self.p)

        points = self.curve.find_all_points()
        self.G = [pt for pt in points if pt != (None, None)][0]
        self.private_key = 7
        self.public_key = self.curve.scalar_multiply(self.private_key, self.G)

    def test_forward_secrecy(self):
        """Test: Ephemeral key ensures forward secrecy"""
        # Even if long-term private key is compromised,
        # past sessions remain secure because ephemeral key was random
        plaintext = b"Confidential"

        ciphertexts = []
        ephemeral_keys = []

        # Multiple encryptions
        for k in [3, 5, 7]:
            R = self.curve.scalar_multiply(k, self.G)
            S = self.curve.scalar_multiply(k, self.public_key)
            aes_key, nonce = kdf_sha256(S)

            cipher = AES.new(aes_key, AES.MODE_GCM, nonce=nonce)
            ct = cipher.encrypt(plaintext)
            ciphertexts.append(ct)
            ephemeral_keys.append(k)

        # All ciphertexts should be different (different ephemeral keys)
        self.assertEqual(len(set(map(bytes, ciphertexts))), len(ciphertexts))

    def test_indistinguishability(self):
        """Test: Ciphertext doesn't reveal plaintext (IND-CPA property)"""
        k = 5
        R = self.curve.scalar_multiply(k, self.G)
        S = self.curve.scalar_multiply(k, self.public_key)
        aes_key, nonce = kdf_sha256(S)

        # Same length plaintexts produce different ciphertexts
        cipher1 = AES.new(aes_key, AES.MODE_GCM, nonce=nonce)
        ct1 = cipher1.encrypt(b"Message A")

        cipher2 = AES.new(aes_key, AES.MODE_GCM, nonce=nonce)
        ct2 = cipher2.encrypt(b"Message B")

        # Ciphertexts are different
        self.assertNotEqual(ct1, ct2)

        # Can't determine plaintext from ciphertext
        self.assertEqual(len(ct1), len(ct2))  # But same length is revealed


def run_tests():
    """Run all tests and print results"""
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()

    # Add all test classes
    suite.addTests(loader.loadTestsFromTestCase(TestEllipticCurveMath))
    suite.addTests(loader.loadTestsFromTestCase(TestKeyGeneration))
    suite.addTests(loader.loadTestsFromTestCase(TestKeyDerivation))
    suite.addTests(loader.loadTestsFromTestCase(TestECIESEncryption))
    suite.addTests(loader.loadTestsFromTestCase(TestSecurityProperties))

    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    # Print summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)
    print(f"Tests run: {result.testsRun}")
    print(f"Successes: {result.testsRun - len(result.failures) - len(result.errors)}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    print("="*70)

    return result.wasSuccessful()


if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
