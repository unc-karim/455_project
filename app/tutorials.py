"""
Structured Tutorials for Elliptic Curve Operations
Provides guided step-by-step walkthroughs with explanations
"""

from flask import jsonify, request


def register_tutorial_routes(app):
    @app.route('/api/get_tutorial', methods=['POST'])
    def api_get_tutorial():
        """Get a structured tutorial for a specific operation"""
        try:
            data = request.get_json()
            tutorial_type = data.get('type', 'initialization')

            tutorials = {
                'initialization': get_initialization_tutorial(),
                'point_addition': get_point_addition_tutorial(),
                'scalar_multiplication': get_scalar_multiplication_tutorial(),
                'discrete_log': get_discrete_log_tutorial(),
                'diffie_hellman': get_diffie_hellman_tutorial()
            }

            tutorial = tutorials.get(tutorial_type)
            if tutorial:
                return jsonify({'success': True, 'tutorial': tutorial})
            else:
                return jsonify({'success': False, 'error': 'Tutorial not found'}), 404

        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 400


def get_initialization_tutorial():
    """Tutorial for curve initialization"""
    return {
        'title': 'Initializing an Elliptic Curve',
        'description': 'Learn how to set up an elliptic curve over a finite field',
        'estimated_time': '3 minutes',
        'steps': [
            {
                'step': 1,
                'title': 'Understanding the Curve Equation',
                'content': 'An elliptic curve over a finite field F_p has the form:\n\ny² ≡ x³ + ax + b (mod p)\n\nWhere:\n• a and b are coefficients\n• p is a prime number (the field order)\n• All arithmetic is done modulo p',
                'action': 'Read and understand the equation',
                'interactive': False
            },
            {
                'step': 2,
                'title': 'Choose a Prime p',
                'content': 'The prime p defines the finite field. For learning:\n\n• Small primes (23-127): Easy to visualize\n• Medium primes (97-1000): Good for demos\n• Large primes (>1000): More realistic\n\nLet\'s start with p = 97',
                'action': 'Set p = 97',
                'interactive': True,
                'input_field': 'paramP',
                'expected_value': 97
            },
            {
                'step': 3,
                'title': 'Choose Coefficients a and b',
                'content': 'The coefficients determine the curve\'s shape.\n\nConstraint: 4a³ + 27b² ≠ 0 (mod p)\n(This ensures the curve is non-singular)\n\nLet\'s use a = 2, b = 3',
                'action': 'Set a = 2, b = 3',
                'interactive': True,
                'input_fields': ['paramA', 'paramB'],
                'expected_values': [2, 3]
            },
            {
                'step': 4,
                'title': 'Find All Points',
                'content': 'Now we find all points (x, y) that satisfy:\n\ny² ≡ x³ + 2x + 3 (mod 97)\n\nThe algorithm:\n1. For each x from 0 to p-1\n2. Compute y² = x³ + ax + b (mod p)\n3. Find y values where y² matches (using square roots)\n4. Add point at infinity O',
                'action': 'Click "Find All Points on Curve"',
                'interactive': True,
                'button': 'findAllPoints'
            },
            {
                'step': 5,
                'title': 'Understanding the Result',
                'content': 'You should see approximately p points (by Hasse\'s theorem).\n\nFor E_97(2,3), you\'ll find exactly 100 points:\n• 99 finite points (x, y pairs)\n• 1 point at infinity O\n\nEach point forms part of the group structure.',
                'action': 'Review the points found',
                'interactive': False
            },
            {
                'step': 6,
                'title': 'Visualizing the Curve',
                'content': 'The visualization shows points on a grid:\n\n• X-axis: x coordinates (0 to p-1)\n• Y-axis: y coordinates (0 to p-1)\n• Each dot represents a valid curve point\n\nNotice the symmetric pattern!',
                'action': 'Examine the visualization',
                'interactive': False
            }
        ],
        'quiz': [
            {
                'question': 'What happens if 4a³ + 27b² ≡ 0 (mod p)?',
                'options': [
                    'The curve has no points',
                    'The curve is singular (invalid)',
                    'The curve has infinite points',
                    'Nothing special'
                ],
                'correct': 1,
                'explanation': 'When the discriminant is zero, the curve has singularities (cusps or self-intersections), making it unsuitable for cryptography.'
            },
            {
                'question': 'What is the point at infinity O?',
                'options': [
                    'A point with very large coordinates',
                    'The identity element of the group',
                    'An error in the calculation',
                    'The first point found'
                ],
                'correct': 1,
                'explanation': 'The point at infinity O serves as the identity element: P + O = P for any point P.'
            }
        ]
    }


