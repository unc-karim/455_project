/**
 * Interactive Explanations System
 * Provides contextual "Why this works" cards with animations
 * for teaching ECC concepts
 */

// =================== EXPLANATION CARD SYSTEM =================== //

const explanations = {
    groupLaw: {
        title: 'Why Does the Group Law Work?',
        icon: 'fa-shapes',
        sections: [
            {
                subtitle: 'Closure',
                content: 'When you add two points P and Q on the curve, the result R is also on the curve. This is guaranteed by the curve equation y² = x³ + ax + b.',
                animation: 'closure'
            },
            {
                subtitle: 'Associativity',
                content: '(P + Q) + R = P + (Q + R). The order of addition doesn\'t matter, which is crucial for cryptography.'
            },
            {
                subtitle: 'Identity Element',
                content: 'The point at infinity O acts as zero: P + O = P for any point P.'
            },
            {
                subtitle: 'Inverse Elements',
                content: 'For every point P = (x, y), there exists -P = (x, -y) such that P + (-P) = O.'
            },
            {
                subtitle: 'Commutativity',
                content: 'P + Q = Q + P. Addition works the same in either direction.'
            }
        ]
    },

    pointDoubling: {
        title: 'Why Does Point Doubling Use the Tangent?',
        icon: 'fa-circle-dot',
        sections: [
            {
                subtitle: 'The Geometric Picture',
                content: 'When adding P + P, we can\'t draw a line through two distinct points. Instead, we use the tangent line at P.',
                animation: 'tangent'
            },
            {
                subtitle: 'Calculating the Slope',
                content: 'The slope of the tangent is found using calculus: m = dy/dx = (3x² + a) / (2y). This comes from implicit differentiation of y² = x³ + ax + b.',
                formula: 'm = \\frac{3x^2 + a}{2y} \\pmod{p}'
            },
            {
                subtitle: 'Finding 2P',
                content: 'We follow the tangent until it hits the curve again at point R\', then reflect to get 2P = (x₃, y₃).',
                animation: 'doubling'
            },
            {
                subtitle: 'Why This Works',
                content: 'The tangent line represents the "limit" as Q approaches P in the addition formula. Mathematically, it\'s the derivative at that point.'
            }
        ]
    },

    discriminant: {
        title: 'Why Must the Discriminant Be Non-Zero?',
        icon: 'fa-triangle-exclamation',
        sections: [
            {
                subtitle: 'The Discriminant Formula',
                content: 'For a curve y² = x³ + ax + b, the discriminant is Δ = -16(4a³ + 27b²). We require Δ ≠ 0.',
                formula: '\\Delta = -16(4a^3 + 27b^2) \\neq 0'
            },
            {
                subtitle: 'Singular Curves',
                content: 'When Δ = 0, the curve has a singularity (a cusp or self-intersection). At these points, the curve is not smooth.',
                animation: 'singularity'
            },
            {
                subtitle: 'Why Smoothness Matters',
                content: 'To define point addition, we need to draw tangent lines. Singularities don\'t have well-defined tangents, breaking the group law.'
            },
            {
                subtitle: 'Examples',
                content: 'If a = 0 and b = 0, then y² = x³ has a cusp at (0,0). Try it and see the visualization break down!',
                interactive: true
            }
        ]
    },

    modularArithmetic: {
        title: 'Why Work Modulo a Prime?',
        icon: 'fa-calculator',
        sections: [
            {
                subtitle: 'Finite Fields',
                content: 'Working modulo p creates a finite field F_p with exactly p elements: {0, 1, 2, ..., p-1}. Every non-zero element has a multiplicative inverse.',
                formula: '\\mathbb{F}_p = \\{0, 1, 2, \\ldots, p-1\\}'
            },
            {
                subtitle: 'Division Works',
                content: 'In point addition, we divide by (x₂ - x₁) or 2y₁. Modular inverse ensures this always works when the denominator ≠ 0 mod p.',
                animation: 'modular-inverse'
            },
            {
                subtitle: 'Security',
                content: 'Finite groups make the discrete logarithm problem hard. With real numbers, you could use logarithms. With mod p, there\'s no shortcut!'
            },
            {
                subtitle: 'Why Prime?',
                content: 'If p is composite, some elements don\'t have inverses (like gcd(a,p) > 1). Primes guarantee F_p is a field.',
                interactive: true
            }
        ]
    },

    scalarMultiplication: {
        title: 'How Does Double-and-Add Work?',
        icon: 'fa-xmark',
        sections: [
            {
                subtitle: 'Binary Representation',
                content: 'Every number k can be written in binary: k = b_n·2^n + ... + b_1·2 + b_0. Example: 11 = 1011₂ = 8 + 2 + 1.',
                formula: 'k = \\sum_{i=0}^{n} b_i \\cdot 2^i, \\quad b_i \\in \\{0,1\\}'
            },
            {
                subtitle: 'The Algorithm',
                content: 'Start with Q = O. For each bit (from left to right): double Q, and if the bit is 1, add P.',
                animation: 'double-and-add'
            },
            {
                subtitle: 'Example: 11P',
                content: 'Binary: 1011₂\n• Start: Q = O\n• Bit 1: Q = 2·O + P = P\n• Bit 0: Q = 2·P = 2P\n• Bit 1: Q = 2·2P + P = 5P\n• Bit 1: Q = 2·5P + P = 11P'
            },
            {
                subtitle: 'Why It\'s Fast',
                content: 'Naive approach: k-1 additions. Double-and-add: ~log₂(k) doublings + additions. For k = 2²⁵⁶, that\'s 256 ops instead of 10⁷⁷ ops!'
            }
        ]
    },

    discreteLog: {
        title: 'Why Is the Discrete Log Problem Hard?',
        icon: 'fa-lock',
        sections: [
            {
                subtitle: 'The One-Way Function',
                content: 'Computing Q = k × P is fast (O(log k)). But given P and Q, finding k is exponentially harder.',
                animation: 'one-way'
            },
            {
                subtitle: 'No Known Shortcut',
                content: 'Unlike factoring (which has sub-exponential algorithms), the best known algorithm for ECC discrete log is fully exponential: O(√p).',
                formula: '\\text{Complexity} = O(\\sqrt{p})'
            },
            {
                subtitle: 'Example: 256-bit Curve',
                content: 'For a 256-bit curve, p ≈ 2²⁵⁶. The best attack requires √(2²⁵⁶) = 2¹²⁸ operations. That\'s impossible with current technology.'
            },
            {
                subtitle: 'Why ECC Is Strong',
                content: 'RSA needs 3072-bit keys for equivalent security. ECC achieves the same with just 256 bits. Smaller keys = faster operations!',
                interactive: true
            }
        ]
    }
};

