"""
Elliptic Curve Cryptography - Core Implementation
Project Code Base

This module implements elliptic curve operations over finite fields:
1. Find all points on curve E_p(a,b)
2. Add two points on the curve
3. Multiply a point by a scalar
"""

class EllipticCurve:
    """
    Elliptic Curve E_p(a, b): y^2 = x^3 + ax + b (mod p)
    """
    
    def __init__(self, a, b, p):
        """
        Initialize elliptic curve with parameters a, b, and prime p
        
        Args:
            a: Coefficient of x in the curve equation
            b: Constant term in the curve equation
            p: Prime modulus for finite field
        
        Raises:
            ValueError: If parameters are invalid
        """
        # Validate inputs
        if not isinstance(a, int) or not isinstance(b, int) or not isinstance(p, int):
            raise ValueError("Parameters a, b, and p must be integers")
        
        if p < 2:
            raise ValueError("Modulus p must be at least 2")

        # Ensure p is prime (field F_p requires prime modulus)
        def _is_prime(n: int) -> bool:
            # Quick checks for small numbers
            if n < 2:
                return False
            small_primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37]
            for sp in small_primes:
                if n == sp:
                    return True
                if n % sp == 0:
                    return False
            # Miller-Rabin primality test (deterministic for 64-bit)
            # write n-1 = d * 2^s with d odd
            d = n - 1
            s = 0
            while d % 2 == 0:
                d //= 2
                s += 1

            def _check(a: int, d: int, n: int, s: int) -> bool:
                x = pow(a, d, n)
                if x == 1 or x == n - 1:
                    return True
                for _ in range(s - 1):
                    x = (x * x) % n
                    if x == n - 1:
                        return True
                return False

            # Deterministic bases for n < 2^64
            for a in (2, 3, 5, 7, 11, 13, 17):
                if not _check(a % n, d, n, s):
                    return False
            return True

        if not _is_prime(p):
            raise ValueError("Modulus p must be prime for F_p operations")
        
        self.a = a % p
        self.b = b % p
        self.p = p
        
        # Verify curve is valid (discriminant != 0)
        discriminant = (4 * self.a**3 + 27 * self.b**2) % p
        if discriminant == 0:
            raise ValueError("Invalid curve: discriminant is zero")
    
    def is_point_on_curve(self, x, y):
        """
        Check if point (x, y) satisfies the curve equation
        
        Args:
            x: x-coordinate (None for point at infinity)
            y: y-coordinate (None for point at infinity)
            
        Returns:
            bool: True if point is on curve, False otherwise
        """
        if x is None and y is None:  # Point at infinity
            return True
        
        if x is None or y is None:
            return False
        
        left = (y**2) % self.p
        right = (x**3 + self.a * x + self.b) % self.p
        return left == right
    
    def tonelli_shanks(self, n):
        """
        Find square roots of n modulo p using Tonelli-Shanks algorithm
        
        Args:
            n: Number to find square root of (mod p)
            
        Returns:
            list: All square roots (empty if none exist, 2 roots or 1 if n=0)
        """
        n = n % self.p
        
        if n == 0:
            return [0]
        
        # Check if n is a quadratic residue using Legendre symbol
        if pow(n, (self.p - 1) // 2, self.p) != 1:
            return []
        
        # Special case: p ≡ 3 (mod 4)
        if self.p % 4 == 3:
            r = pow(n, (self.p + 1) // 4, self.p)
            return [r, self.p - r] if r != self.p - r else [r]
        
        # General Tonelli-Shanks algorithm
        # Write p - 1 = Q * 2^S with Q odd
        Q = self.p - 1
        S = 0
        while Q % 2 == 0:
            Q //= 2
            S += 1
        
        # Find a quadratic non-residue z
        z = 2
        while pow(z, (self.p - 1) // 2, self.p) != self.p - 1:
            z += 1
        
        M = S
        c = pow(z, Q, self.p)
        t = pow(n, Q, self.p)
        R = pow(n, (Q + 1) // 2, self.p)
        
        while True:
            if t == 0:
                return [0]
            if t == 1:
                return [R, self.p - R] if R != self.p - R else [R]
            
            # Find lowest i such that t^(2^i) = 1
            i = 1
            temp = (t * t) % self.p
            while temp != 1 and i < M:
                temp = (temp * temp) % self.p
                i += 1
            
            b = pow(c, 1 << (M - i - 1), self.p)
            M = i
            c = (b * b) % self.p
            t = (t * c) % self.p
            R = (R * b) % self.p
    
    def find_all_points(self):
        """
        Find all points on the elliptic curve E_p(a, b)
        Uses Tonelli-Shanks for efficient square root computation
        
        Returns:
            list: List of tuples (x, y) representing all points on the curve,
                  including (None, None) for point at infinity
        """
        points = [(None, None)]  # Point at infinity
        
        for x in range(self.p):
            # Calculate y^2 = x^3 + ax + b (mod p)
            y_squared = (x**3 + self.a * x + self.b) % self.p
            
            # Find all y values where y^2 = y_squared (mod p)
            y_values = self.tonelli_shanks(y_squared)
            for y in y_values:
                points.append((x, y))
        
        return points
    
    def mod_inverse(self, a):
        """
        Calculate modular multiplicative inverse using Extended Euclidean Algorithm
        
        Args:
            a: Number to find inverse of
            
        Returns:
            int: Modular inverse of a (mod p)
            
        Raises:
            ValueError: If inverse doesn't exist
        """
        if a < 0:
            a = (a % self.p + self.p) % self.p
        
        def extended_gcd(a, b):
            """Extended Euclidean Algorithm"""
            if a == 0:
                return b, 0, 1
            gcd, x1, y1 = extended_gcd(b % a, a)
            x = y1 - (b // a) * x1
            y = x1
            return gcd, x, y
        
        gcd, x, _ = extended_gcd(a % self.p, self.p)
        if gcd != 1:
            raise ValueError(f"Modular inverse does not exist for {a} mod {self.p}")
        return (x % self.p + self.p) % self.p
    
    def add_points(self, P, Q):
        """
        Add two points P and Q on the elliptic curve
        
        Args:
            P: Tuple (x, y) or (None, None) for point at infinity
            Q: Tuple (x, y) or (None, None) for point at infinity
            
        Returns:
            tuple: Point P + Q
            
        Raises:
            ValueError: If points are not on the curve
        """
        # Handle point at infinity
        if P == (None, None):
            return Q
        if Q == (None, None):
            return P
        
        x1, y1 = P
        x2, y2 = Q
        
        # Validate that x, y are not None when not point at infinity
        if x1 is None or y1 is None or x2 is None or y2 is None:
            raise ValueError("Invalid point coordinates")
        
        # Verify points are on curve
        if not self.is_point_on_curve(x1, y1):
            raise ValueError(f"Point P({x1}, {y1}) is not on the curve")
        if not self.is_point_on_curve(x2, y2):
            raise ValueError(f"Point Q({x2}, {y2}) is not on the curve")
        
        # Handle point doubling (P = Q)
        if x1 == x2:
            if y1 == y2:
                # Point doubling: P + P
                if y1 == 0:
                    return (None, None)  # Result is point at infinity
                
                # slope = (3x1^2 + a) / (2y1) mod p
                numerator = (3 * x1**2 + self.a) % self.p
                denominator = (2 * y1) % self.p
                slope = (numerator * self.mod_inverse(denominator)) % self.p
            else:
                # P + (-P) = O (point at infinity)
                return (None, None)
        else:
            # Point addition: P != Q
            # slope = (y2 - y1) / (x2 - x1) mod p
            numerator = (y2 - y1) % self.p
            denominator = (x2 - x1) % self.p
            slope = (numerator * self.mod_inverse(denominator)) % self.p
        
        # Calculate resulting point
        x3 = (slope**2 - x1 - x2) % self.p
        y3 = (slope * (x1 - x3) - y1) % self.p
        
        return (x3, y3)
    
    def scalar_multiply(self, k, P):
        """
        Multiply point P by scalar k using double-and-add algorithm
        
        Args:
            k: Scalar multiplier (integer)
            P: Point to multiply (tuple)
            
        Returns:
            tuple: Point k*P
            
        Raises:
            ValueError: If point is not on curve
            TypeError: If k is not an integer
        """
        if not isinstance(k, int):
            raise TypeError("Scalar k must be an integer")
        
        if P == (None, None):
            return (None, None)
        
        if P[0] is None or P[1] is None:
            raise ValueError("Invalid point coordinates")
        
        if not self.is_point_on_curve(P[0], P[1]):
            raise ValueError(f"Point P{P} is not on the curve")
        
        if k == 0:
            return (None, None)  # Point at infinity
        
        if k < 0:
            # Negate the point for negative scalars
            k = -k
            P = (P[0], (-P[1]) % self.p)
        
        # Double-and-add algorithm (efficient O(log k))
        result = (None, None)  # Start with point at infinity
        addend = P
        
        while k:
            if k & 1:  # If bit is 1, add current point
                result = self.add_points(result, addend)
            addend = self.add_points(addend, addend)  # Double the point
            k >>= 1  # Shift to next bit
        
        return result
    
    def __str__(self):
        """String representation of the curve"""
        return f"E_{self.p}({self.a}, {self.b}): y^2 = x^3 + {self.a}x + {self.b} (mod {self.p})"
    
    def __repr__(self):
        """Developer-friendly representation"""
        return f"EllipticCurve(a={self.a}, b={self.b}, p={self.p})"


class RealEllipticCurve:
    """
    Elliptic Curve E(a, b) over R: y^2 = x^3 + a*x + b
    Point at infinity is represented as (None, None).
    """

    def __init__(self, a, b):
        """
        Initialize elliptic curve with parameters a and b (over R).

        Args:
            a: Coefficient of x
            b: Constant term

        Raises:
            ValueError: If discriminant is zero (singular curve)
            TypeError: If a or b are not numeric
        """
        if not isinstance(a, (int, float)) or not isinstance(b, (int, float)):
            raise TypeError("Parameters a and b must be numeric")
        
        self.a = a
        self.b = b

        # Discriminant Δ = -16(4a^3 + 27b^2); only the inner part matters for ≠ 0
        discriminant = 4 * a**3 + 27 * b**2
        if abs(discriminant) < 1e-10:  # Use tolerance for float comparison
            raise ValueError("Invalid curve: discriminant is zero (curve is singular).")

    @staticmethod
    def infinity():
        """Return point at infinity."""
        return (None, None)

    def is_infinity(self, P):
        """Check if P is the point at infinity."""
        return P == (None, None)

    def is_point_on_curve(self, x, y, tol=1e-9):
        """
        Check if (x, y) lies on the curve y^2 = x^3 + a*x + b over R.

        Args:
            x: x-coordinate (None for infinity)
            y: y-coordinate (None for infinity)
            tol: numerical tolerance for float comparisons

        Returns:
            bool
        """
        if x is None and y is None:
            return True
        
        if x is None or y is None:
            return False

        lhs = y**2
        rhs = x**3 + self.a * x + self.b

        return abs(lhs - rhs) <= tol

    def add_points(self, P, Q, tol=1e-12):
        """
        Add two points P and Q on the curve over R.

        Args:
            P: (x1, y1) or (None, None) for infinity
            Q: (x2, y2) or (None, None) for infinity
            tol: tolerance for float comparisons

        Returns:
            (x3, y3): P + Q
            
        Raises:
            ValueError: If points are not on the curve
        """
        # Handle infinity
        if self.is_infinity(P):
            return Q
        if self.is_infinity(Q):
            return P

        x1, y1 = P
        x2, y2 = Q
        
        # Validate coordinates
        if x1 is None or y1 is None or x2 is None or y2 is None:
            raise ValueError("Invalid point coordinates")

        # Verify points are on curve
        if not self.is_point_on_curve(x1, y1):
            raise ValueError(f"P = {P} is not on the curve")
        if not self.is_point_on_curve(x2, y2):
            raise ValueError(f"Q = {Q} is not on the curve")

        # If x1 == x2 and y1 == -y2 -> vertical line: P + Q = infinity
        if abs(x1 - x2) <= tol and abs(y1 + y2) <= tol:
            return self.infinity()

        # Point doubling
        if abs(x1 - x2) <= tol and abs(y1 - y2) <= tol:
            if abs(y1) <= tol:
                # Tangent is vertical -> infinity
                return self.infinity()

            # m = (3x1^2 + a) / (2y1)
            m = (3 * x1**2 + self.a) / (2 * y1)
        else:
            # General addition: m = (y2 - y1) / (x2 - x1)
            if abs(x2 - x1) <= tol:
                # Should have been caught by vertical case; treat as infinity
                return self.infinity()
            m = (y2 - y1) / (x2 - x1)

        # x3 = m^2 - x1 - x2
        x3 = m**2 - x1 - x2
        # y3 = m(x1 - x3) - y1
        y3 = m * (x1 - x3) - y1

        return (x3, y3)

    def scalar_multiply(self, k, P):
        """
        Compute k * P using double-and-add over R.

        Args:
            k: integer scalar (can be negative)
            P: point on the curve

        Returns:
            kP as a point
            
        Raises:
            TypeError: If k is not an integer
            ValueError: If P is not on the curve
        """
        if not isinstance(k, int):
            raise TypeError("Scalar k must be an integer for this implementation.")

        if self.is_infinity(P):
            return self.infinity()

        x, y = P
        
        if x is None or y is None:
            raise ValueError("Invalid point coordinates")
        
        if not self.is_point_on_curve(x, y):
            raise ValueError(f"P = {P} is not on the curve")

        if k == 0:
            return self.infinity()

        # Handle negative k: kP = -|k|P
        if k < 0:
            k = -k
            P = (x, -y)

        result = self.infinity()
        addend = P

        while k > 0:
            if k & 1:
                result = self.add_points(result, addend)
            addend = self.add_points(addend, addend)
            k >>= 1

        return result

    def __str__(self):
        return f"E(a={self.a}, b={self.b}): y^2 = x^3 + {self.a}x + {self.b} over R"
    
    def __repr__(self):
        return f"RealEllipticCurve(a={self.a}, b={self.b})"