def get_point_addition_tutorial():
    """Tutorial for point addition"""
    return {
        'title': 'Point Addition on Elliptic Curves',
        'description': 'Learn the geometric and algebraic rules for adding points',
        'estimated_time': '5 minutes',
        'steps': [
            {
                'step': 1,
                'title': 'The Group Law',
                'content': 'Points on an elliptic curve form an abelian group under addition.\n\nKey properties:\n• P + O = P (identity)\n• P + Q = Q + P (commutative)\n• (P + Q) + R = P + (Q + R) (associative)\n• For each P, there exists -P such that P + (-P) = O',
                'action': 'Understand the group properties',
                'interactive': False
            },
            {
                'step': 2,
                'title': 'Geometric Interpretation',
                'content': 'To add P + Q:\n\n1. Draw a line through P and Q\n2. Find where it intersects the curve (point R\')\n3. Reflect R\' across the x-axis to get R\n4. R = P + Q\n\nSpecial case: If P = Q, use the tangent line.',
                'action': 'Visualize the process',
                'interactive': False
            },
            {
                'step': 3,
                'title': 'Select Two Points',
                'content': 'Let\'s practice! First, make sure you have initialized a curve.\n\nThen select two points P and Q from the dropdown menus.\n\nTry choosing:\nP = (3, 6)\nQ = (5, 38)',
                'action': 'Select points from dropdowns',
                'interactive': True,
                'input_fields': ['addPoint1', 'addPoint2']
            },
            {
                'step': 4,
                'title': 'Computing the Slope',
                'content': 'For P ≠ Q, the slope is:\n\nm = (y₂ - y₁) / (x₂ - x₁) mod p\n\nFor P = Q (point doubling):\n\nm = (3x₁² + a) / (2y₁) mod p\n\nThe division is done using modular inverse.',
                'action': 'Click "Add Points P + Q"',
                'interactive': True,
                'button': 'addPoints'
            },
            {
                'step': 5,
                'title': 'Understanding the Result',
                'content': 'The result shows:\n\n1. Which case applies (general addition or point doubling)\n2. The slope calculation\n3. The resulting point coordinates\n4. Step-by-step arithmetic\n\nThe visualization highlights P (blue), Q (orange), and R (green).',
                'action': 'Review the step-by-step solution',
                'interactive': False
            },
            {
                'step': 6,
                'title': 'Special Cases',
                'content': 'Important edge cases:\n\n• P + O = P (identity)\n• P + (-P) = O (inverses)\n• O + O = O\n\nTry these special cases to see how they work!',
                'action': 'Experiment with special cases',
                'interactive': False
            }
        ],
        'quiz': [
            {
                'question': 'What is the result of P + (-P)?',
                'options': ['2P', 'O', 'P', '-P'],
                'correct': 1,
                'explanation': 'Adding a point to its inverse always gives the identity element O.'
            },
            {
                'question': 'Why do we reflect across the x-axis?',
                'options': [
                    'For visual appeal',
                    'Because of the curve equation symmetry',
                    'To make computation easier',
                    'It\'s an arbitrary choice'
                ],
                'correct': 1,
                'explanation': 'The curve equation y² = x³ + ax + b is symmetric about the x-axis, so if (x,y) is on the curve, so is (x,-y).'
            }
        ]
    }