// Active explanation tracking
let activeExplanation = null;

// =================== DISPLAY FUNCTIONS =================== //

function showExplanation(key, anchor = null) {
    if (!explanations[key]) {
        console.error(`Explanation "${key}" not found`);
        return;
    }

    const explanation = explanations[key];
    activeExplanation = key;

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'explanation-modal active';
    modal.id = 'explanationModal';

    modal.innerHTML = `
        <div class="explanation-modal-content">
            <div class="explanation-modal-header">
                <h2>
                    <i class="fa-solid ${explanation.icon}"></i>
                    ${explanation.title}
                </h2>
                <button class="explanation-close-btn" onclick="closeExplanation()" aria-label="Close explanation">×</button>
            </div>
            <div class="explanation-modal-body">
                ${explanation.sections.map((section, index) => renderExplanationSection(section, index, key)).join('')}
            </div>
            <div class="explanation-modal-footer">
                <button onclick="closeExplanation()" class="btn-secondary">Got it!</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Initialize animations
    setTimeout(() => {
        explanation.sections.forEach((section, index) => {
            if (section.animation) {
                initAnimation(key, index, section.animation);
            }
        });
    }, 100);

    announceToScreenReader(`Explanation opened: ${explanation.title}`);
}

function renderExplanationSection(section, index, key) {
    let html = `
        <div class="explanation-section" data-section="${index}">
            <div class="explanation-section-header">
                <h3>${section.subtitle}</h3>
            </div>
            <div class="explanation-section-body">
                <p>${section.content}</p>
    `;

    if (section.formula) {
        html += `
            <div class="explanation-formula">
                <code>${section.formula}</code>
            </div>
        `;
    }

    if (section.animation) {
        html += `
            <div class="explanation-animation-container">
                <canvas id="explanationCanvas-${key}-${index}" class="explanation-canvas" width="500" height="300"></canvas>
                <div class="animation-controls-mini">
                    <button onclick="playExplanationAnimation('${key}', ${index})" class="btn-mini">
                        <i class="fa-solid fa-play"></i> Play
                    </button>
                    <button onclick="resetExplanationAnimation('${key}', ${index})" class="btn-mini">
                        <i class="fa-solid fa-rotate-left"></i> Reset
                    </button>
                </div>
            </div>
        `;
    }

    if (section.interactive) {
        html += `
            <div class="explanation-interactive">
                <button onclick="tryInteractiveExample('${key}', ${index})" class="btn-primary">
                    <i class="fa-solid fa-flask"></i> Try It Yourself
                </button>
            </div>
        `;
    }

    html += `
            </div>
        </div>
    `;

    return html;
}

function closeExplanation() {
    const modal = document.getElementById('explanationModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    }
    activeExplanation = null;
    announceToScreenReader('Explanation closed');
}

// =================== ANIMATION SYSTEM =================== //

const animations = {};

function initAnimation(key, index, type) {
    const canvasId = `explanationCanvas-${key}-${index}`;
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const animKey = `${key}-${index}`;

    animations[animKey] = {
        canvas: canvas,
        ctx: ctx,
        type: type,
        frame: 0,
        playing: false,
        maxFrames: 60
    };

    // Draw initial state
    drawAnimationFrame(animKey, 0);
}

function playExplanationAnimation(key, index) {
    const animKey = `${key}-${index}`;
    const anim = animations[animKey];
    if (!anim || anim.playing) return;

    anim.playing = true;
    anim.frame = 0;

    function animate() {
        if (!anim.playing || anim.frame >= anim.maxFrames) {
            anim.playing = false;
            return;
        }

        drawAnimationFrame(animKey, anim.frame);
        anim.frame++;
        requestAnimationFrame(animate);
    }

    animate();
}

function resetExplanationAnimation(key, index) {
    const animKey = `${key}-${index}`;
    const anim = animations[animKey];
    if (!anim) return;

    anim.playing = false;
    anim.frame = 0;
    drawAnimationFrame(animKey, 0);
}

function drawAnimationFrame(animKey, frame) {
    const anim = animations[animKey];
    if (!anim) return;

    const { ctx, canvas, type } = anim;
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw based on animation type
    switch (type) {
        case 'closure':
            drawClosureAnimation(ctx, width, height, frame);
            break;
        case 'tangent':
            drawTangentAnimation(ctx, width, height, frame);
            break;
        case 'doubling':
            drawDoublingAnimation(ctx, width, height, frame);
            break;
        case 'singularity':
            drawSingularityAnimation(ctx, width, height, frame);
            break;
        case 'double-and-add':
            drawDoubleAndAddAnimation(ctx, width, height, frame);
            break;
        case 'one-way':
            drawOneWayAnimation(ctx, width, height, frame);
            break;
        case 'modular-inverse':
            drawModularInverseAnimation(ctx, width, height, frame);
            break;
        default:
            drawPlaceholderAnimation(ctx, width, height, frame, type);
    }
}

// =================== SPECIFIC ANIMATIONS =================== //

function drawClosureAnimation(ctx, width, height, frame) {
    // Draw elliptic curve
    ctx.strokeStyle = '#4a9eff';
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let x = 0; x < width; x++) {
        const t = (x / width) * 6 - 3;
        const y = Math.sqrt(Math.abs(t * t * t - t)) * 40 + height / 2;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Animate points P, Q, and P+Q appearing
    const progress = frame / 60;

    if (progress > 0.2) {
        // Point P
        ctx.fillStyle = '#ff6b6b';
        ctx.beginPath();
        ctx.arc(150, 180, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText('P', 155, 175);
    }

    if (progress > 0.4) {
        // Point Q
        ctx.fillStyle = '#ffa500';
        ctx.beginPath();
        ctx.arc(300, 120, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText('Q', 305, 115);
    }

    if (progress > 0.6) {
        // Line through P and Q
        ctx.strokeStyle = '#888';
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(150, 180);
        ctx.lineTo(300, 120);
        ctx.lineTo(400, 80);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    if (progress > 0.8) {
        // Point P+Q
        ctx.fillStyle = '#4ecdc4';
        ctx.beginPath();
        ctx.arc(400, height - 80, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText('P+Q', 405, height - 85);

        // Arrow showing reflection
        ctx.strokeStyle = '#4ecdc4';
        ctx.beginPath();
        ctx.moveTo(400, 80);
        ctx.lineTo(400, height - 80);
        ctx.stroke();
    }
}

function drawTangentAnimation(ctx, width, height, frame) {
    const progress = frame / 60;

    // Draw curve
    ctx.strokeStyle = '#4a9eff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x < width; x++) {
        const t = (x / width) * 6 - 3;
        const y = Math.sqrt(Math.abs(t * t * t - t)) * 40 + height / 2;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Point P
    const px = 200;
    const py = 140;
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText('P', px + 10, py - 10);

    if (progress > 0.3) {
        // Tangent line
        ctx.strokeStyle = '#ffa500';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(px - 150, py + 45);
        ctx.lineTo(px + 250, py - 75);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label
        ctx.fillStyle = '#ffa500';
        ctx.fillText('Tangent at P', px + 100, py - 60);
    }

    if (progress > 0.6) {
        // Intersection point
        ctx.fillStyle = '#4ecdc4';
        ctx.beginPath();
        ctx.arc(380, 95, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText('R\'', 385, 90);
    }

    if (progress > 0.85) {
        // Reflected point (2P)
        ctx.fillStyle = '#4ecdc4';
        ctx.beginPath();
        ctx.arc(380, height - 95, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText('2P', 385, height - 100);

        // Reflection arrow
        ctx.strokeStyle = '#4ecdc4';
        ctx.beginPath();
        ctx.moveTo(380, 95);
        ctx.lineTo(380, height - 95);
        ctx.stroke();
    }
}

function drawDoublingAnimation(ctx, width, height, frame) {
    drawTangentAnimation(ctx, width, height, frame);
}

function drawSingularityAnimation(ctx, width, height, frame) {
    const progress = frame / 60;

    ctx.font = '14px monospace';

    if (progress < 0.5) {
        // Show smooth curve
        ctx.strokeStyle = '#4ecdc4';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 0; x < width; x++) {
            const t = (x / width) * 6 - 3;
            const y = Math.sqrt(Math.abs(t * t * t - t + 1)) * 40 + height / 2;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        ctx.fillStyle = '#4ecdc4';
        ctx.fillText('Smooth curve (Δ ≠ 0)', 20, 30);
    } else {
        // Show singular curve (cusp)
        ctx.strokeStyle = '#ff6b6b';
        ctx.lineWidth = 2;
        ctx.beginPath();

        // Draw cusp y² = x³
        for (let t = -2; t <= 2; t += 0.01) {
            const x = t * t;
            const y = t * t * t;
            const canvasX = width / 2 + x * 80;
            const canvasY = height / 2 - y * 30;

            if (t === -2) ctx.moveTo(canvasX, canvasY);
            else ctx.lineTo(canvasX, canvasY);
        }
        ctx.stroke();

        ctx.fillStyle = '#ff6b6b';
        ctx.fillText('Singular curve (Δ = 0)', 20, 30);
        ctx.fillText('Cusp at origin - no tangent!', 20, 50);

        // Mark the cusp
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, 8, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawDoubleAndAddAnimation(ctx, width, height, frame) {
    const progress = frame / 60;
    const k = 11; // Example: 11 = 1011 in binary
    const binary = '1011';

    ctx.font = '16px monospace';
    ctx.fillStyle = '#fff';

    // Title
    ctx.fillText('Computing 11P using Double-and-Add', 20, 30);
    ctx.fillText(`Binary: ${binary}`, 20, 55);

    // Show steps
    const steps = [
        { bit: '1', action: 'Q = O → Q = P', result: '1P' },
        { bit: '0', action: 'Q = 2P', result: '2P' },
        { bit: '1', action: 'Q = 2(2P) + P', result: '5P' },
        { bit: '1', action: 'Q = 2(5P) + P', result: '11P' }
    ];

    const currentStep = Math.floor(progress * steps.length);

    steps.forEach((step, i) => {
        const y = 90 + i * 50;
        const alpha = i <= currentStep ? 1 : 0.3;

        ctx.fillStyle = i === currentStep ? '#4ecdc4' : `rgba(255,255,255,${alpha})`;
        ctx.fillText(`Step ${i + 1}: bit=${step.bit}`, 30, y);
        ctx.fillText(step.action, 30, y + 20);

        if (i <= currentStep) {
            ctx.fillStyle = '#ffa500';
            ctx.fillText(`→ ${step.result}`, 300, y + 10);
        }
    });
}

function drawOneWayAnimation(ctx, width, height, frame) {
    const progress = frame / 60;

    ctx.font = '16px monospace';

    // Forward direction (easy)
    if (progress > 0.2) {
        ctx.fillStyle = '#4ecdc4';
        ctx.fillText('Forward: k × P = Q', 50, 80);
        ctx.fillText('⚡ FAST (O(log k))', 50, 105);

        ctx.strokeStyle = '#4ecdc4';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(50, 120);
        ctx.lineTo(250, 120);
        // Arrow
        ctx.lineTo(240, 110);
        ctx.moveTo(250, 120);
        ctx.lineTo(240, 130);
        ctx.stroke();
    }

    // Backward direction (hard)
    if (progress > 0.6) {
        ctx.fillStyle = '#ff6b6b';
        ctx.fillText('Backward: Q, P → find k', 50, 180);
        ctx.fillText('🐌 SLOW (O(√p))', 50, 205);

        ctx.strokeStyle = '#ff6b6b';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 10]);
        ctx.beginPath();
        ctx.moveTo(250, 220);
        ctx.lineTo(50, 220);
        // Arrow (with X)
        ctx.lineTo(60, 210);
        ctx.moveTo(50, 220);
        ctx.lineTo(60, 230);
        ctx.stroke();
        ctx.setLineDash([]);

        // X mark
        ctx.fillStyle = '#ff0000';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText('✗', 140, 225);
    }
}

function drawModularInverseAnimation(ctx, width, height, frame) {
    const progress = frame / 60;

    ctx.font = '14px monospace';
    ctx.fillStyle = '#fff';

    ctx.fillText('Division in modular arithmetic:', 30, 40);

    if (progress > 0.3) {
        ctx.fillText('Problem: Find (38 - 6) / (5 - 3) mod 97', 30, 80);
    }

    if (progress > 0.5) {
        ctx.fillText('Step 1: Compute numerator', 30, 120);
        ctx.fillStyle = '#4ecdc4';
        ctx.fillText('38 - 6 = 32', 50, 145);
    }

    if (progress > 0.65) {
        ctx.fillStyle = '#fff';
        ctx.fillText('Step 2: Compute denominator', 30, 180);
        ctx.fillStyle = '#4ecdc4';
        ctx.fillText('5 - 3 = 2', 50, 205);
    }

    if (progress > 0.8) {
        ctx.fillStyle = '#fff';
        ctx.fillText('Step 3: Find modular inverse of 2', 30, 240);
        ctx.fillStyle = '#ffa500';
        ctx.fillText('2⁻¹ ≡ 49 (mod 97)', 50, 265);
    }

    if (progress > 0.9) {
        ctx.fillStyle = '#fff';
        ctx.fillText('Step 4: Multiply', 30, 295);
        ctx.fillStyle = '#4ecdc4';
        ctx.fillText('32 × 49 ≡ 16 (mod 97) ✓', 50, 320);
    }
}

function drawPlaceholderAnimation(ctx, width, height, frame, type) {
    const progress = frame / 60;

    ctx.fillStyle = '#888';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Animation: ${type}`, width / 2, height / 2);

    // Spinning indicator
    ctx.strokeStyle = '#4a9eff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(width / 2, height / 2 + 40, 20, 0, Math.PI * 2 * progress);
    ctx.stroke();

    ctx.textAlign = 'left';
}

