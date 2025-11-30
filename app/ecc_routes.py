from flask import jsonify, request, session

from .db_helpers import ensure_session_id, get_current_user, save_history, save_operation_history
from .elliptic_curve import EllipticCurve, RealEllipticCurve


def register_ecc_routes(app):
    @app.route('/api/find_points', methods=['POST'])
    def api_find_points():
        try:
            data = request.get_json()
            a = int(data['a'])
            b = int(data['b'])
            p = int(data['p'])

            curve = EllipticCurve(a, b, p)
            points = curve.find_all_points()

            formatted_points = []
            for point in points:
                if point == (None, None):
                    formatted_points.append({'x': None, 'y': None, 'display': 'O'})
                else:
                    formatted_points.append({'x': point[0], 'y': point[1], 'display': f'({point[0]}, {point[1]})'})

            user = get_current_user()
            if user:
                save_history(user['id'], 'Find Points', f'Found {len(points)} points on E_{p}({a}, {b})')
            ensure_session_id()
            try:
                save_operation_history(
                    user_id=session.get('user_id'),
                    operation_type='init_fp',
                    curve_type='Fp',
                    parameters={'a': a, 'b': b, 'p': p},
                    result={'count': len(points)},
                    session_id=session.get('session_id'),
                )
            except Exception:
                pass

            return jsonify({
                'success': True,
                'points': formatted_points,
                'count': len(points)
            })
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 400

    @app.route('/api/add_points', methods=['POST'])
    def api_add_points():
        try:
            data = request.get_json()
            a = int(data['a'])
            b = int(data['b'])
            p = int(data['p'])

            p1 = data['p1']
            p2 = data['p2']

            P = (None, None) if p1['x'] is None else (p1['x'], p1['y'])
            Q = (None, None) if p2['x'] is None else (p2['x'], p2['y'])

            curve = EllipticCurve(a, b, p)
            steps = []

            if P == (None, None):
                steps.append("P is the point at infinity (O)")
                steps.append("By definition: O + Q = Q")
                result = Q
            elif Q == (None, None):
                steps.append("Q is the point at infinity (O)")
                steps.append("By definition: P + O = P")
                result = P
            else:
                x1, y1 = P
                x2, y2 = Q

                steps.append(f"Given: P = ({x1}, {y1}), Q = ({x2}, {y2})")
                steps.append(f"Curve: y² ≡ x³ + {a}x + {b} (mod {p})")

                if x1 == x2:
                    if y1 == y2:
                        steps.append("Case: P = Q (point doubling)")
                        if y1 == 0:
                            steps.append("Special case: y₁ = 0, so 2P = O")
                            result = (None, None)
                        else:
                            numerator = (3 * x1**2 + a) % p
                            denominator = (2 * y1) % p
                            inv = curve.mod_inverse(denominator)
                            slope = (numerator * inv) % p

                            steps.append(f"Calculate slope: m = (3x₁² + a) / (2y₁) mod {p}")
                            steps.append(f"m = (3·{x1}² + {a}) / (2·{y1}) mod {p}")
                            steps.append(f"m = {numerator} / {denominator} mod {p}")
                            steps.append(f"m = {numerator} · {inv} mod {p}")
                            steps.append(f"m = {slope}")

                            x3 = (slope**2 - x1 - x2) % p
                            y3 = (slope * (x1 - x3) - y1) % p

                            steps.append(f"Calculate x₃: x₃ = m² - x₁ - x₂ mod {p}")
                            steps.append(f"x₃ = {slope}² - {x1} - {x2} mod {p}")
                            steps.append(f"x₃ = {x3}")

                            steps.append(f"Calculate y₃: y₃ = m(x₁ - x₃) - y₁ mod {p}")
                            steps.append(f"y₃ = {slope}·({x1} - {x3}) - {y1} mod {p}")
                            steps.append(f"y₃ = {y3}")

                            result = (x3, y3)
                    else:
                        steps.append("Case: P and Q are inverses (x₁ = x₂, y₁ ≠ y₂)")
                        steps.append("Therefore: P + Q = O (point at infinity)")
                        result = (None, None)
                else:
                    steps.append("Case: P ≠ Q (general addition)")
                    numerator = (y2 - y1) % p
                    denominator = (x2 - x1) % p
                    inv = curve.mod_inverse(denominator)
                    slope = (numerator * inv) % p

                    steps.append(f"Calculate slope: m = (y₂ - y₁) / (x₂ - x₁) mod {p}")
                    steps.append(f"m = ({y2} - {y1}) / ({x2} - {x1}) mod {p}")
                    steps.append(f"m = {numerator} / {denominator} mod {p}")
                    steps.append(f"m = {numerator} · {inv} mod {p}")
                    steps.append(f"m = {slope}")

                    x3 = (slope**2 - x1 - x2) % p
                    y3 = (slope * (x1 - x3) - y1) % p

                    steps.append(f"Calculate x₃: x₃ = m² - x₁ - x₂ mod {p}")
                    steps.append(f"x₃ = {slope}² - {x1} - {x2} mod {p}")
                    steps.append(f"x₃ = {x3}")

                    steps.append(f"Calculate y₃: y₃ = m(x₁ - x₃) - y₁ mod {p}")
                    steps.append(f"y₃ = {slope}·({x1} - {x3}) - {y1} mod {p}")
                    steps.append(f"y₃ = {y3}")

                    result = (x3, y3)

            if result == (None, None):
                result_formatted = {'x': None, 'y': None, 'display': 'O'}
            else:
                result_formatted = {'x': result[0], 'y': result[1], 'display': f'({result[0]}, {result[1]})'}

            user = get_current_user()
            if user:
                save_history(user['id'], 'Add Points', f'{p1["display"]} + {p2["display"]} = {result_formatted["display"]}')
            ensure_session_id()
            try:
                save_operation_history(
                    user_id=session.get('user_id'),
                    operation_type='add_fp',
                    curve_type='Fp',
                    parameters={'a': a, 'b': b, 'p': p, 'P': p1, 'Q': p2},
                    result={'R': result_formatted},
                    session_id=session.get('session_id'),
                )
            except Exception:
                pass

            return jsonify({
                'success': True,
                'result': result_formatted,
                'steps': steps
            })
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 400

    @app.route('/api/scalar_multiply', methods=['POST'])
    def api_scalar_multiply():
        try:
            data = request.get_json()
            a = int(data['a'])
            b = int(data['b'])
            p = int(data['p'])
            k = int(data['k'])

            point_data = data['point']
            P = (None, None) if point_data['x'] is None else (point_data['x'], point_data['y'])

            curve = EllipticCurve(a, b, p)
            result = curve.scalar_multiply(k, P)

            steps = []
            pts = []

            # Enhanced explanation of the double-and-add algorithm
            if k == 0:
                steps.append("Computing 0·P = O (point at infinity)")
                steps.append("Any point multiplied by 0 equals the point at infinity")
            elif k < 0:
                steps.append(f"Computing {k}·P (negative scalar)")
                steps.append(f"This is equivalent to {-k}·(-P), where -P = (x, -{point_data['y']} mod {p})")
                steps.append(f"Proceeding with {-k}·(-P)")
            else:
                # Show binary representation
                binary_k = bin(k)[2:]  # Remove '0b' prefix
                steps.append(f"Step 0: Decompose scalar using double-and-add algorithm")
                steps.append(f"k = {k} (decimal) = {binary_k} (binary)")
                steps.append(f"Algorithm processes bits from RIGHT to LEFT (least significant to most significant)")
                steps.append("")

                # Show the algorithm structure
                steps.append(f"Initialize:")
                steps.append(f"  • Result = O (point at infinity)")
                steps.append(f"  • Addend = P = ({point_data['x']}, {point_data['y']})")
                steps.append(f"  • k = {k}")
                steps.append("")

                # Simulate double-and-add to show steps and collect intermediate results
                result_algo = (None, None)
                addend = P if P != (None, None) else (None, None)
                k_temp = k
                bit_position = 0
                pts_collected = []

                steps.append("Executing double-and-add algorithm:")
                while k_temp > 0:
                    bit = k_temp & 1
                    power = 2**bit_position
                    steps.append(f"  Bit {bit_position} (value = {bit}):")

                    if bit == 1:
                        # Collect the addend point being used
                        if addend != (None, None):
                            # Only add if not already in the list (avoid duplicates)
                            if not any(p['x'] == addend[0] and p['y'] == addend[1] for p in pts_collected):
                                pts_collected.append({'x': addend[0], 'y': addend[1]})

                        # Show addition step
                        if result_algo == (None, None):
                            steps.append(f"    → Result is O, initialize to {power}P")
                            result_algo = addend
                            if addend != (None, None):
                                steps.append(f"    → Result = ({addend[0]}, {addend[1]})")
                        else:
                            sum_point = curve.add_points(result_algo, addend)
                            steps.append(f"    → Adding {power}P to Result")
                            if result_algo != (None, None) and addend != (None, None):
                                steps.append(f"    → Result = ({result_algo[0]}, {result_algo[1]}) + ({addend[0]}, {addend[1]})")
                            if sum_point != (None, None):
                                steps.append(f"    → Result = ({sum_point[0]}, {sum_point[1]})")
                                # Collect the result point (if not already collected as addend)
                                if not any(p['x'] == sum_point[0] and p['y'] == sum_point[1] for p in pts_collected):
                                    pts_collected.append({'x': sum_point[0], 'y': sum_point[1]})
                            else:
                                steps.append(f"    → Result = O")
                            result_algo = sum_point
                    else:
                        steps.append(f"    → Bit is 0, skip {power}P (do not add)")

                    # Double the addend
                    if k_temp > 1:  # Only if there are more bits
                        next_power = 2**(bit_position+1)
                        doubled = curve.add_points(addend, addend) if addend != (None, None) else (None, None)
                        steps.append(f"    → Prepare next bit: Double {power}P to get {next_power}P")
                        if addend != (None, None):
                            if doubled != (None, None):
                                steps.append(f"    → Addend = 2·({addend[0]}, {addend[1]}) = ({doubled[0]}, {doubled[1]})")
                            else:
                                steps.append(f"    → Addend = O")
                        addend = doubled

                    k_temp >>= 1
                    bit_position += 1
                    steps.append("")

                steps.append("Summary:")
                steps.append(f"Total bit positions: {bit_position} (O(log k))")
                steps.append(f"Naive method would use: {k} additions (O(k))")
                steps.append(f"Efficiency gain: {k / bit_position:.1f}x faster" if bit_position > 0 else "")

                # Use collected intermediate points for visualization
                pts = pts_collected

            if result == (None, None):
                result_formatted = {'x': None, 'y': None, 'display': 'O'}
            else:
                result_formatted = {'x': result[0], 'y': result[1], 'display': f'({result[0]}, {result[1]})'}

            user = get_current_user()
            if user:
                save_history(user['id'], 'Scalar Multiply', f'{k} × {point_data["display"]} = {result_formatted["display"]}')
            ensure_session_id()
            try:
                save_operation_history(
                    user_id=session.get('user_id'),
                    operation_type='multiply_fp',
                    curve_type='Fp',
                    parameters={'a': a, 'b': b, 'p': p, 'k': k, 'P': point_data},
                    result={'R': result_formatted, 'steps': steps},
                    session_id=session.get('session_id'),
                )
            except Exception:
                pass

            return jsonify({
                'success': True,
                'result': result_formatted,
                'steps': steps,
                'points': pts
            })
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 400

    @app.route('/api/init_real_curve', methods=['POST'])
    def api_init_real_curve():
        try:
            data = request.get_json() or {}
            a = float(data.get('a'))
            b = float(data.get('b'))

            curve = RealEllipticCurve(a, b)
            rng = {
                'x_min': -10.0, 'x_max': 10.0,
                'y_min': -10.0, 'y_max': 10.0,
            }

            user = get_current_user()
            if user:
                save_history(user['id'], 'Init Real Curve', f'E(a={a}, b={b}) over R')
            ensure_session_id()
            try:
                save_operation_history(
                    user_id=session.get('user_id'),
                    operation_type='init_real',
                    curve_type='R',
                    parameters={'a': a, 'b': b},
                    result={'range': rng},
                    session_id=session.get('session_id'),
                )
            except Exception:
                pass

            return jsonify({'success': True, 'message': 'Real curve initialized', 'range': rng})
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 400

    @app.route('/api/add_points_real', methods=['POST'])
    def api_add_points_real():
        try:
            data = request.get_json() or {}
            a = float(data.get('a'))
            b = float(data.get('b'))
            p1 = data.get('p1') or {}
            p2 = data.get('p2') or {}

            P = (None, None) if p1.get('x') is None else (float(p1['x']), float(p1['y']))
            Q = (None, None) if p2.get('x') is None else (float(p2['x']), float(p2['y']))
            curve = RealEllipticCurve(a, b)

            steps = []
            tol = 1e-9

            if P == (None, None):
                steps.append("P is the point at infinity (O)")
                steps.append("By definition: O + Q = Q")
                R = Q
            elif Q == (None, None):
                steps.append("Q is the point at infinity (O)")
                steps.append("By definition: P + O = P")
                R = P
            else:
                x1, y1 = P
                x2, y2 = Q

                steps.append(f"Given: P = ({x1:.6g}, {y1:.6g}), Q = ({x2:.6g}, {y2:.6g})")
                steps.append(f"Curve: y² = x³ + {a}x + {b}")

                if abs(x1 - x2) <= tol and abs(y1 + y2) <= tol:
                    steps.append("Case: P and Q are inverses (vertical line)")
                    steps.append("Therefore: P + Q = O (point at infinity)")
                    R = (None, None)
                elif abs(x1 - x2) <= tol and abs(y1 - y2) <= tol:
                    steps.append("Case: P = Q (point doubling)")
                    if abs(y1) <= tol:
                        steps.append("Special case: y₁ = 0, so 2P = O")
                        R = (None, None)
                    else:
                        slope = (3 * x1**2 + a) / (2 * y1)
                        steps.append(f"Calculate slope: m = (3x₁² + a) / (2y₁)")
                        steps.append(f"m = (3·{x1:.6g}² + {a}) / (2·{y1:.6g})")
                        steps.append(f"m = {slope:.6g}")

                        x3 = slope**2 - x1 - x2
                        y3 = slope * (x1 - x3) - y1

                        steps.append(f"Calculate x₃: x₃ = m² - x₁ - x₂")
                        steps.append(f"x₃ = {slope:.6g}² - {x1:.6g} - {x2:.6g}")
                        steps.append(f"x₃ = {x3:.6g}")

                        steps.append(f"Calculate y₃: y₃ = m(x₁ - x₃) - y₁")
                        steps.append(f"y₃ = {slope:.6g}·({x1:.6g} - {x3:.6g}) - {y1:.6g}")
                        steps.append(f"y₃ = {y3:.6g}")

                        R = (x3, y3)
                else:
                    steps.append("Case: P ≠ Q (general addition)")
                    slope = (y2 - y1) / (x2 - x1)

                    steps.append(f"Calculate slope: m = (y₂ - y₁) / (x₂ - x₁)")
                    steps.append(f"m = ({y2:.6g} - {y1:.6g}) / ({x2:.6g} - {x1:.6g})")
                    steps.append(f"m = {slope:.6g}")

                    x3 = slope**2 - x1 - x2
                    y3 = slope * (x1 - x3) - y1

                    steps.append(f"Calculate x₃: x₃ = m² - x₁ - x₂")
                    steps.append(f"x₃ = {slope:.6g}² - {x1:.6g} - {x2:.6g}")
                    steps.append(f"x₃ = {x3:.6g}")

                    steps.append(f"Calculate y₃: y₃ = m(x₁ - x₃) - y₁")
                    steps.append(f"y₃ = {slope:.6g}·({x1:.6g} - {x3:.6g}) - {y1:.6g}")
                    steps.append(f"y₃ = {y3:.6g}")

                    R = (x3, y3)

            if R == (None, None):
                result_formatted = {'x': None, 'y': None, 'display': 'O'}
            else:
                result_formatted = {'x': R[0], 'y': R[1], 'display': f'({R[0]}, {R[1]})'}

            user = get_current_user()
            if user:
                def fmt(pt):
                    if not pt or pt.get('x') is None:
                        return 'O'
                    return f"({pt['x']}, {pt['y']})"
                save_history(user['id'], 'Add Points (R)', f"{fmt(p1)} + {fmt(p2)} = {result_formatted['display']}")
            ensure_session_id()
            try:
                save_operation_history(
                    user_id=session.get('user_id'),
                    operation_type='add_real',
                    curve_type='R',
                    parameters={'a': a, 'b': b, 'P': p1, 'Q': p2},
                    result={'R': result_formatted},
                    session_id=session.get('session_id'),
                )
            except Exception:
                pass

            return jsonify({'success': True, 'result': result_formatted, 'steps': steps})
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 400

    @app.route('/api/scalar_multiply_real', methods=['POST'])
    def api_scalar_multiply_real():
        try:
            data = request.get_json() or {}
            a = float(data.get('a'))
            b = float(data.get('b'))
            k = int(data.get('k'))
            point_data = data.get('point') or {}
            P = (None, None) if point_data.get('x') is None else (float(point_data['x']), float(point_data['y']))

            curve = RealEllipticCurve(a, b)
            result = curve.scalar_multiply(k, P)

            steps = []
            pts = []

            # Enhanced explanation of the double-and-add algorithm for real numbers
            if k == 0:
                steps.append("Computing 0·P = O (point at infinity)")
                steps.append("Any point multiplied by 0 equals the point at infinity")
            elif k < 0:
                steps.append(f"Computing {k}·P (negative scalar)")
                steps.append(f"This is equivalent to {-k}·(-P), where -P = ({point_data.get('x', 'x')}, {-point_data.get('y', 'y')})")
                steps.append(f"Proceeding with {-k}·(-P)")
            else:
                # Show binary representation
                binary_k = bin(k)[2:]  # Remove '0b' prefix
                px = point_data.get('x') if point_data.get('x') is not None else None
                py = point_data.get('y') if point_data.get('y') is not None else None

                steps.append(f"Given: P = ({px:.6g}, {py:.6g}), k = {k}")
                steps.append(f"Curve: y² = x³ + {a}x + {b}")
                steps.append(f"Method: Double-and-add algorithm")
                steps.append(f"k = {k} (decimal) = {binary_k} (binary)")
                steps.append("")
                steps.append("Algorithm: Process each bit of k from right to left")
                steps.append("• If bit = 1: Add current power of P to result")
                steps.append("• If bit = 0: Skip addition")
                steps.append("• After each bit: Double the current power of P")
                steps.append("")

                # Simulate double-and-add to show steps and collect intermediate results
                result_algo = (None, None)
                addend = P if P != (None, None) else (None, None)
                k_temp = k
                bit_position = 0
                pts_collected = []

                steps.append("Execution:")
                while k_temp > 0:
                    bit = k_temp & 1
                    power = 2**bit_position

                    steps.append(f"Bit {bit_position} (value = {bit}):")

                    if bit == 1:
                        # Collect the addend point being used
                        if addend != (None, None):
                            # Only add if not already in the list (avoid duplicates)
                            if not any(p['x'] == addend[0] and p['y'] == addend[1] for p in pts_collected):
                                pts_collected.append({'x': addend[0], 'y': addend[1]})

                        # Show addition step
                        if result_algo == (None, None):
                            steps.append(f"  Bit is 1: Initialize Result = {power}P")
                            steps.append(f"  {power}P = ({addend[0]:.6g}, {addend[1]:.6g})")
                            result_algo = addend
                        else:
                            sum_point = curve.add_points(result_algo, addend)
                            steps.append(f"  Bit is 1: Add {power}P to Result")
                            steps.append(f"  Result = ({result_algo[0]:.6g}, {result_algo[1]:.6g}) + ({addend[0]:.6g}, {addend[1]:.6g})")
                            if sum_point != (None, None):
                                steps.append(f"  Result = ({sum_point[0]:.6g}, {sum_point[1]:.6g})")
                                # Collect the result point (if not already collected as addend)
                                if not any(p['x'] == sum_point[0] and p['y'] == sum_point[1] for p in pts_collected):
                                    pts_collected.append({'x': sum_point[0], 'y': sum_point[1]})
                            else:
                                steps.append(f"  Result = O (point at infinity)")
                            result_algo = sum_point
                    else:
                        steps.append(f"  Bit is 0: Skip {power}P (do not add)")

                    # Double the addend for next bit
                    if k_temp > 1:  # Only if there are more bits
                        next_power = 2**(bit_position+1)
                        doubled = curve.add_points(addend, addend) if addend != (None, None) else (None, None)
                        steps.append(f"  Prepare next bit: Double {power}P to get {next_power}P")
                        if doubled != (None, None):
                            steps.append(f"  {next_power}P = 2·({addend[0]:.6g}, {addend[1]:.6g}) = ({doubled[0]:.6g}, {doubled[1]:.6g})")
                        else:
                            steps.append(f"  {next_power}P = O")
                        addend = doubled

                    k_temp >>= 1
                    bit_position += 1
                    steps.append("")

                steps.append("Summary:")
                steps.append(f"Total operations: {bit_position} (O(log k))")
                steps.append(f"Naive method would use: {k} additions (O(k))")
                steps.append(f"Efficiency gain: {k / bit_position:.1f}x faster")

                # Collect points for visualization - use intermediate results
                pts = pts_collected

            if result == (None, None):
                result_formatted = {'x': None, 'y': None, 'display': 'O'}
            else:
                result_formatted = {'x': result[0], 'y': result[1], 'display': f'({result[0]:.6g}, {result[1]:.6g})'}

            user = get_current_user()
            if user:
                dispP = 'O' if point_data.get('x') is None else f"({point_data['x']}, {point_data['y']})"
                save_history(user['id'], 'Scalar Multiply (R)', f"{k} × {dispP} = {result_formatted['display']}")
            ensure_session_id()
            try:
                save_operation_history(
                    user_id=session.get('user_id'),
                    operation_type='multiply_real',
                    curve_type='R',
                    parameters={'a': a, 'b': b, 'k': k, 'P': point_data},
                    result={'R': result_formatted, 'steps': steps},
                    session_id=session.get('session_id'),
                )
            except Exception:
                pass

            return jsonify({'success': True, 'result': result_formatted, 'steps': steps, 'points': pts})
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 400