def get_scalar_multiplication_tutorial():
    """Tutorial for scalar multiplication"""
    return {
        'title': 'Scalar Multiplication',
        'description': 'Learn to efficiently compute k × P using the double-and-add algorithm',
        'estimated_time': '4 minutes',
        'steps': [
            {
                'step': 1,
                'title': 'What is Scalar Multiplication?',
                'content': 'Scalar multiplication means adding a point P to itself k times:\n\nk × P = P + P + P + ... + P (k times)\n\nExamples:\n• 3P = P + P + P\n• 5P = P + P + P + P + P\n• 0P = O (by definition)',
                'action': 'Understand the concept',
                'interactive': False
            },
            {
                'step': 2,
                'title': 'The Naive Approach',
                'content': 'We could compute kP by adding P repeatedly:\n\nResult = O\nFor i from 1 to k:\n    Result = Result + P\n\nThis takes k-1 additions. For k = 1,000,000, that\'s too slow!\n\nWe need a better method...',
                'action': 'See why we need optimization',
                'interactive': False
            },
            {
                'step': 3,
                'title': 'Double-and-Add Algorithm',
                'content': 'Smart approach using binary representation:\n\nExample: 11P where 11 = 1011₂\n\n1011₂ = 8 + 2 + 1\nSo: 11P = 8P + 2P + P\n\nWe can compute this in log₂(k) steps by doubling!\n\nThis is exponentially faster.',
                'action': 'Understand the algorithm',
                'interactive': False
            },
            {
                'step': 4,
                'title': 'Try It Yourself',
                'content': 'Let\'s compute 7P for some point P.\n\n1. Select a point P from the dropdown\n2. Enter k = 7\n3. Click "Calculate k × P"\n\nWatch how the algorithm proceeds!',
                'action': 'Select point and enter k = 7',
                'interactive': True,
                'input_fields': ['scalarPoint', 'scalarK'],
                'button': 'scalarMultiply'
            },
            {
                'step': 5,
                'title': 'Understanding the Steps',
                'content': 'The result shows:\n\n• 1P = P\n• 2P = P + P\n• 3P = 2P + P\n• ...\n• 7P = final result\n\nNotice how each step builds on the previous one.',
                'action': 'Review the progression',
                'interactive': False
            },
            {
                'step': 6,
                'title': 'Cryptographic Importance',
                'content': 'Scalar multiplication is the foundation of ECC:\n\n• Public key = k × G (G is generator)\n• k is the private key\n• Computing k from (k×G) is the hard problem!\n\nThis one-way property enables secure cryptography.',
                'action': 'Understand the security foundation',
                'interactive': False
            }
        ],
        'quiz': [
            {
                'question': 'How many point additions does double-and-add need for k = 1024?',
                'options': ['1024', '512', 'About 10', '2048'],
                'correct': 2,
                'explanation': 'For k = 2^10 = 1024, we need only about log₂(1024) = 10 operations using double-and-add!'
            },
            {
                'question': 'What is 0 × P?',
                'options': ['P', '0', 'O', 'Undefined'],
                'correct': 2,
                'explanation': '0 × P = O (the point at infinity), which is the identity element.'
            }
        ]
    }


def get_discrete_log_tutorial():
    """Tutorial for discrete logarithm problem"""
    return {
        'title': 'The Discrete Logarithm Problem',
        'description': 'Understand the hard problem that makes ECC secure',
        'estimated_time': '3 minutes',
        'steps': [
            {
                'step': 1,
                'title': 'The Problem Statement',
                'content': 'Given:\n• A point P on the curve\n• Another point Q on the curve\n• Q = k × P for some unknown k\n\nFind: The value of k\n\nThis is called the Discrete Logarithm Problem (DLP).',
                'action': 'Understand the problem',
                'interactive': False
            },
            {
                'step': 2,
                'title': 'Why It\'s Hard',
                'content': 'Computing Q = k × P is fast (O(log k))\nBut finding k given P and Q is hard!\n\nBest known algorithm: O(√n) where n is group order\n\nFor 256-bit curves: 2^128 operations ≈ impossible',
                'action': 'Understand the asymmetry',
                'interactive': False
            },
            {
                'step': 3,
                'title': 'Brute Force Approach',
                'content': 'The naive solution: try every k\n\nFor k = 1, 2, 3, ... compute k × P\nStop when k × P = Q\n\nThis works for small k, but...',
                'action': 'See the limitation',
                'interactive': False
            }
        ]
    }


def get_diffie_hellman_tutorial():
    """Tutorial for Diffie-Hellman key exchange"""
    return {
        'title': 'Elliptic Curve Diffie-Hellman',
        'description': 'Learn how two parties establish a shared secret',
        'estimated_time': '5 minutes',
        'steps': [
            {
                'step': 1,
                'title': 'The Goal',
                'content': 'Alice and Bob want to agree on a shared secret over an insecure channel.\n\nThey can:\n• Exchange messages publicly\n• But eavesdroppers can see everything\n\nHow can they establish a secret key?',
                'action': 'Understand the challenge',
                'interactive': False
            },
            {
                'step': 2,
                'title': 'Public Setup',
                'content': 'Alice and Bob agree on public parameters:\n\n• An elliptic curve E\n• A base point G (generator)\n\nThese are known to everyone (including attackers).',
                'action': 'Note the public information',
                'interactive': False
            },
            {
                'step': 3,
                'title': 'Private Keys',
                'content': 'Each person chooses a secret number:\n\n• Alice picks a (her private key)\n• Bob picks b (his private key)\n\nThese are NEVER shared with anyone!',
                'action': 'Understand privacy',
                'interactive': False
            }
        ]
    }
