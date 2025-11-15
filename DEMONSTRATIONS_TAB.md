# Demonstrations Tab - Usage Guide

## Overview

The demonstrations now have their own dedicated tab with a dropdown menu, similar to how "Curve type" and "Encryption/Decryption" work.

## How to Access

### Via Dropdown Tab
At the top of the page, you'll now see three dropdown selectors:
1. **Curve type** → (Curve over Fp / Curve over ℝ)
2. **Encryption/Decryption** → (Initialization)
3. **Demonstrations** → (Diffie-Hellman / Discrete Logarithm) ← **NEW!**

### Steps:
1. Hover over or click the **"Demonstrations"** dropdown
2. Select either:
   - **Diffie-Hellman** - Interactive ECDH key exchange demo
   - **Discrete Logarithm** - Brute-force DLP demonstration

## Features

### Diffie-Hellman Tab
- **Preset Curves**: Choose from E₂₃, E₃₁, E₄₇, or E₉₇
- **Custom Parameters**: Enter your own a, b, p values
- **Interactive Visualization**: Step-by-step walkthrough showing:
  - Alice's key generation
  - Bob's key generation
  - Shared secret derivation
- **Animation Controls**: Play/Pause, Previous/Next, Slider
- **Summary**: Shows all keys and the final shared secret

### Discrete Logarithm Tab
- **Preset Curves**: Choose from E₂₃, E₃₁, E₄₇, or E₉₇
- **Custom Parameters**: Enter your own a, b, p values
- **Scalar Input**: Choose k value (2-15 recommended)
- **Brute Force Visualization**: Watch the algorithm try 1P, 2P, 3P... until finding kP
- **Match Highlighting**: Solution is marked with ✓
- **Complexity Note**: Explains why this is hard for large curves

## Layout

Each demonstration pane has a two-panel layout:

### Left Panel
- Curve parameter inputs
- Preset curve selector
- "Start Demo" button
- Result summary

### Right Panel
- Visualization/Steps container
- Animation controls (for Diffie-Hellman)
- Scrollable content area

## Comparison: Tab vs Menu/Buttons

### Demonstrations Tab (NEW)
- **Pros**:
  - Dedicated space for each demonstration
  - Cleaner main curve interface
  - Independent parameter inputs
  - Better for focused learning
  - Animation controls always visible

- **Access**: Demonstrations dropdown → Select demo type

### Menu/Button Quick Access (Still Available)
- **Pros**:
  - One-click from current curve
  - Uses current curve parameters
  - Quick modal popup
  - Good for quick demos

- **Access**:
  - Menu (☰) → Advanced Features → Diffie-Hellman/Discrete Log
  - OR main panel buttons (in Operations section)

## Examples

### Example 1: Run Diffie-Hellman Demo

```
1. Click "Demonstrations" dropdown at top
2. Select "Diffie-Hellman"
3. Choose preset "E₄₇(5,7)" or enter custom parameters
4. Click "Start Diffie-Hellman Demo"
5. Watch step-by-step visualization
6. Use Play/Pause or slider to control animation
7. See summary showing shared secret
```

### Example 2: Discrete Logarithm with k=7

```
1. Click "Demonstrations" dropdown at top
2. Select "Discrete Logarithm"
3. Choose preset "E₉₇(2,3)"
4. Set k = 7
5. Click "Start Discrete Log Demo"
6. Watch brute force attempts: 1P, 2P, 3P... 7P
7. See solution highlighted with ✓
```

## Technical Details

### New HTML Elements
- `demonstrationsTab` - Main tab container
- `dhDemoPane` - Diffie-Hellman pane
- `discreteLogPane` - Discrete Log pane
- `demonstrationSelectorBtn` - Dropdown button

### New JavaScript Functions
- `selectDemonstrationPane(paneId, event)` - Tab switching
- `loadDHPreset(presetKey)` - Load DH preset curve
- `loadDLogPreset(presetKey)` - Load DLog preset curve
- `runDiffieHellmanDemo()` - Execute DH demo in tab
- `runDiscreteLogDemo()` - Execute DLog demo in tab
- `displayDiffieHellmanInTab(data)` - Render DH results
- `displayDiscreteLogInTab(data)` - Render DLog results

### API Endpoints Used
- `/api/diffie_hellman` - Same as before
- `/api/discrete_log_demo` - Same as before

## Benefits of the New Layout

1. **Better Organization**: Demonstrations have their own dedicated space
2. **Independent Parameters**: Can demo different curves without changing main curve
3. **Cleaner Main Interface**: Fp/ℝ tabs are less cluttered
4. **Consistent UX**: Matches the pattern of Curve type and Encryption dropdowns
5. **Side-by-Side Layout**: Input params on left, visualization on right
6. **Always Accessible**: No need to initialize a curve first (demos have their own inputs)

## Backward Compatibility

The old access methods still work:
- Menu → Advanced Features → Diffie-Hellman (opens modal)
- Menu → Advanced Features → Discrete Log (opens modal with prompt)
- Main panel buttons still available (for quick demos using current curve)

## Mobile/Responsive

The dropdown automatically wraps on smaller screens:
```
[Curve type] [Encryption/Decryption]
[Demonstrations]
```

All three selectors remain fully functional.

---

**Created**: November 15, 2025
**Version**: 2.0
**Update**: Added dedicated Demonstrations tab with hover dropdown