// =================== INTERACTIVE EXAMPLES =================== //

function tryInteractiveExample(key, sectionIndex) {
    closeExplanation();

    if (key === 'discriminant') {
        // Set parameters that cause singularity
        document.getElementById('paramA').value = '0';
        document.getElementById('paramB').value = '0';
        document.getElementById('paramP').value = '23';

        showToast('Parameters set to a=0, b=0, p=23. Try "Find All Points" to see what happens!', 'info');

        // Scroll to main panel
        document.getElementById('fpTab').scrollIntoView({ behavior: 'smooth' });
    } else if (key === 'modularArithmetic') {
        // Demonstrate with composite number
        showToast('Try setting p to a composite number like 15 and see the warnings!', 'info');
        document.getElementById('paramP').value = '15';
    } else if (key === 'discreteLog') {
        // Open discrete log demo
        selectDemonstrationPane('discreteLogPane');
        showToast('Try the discrete log demo with different values of k!', 'info');
    }
}

// =================== CONTEXTUAL HELPERS =================== //

function addExplanationButton(parentElement, explanationKey, label = 'Why does this work?') {
    const btn = document.createElement('button');
    btn.className = 'explanation-trigger-btn';
    btn.innerHTML = `<i class="fa-solid fa-circle-question"></i> ${label}`;
    btn.onclick = () => showExplanation(explanationKey);

    parentElement.appendChild(btn);
    return btn;
}

