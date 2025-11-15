"""
Advanced ECC routes for educational features:
- Point classification
- Diffie-Hellman key exchange
- Discrete logarithm demonstration
- Utility functions
"""

from flask import jsonify, request, session

from db_helpers import ensure_session_id, get_current_user, save_operation_history
from elliptic_curve import EllipticCurve


def register_advanced_routes(app):
    @app.route('/api/classify_points', methods=['POST'])
    def api_classify_points():
        """Classify points as generators, torsion points, etc."""
        try:
            data = request.get_json()
            a = int(data['a'])
            b = int(data['b'])
            p = int(data['p'])

            curve = EllipticCurve(a, b, p)
            classification = curve.classify_points()

            # Format for JSON response
            result = {
                'group_order': classification['group_order'],
                'generators': [
                    {'x': pt[0], 'y': pt[1], 'order': classification['orders'][pt]}
                    for pt in classification['generators']
                ],
                'torsion_points': [
                    {'x': pt[0], 'y': pt[1], 'order': classification['orders'][pt]}
                    for pt in classification['torsion_points']
                ],
                'point_orders': {
                    f"({pt[0]},{pt[1]})": order
                    for pt, order in classification['orders'].items()
                }
            }

            return jsonify({'success': True, **result})
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 400

    @app.route('/api/diffie_hellman', methods=['POST'])
    def api_diffie_hellman():
        """
        Demonstrate Diffie-Hellman key exchange on elliptic curve
        Returns step-by-step process for both Alice and Bob
        """
        try:
            data = request.get_json()
            a = int(data['a'])
            b = int(data['b'])
            p = int(data['p'])

            curve = EllipticCurve(a, b, p)
            points = curve.find_all_points()

            # Select a base point (generator)
            base_point = None
            for pt in points:
                if pt != (None, None):
                    order = curve.get_order(pt)
                    if order > 3:  # Want a point with reasonable order
                        base_point = pt
                        break

            if base_point is None:
                return jsonify({'success': False, 'error': 'No suitable base point found'}), 400

            # Alice's private key (random small number for demo)
            import random
            alice_private = random.randint(2, 10)

            # Bob's private key
            bob_private = random.randint(2, 10)

            # Calculate public keys
            alice_public = curve.scalar_multiply(alice_private, base_point)
            bob_public = curve.scalar_multiply(bob_private, base_point)

            # Calculate shared secrets
            alice_shared = curve.scalar_multiply(alice_private, bob_public)
            bob_shared = curve.scalar_multiply(bob_private, alice_public)

            # Generate step-by-step explanation
            steps = []
            steps.append({
                'step': 1,
                'description': 'Public Parameters',
                'detail': f'Curve: {curve}',
                'data': {
                    'curve': {'a': a, 'b': b, 'p': p},
                    'base_point': {'x': base_point[0], 'y': base_point[1]}
                }
            })

            steps.append({
                'step': 2,
                'description': 'Alice generates private key',
                'detail': f'Alice chooses private key: {alice_private}',
                'data': {'alice_private': alice_private}
            })

            steps.append({
                'step': 3,
                'description': 'Alice computes public key',
                'detail': f'Alice\'s public key = {alice_private} × G',
                'calculation': f'{alice_private} × ({base_point[0]}, {base_point[1]})',
                'data': {
                    'alice_public': {
                        'x': alice_public[0] if alice_public != (None, None) else None,
                        'y': alice_public[1] if alice_public != (None, None) else None
                    }
                }
            })

            steps.append({
                'step': 4,
                'description': 'Bob generates private key',
                'detail': f'Bob chooses private key: {bob_private}',
                'data': {'bob_private': bob_private}
            })

            steps.append({
                'step': 5,
                'description': 'Bob computes public key',
                'detail': f'Bob\'s public key = {bob_private} × G',
                'calculation': f'{bob_private} × ({base_point[0]}, {base_point[1]})',
                'data': {
                    'bob_public': {
                        'x': bob_public[0] if bob_public != (None, None) else None,
                        'y': bob_public[1] if bob_public != (None, None) else None
                    }
                }
            })

            steps.append({
                'step': 6,
                'description': 'Public keys are exchanged',
                'detail': 'Alice and Bob exchange public keys over an insecure channel',
                'data': {}
            })

            steps.append({
                'step': 7,
                'description': 'Alice computes shared secret',
                'detail': f'Alice computes: {alice_private} × Bob\'s public key',
                'calculation': f'{alice_private} × ({bob_public[0]}, {bob_public[1]})',
                'data': {
                    'alice_shared': {
                        'x': alice_shared[0] if alice_shared != (None, None) else None,
                        'y': alice_shared[1] if alice_shared != (None, None) else None
                    }
                }
            })

            steps.append({
                'step': 8,
                'description': 'Bob computes shared secret',
                'detail': f'Bob computes: {bob_private} × Alice\'s public key',
                'calculation': f'{bob_private} × ({alice_public[0]}, {alice_public[1]})',
                'data': {
                    'bob_shared': {
                        'x': bob_shared[0] if bob_shared != (None, None) else None,
                        'y': bob_shared[1] if bob_shared != (None, None) else None
                    }
                }
            })

            steps.append({
                'step': 9,
                'description': 'Shared secrets match!',
                'detail': 'Both Alice and Bob derived the same shared secret',
                'data': {
                    'match': alice_shared == bob_shared,
                    'shared_secret': {
                        'x': alice_shared[0] if alice_shared != (None, None) else None,
                        'y': alice_shared[1] if alice_shared != (None, None) else None
                    }
                }
            })

            user = get_current_user()
            ensure_session_id()
            try:
                save_operation_history(
                    user_id=session.get('user_id'),
                    operation_type='diffie_hellman',
                    curve_type='Fp',
                    parameters={'a': a, 'b': b, 'p': p},
                    result={'success': True},
                    session_id=session.get('session_id'),
                )
            except Exception:
                pass

            return jsonify({
                'success': True,
                'steps': steps,
                'summary': {
                    'base_point': {'x': base_point[0], 'y': base_point[1]},
                    'alice_private': alice_private,
                    'bob_private': bob_private,
                    'shared_secret': {
                        'x': alice_shared[0] if alice_shared != (None, None) else None,
                        'y': alice_shared[1] if alice_shared != (None, None) else None
                    }
                }
            })
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 400

    @app.route('/api/discrete_log_demo', methods=['POST'])
    def api_discrete_log_demo():
        """
        Demonstrate the discrete logarithm problem
        Given P and Q, try to find k such that Q = kP
        """
        try:
            data = request.get_json()
            a = int(data['a'])
            b = int(data['b'])
            p = int(data['p'])
            P = tuple(data['point_p']) if 'point_p' in data else None
            target_k = int(data.get('k', 5))

            curve = EllipticCurve(a, b, p)

            if P is None or P[0] is None:
                # Select a random point
                points = curve.find_all_points()
                for pt in points:
                    if pt != (None, None):
                        P = pt
                        break

            # Compute Q = k*P
            Q = curve.scalar_multiply(target_k, P)

            # Demonstrate brute force solution
            attempts = []
            for k in range(1, min(target_k + 3, 20)):
                result = curve.scalar_multiply(k, P)
                attempts.append({
                    'k': k,
                    'result': {
                        'x': result[0] if result != (None, None) else None,
                        'y': result[1] if result != (None, None) else None
                    },
                    'match': result == Q
                })

                if result == Q and k == target_k:
                    break

            return jsonify({
                'success': True,
                'problem': {
                    'P': {'x': P[0], 'y': P[1]},
                    'Q': {'x': Q[0] if Q != (None, None) else None, 'y': Q[1] if Q != (None, None) else None},
                    'description': f'Find k such that Q = k × P'
                },
                'solution': {
                    'k': target_k,
                    'explanation': f'The discrete logarithm k = {target_k}'
                },
                'attempts': attempts,
                'complexity_note': f'For this small curve, we can brute force. For large curves (256-bit), this is computationally infeasible.'
            })
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 400

    @app.route('/api/generate_test_vector', methods=['POST'])
    def api_generate_test_vector():
        """Generate test vectors for the current curve"""
        try:
            data = request.get_json()
            a = int(data['a'])
            b = int(data['b'])
            p = int(data['p'])

            curve = EllipticCurve(a, b, p)
            test_vector = curve.generate_test_vector()

            return jsonify({'success': True, 'test_vector': test_vector})
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 400

    @app.route('/api/export_curve_params', methods=['POST'])
    def api_export_curve_params():
        """Export curve parameters in various formats"""
        try:
            data = request.get_json()
            a = int(data['a'])
            b = int(data['b'])
            p = int(data['p'])
            export_format = data.get('format', 'json')

            curve = EllipticCurve(a, b, p)
            points = curve.find_all_points()

            params = {
                'curve_equation': str(curve),
                'parameters': {
                    'a': a,
                    'b': b,
                    'p': p
                },
                'discriminant': (4 * a**3 + 27 * b**2) % p,
                'total_points': len(points)
            }

            if export_format == 'python':
                code = f"""# Elliptic Curve Parameters
from elliptic_curve import EllipticCurve

# Curve: {curve}
curve = EllipticCurve(a={a}, b={b}, p={p})

# Total points on curve: {len(points)}
"""
                return jsonify({'success': True, 'data': code, 'format': 'python'})

            elif export_format == 'javascript':
                code = f"""// Elliptic Curve Parameters
// Curve: {curve}
const curveParams = {{
    a: {a},
    b: {b},
    p: {p},
    totalPoints: {len(points)}
}};
"""
                return jsonify({'success': True, 'data': code, 'format': 'javascript'})

            else:  # JSON format
                return jsonify({'success': True, 'data': params, 'format': 'json'})

        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 400

    @app.route('/api/download_points', methods=['POST'])
    def api_download_points():
        """Generate downloadable point list"""
        try:
            data = request.get_json()
            a = int(data['a'])
            b = int(data['b'])
            p = int(data['p'])
            file_format = data.get('format', 'json')

            curve = EllipticCurve(a, b, p)
            points = curve.find_all_points()

            if file_format == 'csv':
                csv_data = "x,y\n"
                for pt in points:
                    if pt == (None, None):
                        csv_data += "O,O\n"
                    else:
                        csv_data += f"{pt[0]},{pt[1]}\n"
                return jsonify({'success': True, 'data': csv_data, 'format': 'csv'})

            else:  # JSON format
                formatted_points = []
                for pt in points:
                    if pt == (None, None):
                        formatted_points.append({'x': None, 'y': None, 'display': 'O'})
                    else:
                        formatted_points.append({'x': pt[0], 'y': pt[1], 'display': f'({pt[0]}, {pt[1]})'})

                return jsonify({
                    'success': True,
                    'data': {
                        'curve': {'a': a, 'b': b, 'p': p},
                        'points': formatted_points,
                        'count': len(points)
                    },
                    'format': 'json'
                })

        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 400
