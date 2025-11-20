"""
Advanced ECC routes for educational features:
- Point classification
- Diffie-Hellman key exchange
- Discrete logarithm demonstration
- Utility functions
"""

from flask import jsonify, request
from .elliptic_curve import EllipticCurve


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

            return jsonify({
                'success': True,
                'steps': steps,
                'summary': {
                    'curve_a': a,
                    'curve_b': b,
                    'curve_p': p,
                    'base_point': {'x': base_point[0], 'y': base_point[1]},
                    'alice_private': alice_private,
                    'alice_public': {
                        'x': alice_public[0] if alice_public != (None, None) else None,
                        'y': alice_public[1] if alice_public != (None, None) else None
                    },
                    'bob_private': bob_private,
                    'bob_public': {
                        'x': bob_public[0] if bob_public != (None, None) else None,
                        'y': bob_public[1] if bob_public != (None, None) else None
                    },
                    'shared_secret': {
                        'x': alice_shared[0] if alice_shared != (None, None) else None,
                        'y': alice_shared[1] if alice_shared != (None, None) else None
                    }
                }
            })
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 400

    @app.route('/api/discrete_log_init', methods=['POST'])
    def api_discrete_log_init():
        """
        Initialize discrete logarithm demo by finding a good base point G
        Returns curve info, base point G, and its order n
        """
        try:
            data = request.get_json()
            a = int(data['a'])
            b = int(data['b'])
            p = int(data['p'])

            curve = EllipticCurve(a, b, p)
            points = curve.find_all_points()

            # Find a good generator (point with large order)
            best_point = None
            best_order = 0

            for pt in points:
                if pt != (None, None):
                    order = curve.get_order(pt)
                    if order > best_order:
                        best_order = order
                        best_point = pt
                    # If we find a generator (order = group size), use it
                    if order == len(points):
                        break

            if best_point is None:
                return jsonify({'success': False, 'error': 'No suitable base point found'}), 400

            return jsonify({
                'success': True,
                'curve': {
                    'a': a,
                    'b': b,
                    'p': p,
                    'equation': f'y² ≡ x³ + {a}x + {b} (mod {p})'
                },
                'base_point': {
                    'x': best_point[0],
                    'y': best_point[1],
                    'display': f'G = ({best_point[0]}, {best_point[1]})'
                },
                'order': best_order,
                'group_size': len(points),
                'is_generator': best_order == len(points)
            })
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 400

    @app.route('/api/discrete_log_compute_public', methods=['POST'])
    def api_discrete_log_compute_public():
        """
        Compute public key Q = k*G for discrete log demo
        """
        try:
            data = request.get_json()
            a = int(data['a'])
            b = int(data['b'])
            p = int(data['p'])
            k = int(data['k'])
            G = data['G']

            if G['x'] is None or G['y'] is None:
                return jsonify({'success': False, 'error': 'Invalid base point'}), 400

            base_point = (G['x'], G['y'])

            curve = EllipticCurve(a, b, p)

            # Verify base point is on curve
            if not curve.is_point_on_curve(base_point[0], base_point[1]):
                return jsonify({'success': False, 'error': 'Base point not on curve'}), 400

            # Compute Q = k*G
            Q = curve.scalar_multiply(k, base_point)

            return jsonify({
                'success': True,
                'k': k,
                'G': {'x': base_point[0], 'y': base_point[1]},
                'Q': {
                    'x': Q[0] if Q != (None, None) else None,
                    'y': Q[1] if Q != (None, None) else None,
                    'display': f'Q = ({Q[0]}, {Q[1]})' if Q != (None, None) else 'Q = O'
                }
            })
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 400

    @app.route('/api/discrete_log_bruteforce', methods=['POST'])
    def api_discrete_log_bruteforce():
        """
        Brute force discrete logarithm: find k such that Q = k*G
        """
        try:
            import math
            import time

            data = request.get_json()
            a = int(data['a'])
            b = int(data['b'])
            p = int(data['p'])
            G_data = data['G']
            Q_data = data['Q']
            max_k = int(data.get('max_k', 2000))
            use_bsgs = data.get('use_bsgs', False)

            G = (G_data['x'], G_data['y'])
            Q = (Q_data['x'], Q_data['y']) if Q_data.get('x') is not None else (None, None)

            curve = EllipticCurve(a, b, p)

            # Get point order
            point_order = curve.get_order(G)
            if point_order <= 0:
                point_order = len(curve.find_all_points())

            start_time = time.time()
            attempts = []
            found_k = None
            algorithm_used = 'brute_force'
            steps_taken = 0

            # Decide algorithm based on max_k
            if max_k <= 100 or not use_bsgs:
                # Brute force approach
                algorithm_used = 'brute_force'
                show_all = max_k <= 50

                for k in range(1, min(max_k + 1, point_order)):
                    result = curve.scalar_multiply(k, G)
                    steps_taken += 1

                    # Show all steps if k is small, or sample if large
                    if show_all or k <= 10 or k >= max_k - 5 or k % (max_k // 10 + 1) == 0:
                        attempts.append({
                            'k': k,
                            'label': f'Try k = {k}',
                            'result': {
                                'x': result[0] if result != (None, None) else None,
                                'y': result[1] if result != (None, None) else None
                            },
                            'match': result == Q
                        })

                    if result == Q:
                        found_k = k
                        break
            else:
                # Baby-step Giant-step algorithm
                algorithm_used = 'baby_step_giant_step'
                m = int(math.ceil(math.sqrt(min(max_k, point_order))))

                # Baby steps: compute j*G for j = 0, 1, ..., m-1
                baby_steps = {}
                current = (None, None)

                for j in range(m):
                    baby_steps[current] = j

                    if j < 5 or j == m - 1:
                        attempts.append({
                            'phase': 'baby_step',
                            'k': j,
                            'label': f'Baby step: {j}*G',
                            'result': {
                                'x': current[0] if current != (None, None) else None,
                                'y': current[1] if current != (None, None) else None
                            },
                            'match': False
                        })

                    if j < m - 1:
                        current = curve.add_points(current, G)

                steps_taken += m

                # Giant steps: compute Q - i*m*G for i = 0, 1, 2, ...
                mG = curve.scalar_multiply(m, G)
                minus_mG = (mG[0], (-mG[1]) % p) if mG != (None, None) else (None, None)

                gamma = Q
                for i in range(m):
                    if gamma in baby_steps:
                        j = baby_steps[gamma]
                        found_k = i * m + j

                        attempts.append({
                            'phase': 'giant_step',
                            'k': found_k,
                            'label': f'Found! k = {found_k}',
                            'result': {
                                'x': gamma[0] if gamma != (None, None) else None,
                                'y': gamma[1] if gamma != (None, None) else None
                            },
                            'match': True
                        })
                        break

                    if i < 5:
                        attempts.append({
                            'phase': 'giant_step',
                            'k': f'{i}*{m}',
                            'label': f'Giant step: Q - {i}*{m}*G',
                            'result': {
                                'x': gamma[0] if gamma != (None, None) else None,
                                'y': gamma[1] if gamma != (None, None) else None
                            },
                            'match': False
                        })

                    gamma = curve.add_points(gamma, minus_mG)
                    steps_taken += 1

            elapsed_time = time.time() - start_time

            # Educational notes
            brute_force_ops = min(max_k, point_order)
            bsgs_ops = 2 * int(math.sqrt(point_order))

            return jsonify({
                'success': True,
                'found': found_k is not None,
                'k': found_k,
                'algorithm': algorithm_used,
                'steps_taken': steps_taken,
                'time_seconds': elapsed_time,
                'attempts': attempts,
                'point_order': point_order,
                'complexity': {
                    'brute_force': brute_force_ops,
                    'bsgs': bsgs_ops,
                    'speedup': brute_force_ops / max(bsgs_ops, 1)
                },
                'explanation': (
                    f"On this tiny curve with order {point_order}, we can brute-force the discrete log. "
                    f"On real curves (256-bit), this is infeasible: even Baby-step Giant-step would need ~2^128 operations!"
                )
            })
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 400

    @app.route('/api/discrete_log_demo', methods=['POST'])
    def api_discrete_log_demo():
        """
        DEPRECATED: Use the new three-endpoint workflow instead
        (kept for backward compatibility)
        """
        try:
            import math
            import time

            data = request.get_json()

            def parse_int_field(name, default=None):
                raw_value = data.get(name, default)
                if raw_value is None:
                    raise ValueError(f"Missing parameter '{name}'")
                try:
                    return int(raw_value)
                except (TypeError, ValueError):
                    raise ValueError(f"Parameter '{name}' must be an integer")

            def parse_bool_field(name):
                raw_value = data.get(name)
                if raw_value is None:
                    return None
                if isinstance(raw_value, str):
                    return raw_value.lower() in ('1', 'true', 'yes', 'on')
                return bool(raw_value)

            a = parse_int_field('a')
            b = parse_int_field('b')
            p = parse_int_field('p')
            requested_k = parse_int_field('k', 5)
            use_bsgs_input = parse_bool_field('use_bsgs')

            target_k = max(1, min(requested_k, 2000))
            use_bsgs = use_bsgs_input if use_bsgs_input is not None else (target_k > 100)

            curve = EllipticCurve(a, b, p)
            points = curve.find_all_points()
            P = next((pt for pt in points if pt != (None, None)), None)
            if P is None or P[0] is None:
                raise ValueError('Unable to pick a valid point on the curve')

            # Get point order for complexity estimation
            point_order = curve.get_order(P)
            if point_order is None or point_order <= 0:
                point_order = len(points)
            point_order = point_order or len(points)

            # Compute Q = k*P
            Q = curve.scalar_multiply(target_k, P)

            start_time = time.time()
            attempts = []
            algorithm_used = 'brute_force'
            steps_taken = 0

            # For small k, use brute force with all steps shown
            if target_k <= 50 and not use_bsgs:
                algorithm_used = 'brute_force'
                for k in range(1, target_k + 1):
                    result = curve.scalar_multiply(k, P)
                    attempts.append({
                        'k': k,
                        'label': f'{k} × P',
                        'result': {
                            'x': result[0] if result != (None, None) else None,
                            'y': result[1] if result != (None, None) else None
                        },
                        'match': result == Q
                    })
                    steps_taken += 1

                    if result == Q:
                        break

            # For medium k, show sampled attempts + final solution
            elif target_k <= 1000 and not use_bsgs:
                algorithm_used = 'brute_force_sampled'
                # Show first 10, some in middle, and last ones
                sample_points = list(range(1, min(11, target_k + 1)))
                if target_k > 20:
                    sample_points.extend([target_k // 4, target_k // 2, 3 * target_k // 4])
                if target_k > 10:
                    sample_points.extend(range(max(target_k - 5, 11), target_k + 1))
                sample_points = sorted(set(sample_points))

                for k in sample_points:
                    result = curve.scalar_multiply(k, P)
                    attempts.append({
                        'k': k,
                        'label': f'{k} × P',
                        'result': {
                            'x': result[0] if result != (None, None) else None,
                            'y': result[1] if result != (None, None) else None
                        },
                        'match': result == Q
                    })
                steps_taken = target_k  # Actual steps in brute force

            # For large k, use Baby-step Giant-step algorithm
            else:
                algorithm_used = 'baby_step_giant_step'
                m = int(math.ceil(math.sqrt(point_order if point_order > 0 else max(p, 3))))

                # Baby step: compute table of jP for j = 0, 1, ..., m-1
                baby_steps = {}
                current = (None, None)  # O (identity)

                for j in range(m):
                    baby_steps[current] = j
                    if j < m - 1:
                        current = curve.add_points(current, P)

                    # Show first few baby steps
                    if j < 5 or j == m - 1:
                        attempts.append({
                            'phase': 'baby_step',
                            'j': j,
                            'label': f'Baby step {j}',
                            'point': {
                                'x': current[0] if current != (None, None) else None,
                                'y': current[1] if current != (None, None) else None
                            },
                            'description': f'Baby step: {j}P'
                        })

                # Giant step: compute mP
                mP = curve.scalar_multiply(m, P)
                minus_mP = (mP[0], (-mP[1]) % p) if mP != (None, None) else (None, None)

                # Search: compute Q - i(mP) for i = 0, 1, 2, ...
                gamma = Q
                found_k = None

                for i in range(m):
                    if gamma in baby_steps:
                        j = baby_steps[gamma]
                        found_k = i * m + j

                        attempts.append({
                            'phase': 'giant_step',
                            'i': i,
                            'j': j,
                            'k': found_k,
                            'label': f'Solution: k = {found_k}',
                            'point': {
                                'x': gamma[0] if gamma != (None, None) else None,
                                'y': gamma[1] if gamma != (None, None) else None
                            },
                            'description': f'Found! Q - {i}({m}P) = {j}P, so k = {i}×{m} + {j} = {found_k}',
                            'match': True
                        })
                        break

                    # Show first few giant steps
                    if i < 5:
                        attempts.append({
                            'phase': 'giant_step',
                            'i': i,
                            'label': f'Giant step {i}',
                            'point': {
                                'x': gamma[0] if gamma != (None, None) else None,
                                'y': gamma[1] if gamma != (None, None) else None
                            },
                            'description': f'Giant step: Q - {i}({m}P)',
                            'match': False
                        })

                    gamma = curve.add_points(gamma, minus_mP)

                steps_taken = m + i + 1  # Baby steps + giant steps

            elapsed_time = time.time() - start_time

            # Calculate complexity comparison
            brute_force_ops = target_k
            bsgs_ops = 2 * int(math.sqrt(point_order if point_order > 0 else p))

            complexity_note = f"""
Algorithm: {algorithm_used.replace('_', ' ').title()}
Target k = {target_k}
Point order = {point_order if point_order > 0 else 'unknown'}

Brute Force: {brute_force_ops:,} operations
Baby-step Giant-step: ~{bsgs_ops:,} operations
Speedup: {brute_force_ops / max(bsgs_ops, 1):.1f}x faster with BSGS

Time taken: {elapsed_time:.4f} seconds
Operations performed: {steps_taken:,}

For 256-bit curves (order ~2^256), even BSGS requires ~2^128 operations, making discrete log computationally infeasible.
            """.strip()

            problem = {
                'P': {'x': P[0], 'y': P[1]},
                'Q': {'x': Q[0] if Q != (None, None) else None, 'y': Q[1] if Q != (None, None) else None},
                'description': f'Find k such that Q = k × P',
                'k_value': target_k
            }
            solution = {
                'k': target_k,
                'requested_k': requested_k,
                'algorithm': algorithm_used,
                'steps_taken': steps_taken,
                'time_seconds': elapsed_time,
                'use_bsgs': use_bsgs
            }

            return jsonify({
                'success': True,
                'problem': problem,
                'solution': solution,
                'attempts': attempts,
                'complexity_note': complexity_note,
                'metadata': {
                    'algorithm': algorithm_used,
                    'point_order': point_order,
                    'brute_force_complexity': brute_force_ops,
                    'bsgs_complexity': bsgs_ops,
                    'speedup_factor': brute_force_ops / max(bsgs_ops, 1)
                }
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
from app.elliptic_curve import EllipticCurve

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