// Add explanation buttons to relevant sections
function initExplanationButtons() {
    // Add to point addition section
    const addSection = document.querySelector('#fpAddPane h2');
    if (addSection) {
        const container = addSection.parentElement;
        const btn = document.createElement('div');
        btn.className = 'explanation-helper';
        btn.innerHTML = `
            <button class="explanation-trigger-btn" onclick="showExplanation('groupLaw')">
                <i class="fa-solid fa-circle-question"></i> Why does point addition work?
            </button>
        `;
        container.insertBefore(btn, addSection.nextSibling);
    }

    // Add to scalar multiplication
    const mulSection = document.querySelector('#fpMulPane h2');
    if (mulSection) {
        const container = mulSection.parentElement;
        const btn = document.createElement('div');
        btn.className = 'explanation-helper';
        btn.innerHTML = `
            <button class="explanation-trigger-btn" onclick="showExplanation('scalarMultiplication')">
                <i class="fa-solid fa-circle-question"></i> How does double-and-add work?
            </button>
        `;
        container.insertBefore(btn, mulSection.nextSibling);
    }

    // Add to initialization
    const initSection = document.querySelector('#fpInitPane .form-group');
    if (initSection) {
        const discriminantHelper = document.createElement('div');
        discriminantHelper.className = 'explanation-helper-inline';
        discriminantHelper.innerHTML = `
            <button class="explanation-trigger-btn-small" onclick="showExplanation('discriminant')">
                <i class="fa-solid fa-circle-question"></i> Why must Δ ≠ 0?
            </button>
        `;

        // Add after the parameter inputs
        const paramsSection = document.querySelector('#paramP').closest('.form-group');
        if (paramsSection) {
            paramsSection.parentElement.insertBefore(discriminantHelper, paramsSection.nextSibling);
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initExplanationButtons);
} else {
    initExplanationButtons();
}

console.log('✅ Interactive Explanations System loaded');
