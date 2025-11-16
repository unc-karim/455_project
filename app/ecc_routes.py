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
            current = (None, None)
            for i in range(1, min(k + 1, 11)):
                current = curve.add_points(current, P)
                if current == (None, None):
                    steps.append(f'{i}P = O')
                else:
                    steps.append(f'{i}P = ({current[0]}, {current[1]})')

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
                'steps': steps
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
            S = (None, None)
            limit = min(abs(k), 10)
            addend = (P[0], P[1]) if not (P[0] is None) else (None, None)
            for i in range(1, limit + 1):
                S = curve.add_points(S, addend)
                if S == (None, None):
                    steps.append(f'{i}P = O')
                    pts.append({'x': None, 'y': None})
                else:
                    steps.append(f'{i}P = ({S[0]}, {S[1]})')
                    pts.append({'x': S[0], 'y': S[1]})

            if result == (None, None):
                result_formatted = {'x': None, 'y': None, 'display': 'O'}
            else:
                result_formatted = {'x': result[0], 'y': result[1], 'display': f'({result[0]}, {result[1]})'}

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
