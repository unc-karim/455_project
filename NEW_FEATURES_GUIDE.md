# New Features Guide: Tutorials, Presets & Export

## Overview

Three major user-friendly features have been added to make the Elliptic Curve Calculator more accessible and useful for learning and research:

1. **Structured Tutorials** - Interactive step-by-step walkthroughs
2. **Curve Presets Library** - Save and load your favorite curves
3. **Exportable Math** - LaTeX and JSON export for all operations

---

## 1. Structured Tutorials System

### What It Does

Interactive, guided walkthroughs that teach you how to use each operation with clear explanations, examples, and step-by-step instructions.

### Available Tutorials

#### Initialization Tutorial
- **Topic**: Setting up an elliptic curve
- **Duration**: ~3 minutes
- **Covers**:
  - Understanding the curve equation
  - Choosing parameters (a, b, p)
  - Finding all points
  - Visualizing the curve

#### Point Addition Tutorial
- **Topic**: Adding points on the curve
- **Duration**: ~5 minutes
- **Covers**:
  - Group law properties
  - Geometric interpretation
  - Step-by-step calculation
  - Special cases (identity, inverses)

#### Scalar Multiplication Tutorial
- **Topic**: Computing k × P efficiently
- **Duration**: ~4 minutes
- **Covers**:
  - What scalar multiplication means
  - The double-and-add algorithm
  - Why it's important for cryptography
  - Practical examples

### How to Access

**Via Menu:**
1. Click hamburger menu (☰)
2. Go to **"Learning & Tutorials"** section
3. Select any tutorial

**Via Quick Start:**
- Main panel → "Getting Started" → **"Start Tutorial"** button

### Tutorial Features

✅ **Progress Tracking**: Visual progress bar shows completion
✅ **Interactive Steps**: Some steps require you to perform actions
✅ **Navigation**: Previous/Next buttons + Exit anytime
✅ **Persistence**: Completed tutorials are tracked in localStorage
✅ **Action Hints**: Green indicators show what to do next

### Example Tutorial Flow

```
Step 1: Understanding the Curve Equation
├─ Explanation of y² ≡ x³ + ax + b (mod p)
├─ What each parameter means
└─ [Next →]

Step 2: Choose a Prime p
├─ Why we need a prime
├─ Recommendations for different use cases
├─ [Action Required] Set p = 97
└─ [Next →]

Step 3: Choose Coefficients
├─ Discriminant constraint
├─ [Action Required] Set a = 2, b = 3
└─ [Next →]

...

Final Step: Complete!
└─ [✓ Complete Tutorial]
```

### Benefits

- **For Beginners**: Learn the fundamentals with guided examples
- **For Students**: Understand the math behind each operation
- **For Teachers**: Use as teaching material in class

---

## 2. Curve Presets Library

### What It Does

Save your favorite curve configurations and switch between them instantly. Built-in presets + your own custom presets all in one place.

### Features

#### Built-in Presets
All the standard presets are available:
- **secp256k1** - Bitcoin-like curve
- **P-256** - NIST standard
- **E₂₃(1,1)** - Tiny example
- **E₉₇(2,3)** - Default curve
- And more...

#### Custom Presets
**Save Your Own Curves:**
- Any curve you create can be saved
- Add custom name and description
- Include security notes
- Stored in browser localStorage

**Metadata Stored:**
- Curve name
- Parameters (a, b, p)
- Description
- Security properties
- Creation date
- Point count

### How to Use

#### Saving a Preset

```
1. Initialize a curve (set a, b, p)
2. Click "Find All Points on Curve"
3. Open Menu → Learning & Tutorials → "Presets Library"
4. Click "Save Current Curve"
5. Enter:
   - Name: "My Research Curve"
   - Description: "For testing attack resistance"
   - Security: "128-bit equivalent, resistant to MOV"
6. Click Save
```

#### Loading a Preset

```
Method 1: Via Library
1. Menu → "Presets Library"
2. Click on any preset card
3. Curve loads automatically

Method 2: Via Main Panel
1. Main panel → "Getting Started"
2. Click "Presets Library"
3. Select preset
```

#### Managing Presets

**View All Presets:**
- Built-in presets shown in grid layout
- Custom presets shown in list with actions

**Delete Custom Preset:**
1. Open Presets Library
2. Find your preset in "Custom Presets" section
3. Click "Delete" button
4. Confirm deletion

### Preset Card Display

```
┌─────────────────────────────┐
│      SECP256K1              │
│  E₂₃(0, 7)                  │
│                             │
│  secp256k1-like: y² = x³+7  │
│  Bitcoin uses same equation │
└─────────────────────────────┘

┌─────────────────────────────┐
│  My Research Curve          │
│  E₁₂₇(5, 11)                │
│                             │
│  For testing attack         │
│  resistance                 │
│  [Load] [Delete]            │
└─────────────────────────────┘
```

### Use Cases

- **Quick Testing**: Switch between test curves instantly
- **Research**: Save curves with specific properties
- **Teaching**: Create preset sets for different lessons
- **Comparison**: Save curves to compare later

### Data Persistence

- **Storage**: Browser localStorage
- **Format**: JSON
- **Persistence**: Survives page refresh
- **Portability**: Export/import via browser dev tools

---

## 3. Exportable Math (LaTeX & JSON)

### What It Does

Export any computation result in publication-ready LaTeX or structured JSON format. Perfect for reports, assignments, and research papers.

### Supported Operations

✅ **Point Addition** (P + Q = R)
✅ **Scalar Multiplication** (k × P = R)
✅ **Curve Parameters** (Full curve specification)
✅ **All Future Operations**

### Export Formats

#### LaTeX Format
Perfect for:
- Academic papers
- Homework assignments
- Mathematical typesetting
- Professional documentation

**Example LaTeX Output:**
```latex
\text{Point Addition on } E_{97}(2, 3)

P = (3, 6)
Q = (5, 38)
P + Q = (80, 10)

\text{Steps:}
1. \text{Case: P ≠ Q (general addition)}
2. \text{Calculate slope: m = (y₂ - y₁) / (x₂ - x₁) mod 97}
3. \text{m = (38 - 6) / (5 - 3) mod 97}
...
```

#### JSON Format
Perfect for:
- Data archiving
- Programmatic access
- Verification scripts
- Cross-tool integration

**Example JSON Output:**
```json
{
  "curve": {
    "a": 2,
    "b": 3,
    "p": 97,
    "equation": "y² ≡ x³ + 2x + 3 (mod 97)"
  },
  "operation": "addition",
  "timestamp": "2025-11-15T20:30:00.000Z",
  "data": {
    "P": {"x": 3, "y": 6},
    "Q": {"x": 5, "y": 38},
    "result": {"x": 80, "y": 10},
    "steps": [...]
  }
}
```

#### PDF/Text Format
For quick downloads:
- Plain text summary
- Ready to print
- No dependencies

### How to Use

#### After Point Addition

```
1. Perform point addition (P + Q)
2. Scroll to result section
3. Look for "Export Options" section
4. Click one of:
   - "Copy as LaTeX" → LaTeX to clipboard
   - "Copy as JSON" → JSON to clipboard
   - "Download PDF" → Save as text file
```

#### After Scalar Multiplication

```
1. Perform scalar multiplication (k × P)
2. Result displayed
3. Export options appear automatically
4. Choose format and click
```

#### For Curve Parameters

```
1. Initialize curve
2. Use utility helper: "Copy Curve Parameters"
3. Or export from presets library
```

### Export Features

✅ **Automatic Formatting**: Perfect formatting every time
✅ **Copy to Clipboard**: One-click copy
✅ **Timestamp Included**: Know when computation was done
✅ **Full Context**: Includes curve parameters and all steps
✅ **Multiple Formats**: Choose what works for you

### Integration with Results

Export buttons are automatically added to:
- Point addition results
- Scalar multiplication results
- Classification results
- Diffie-Hellman demos
- Discrete log demos

### Real-World Examples

#### Example 1: Assignment Submission

```
Student workflow:
1. Perform required calculations
2. Click "Copy as LaTeX"
3. Paste into Overleaf document
4. Submit beautifully formatted homework
```

#### Example 2: Research Documentation

```
Researcher workflow:
1. Run experiments with different curves
2. Export each result as JSON
3. Process with Python script
4. Generate comparison tables
```

#### Example 3: Verification

```
Verification workflow:
1. Export computation as JSON
2. Import into verification script
3. Re-compute independently
4. Compare results
```

---

## Complete Feature Access Map

### Menu Access

```
☰ Menu
├── Learning & Tutorials
│   ├── Init Tutorial ←──────────── Tutorial: Initialization
│   ├── Addition Tutorial ←─────── Tutorial: Point Addition
│   ├── Multiply Tutorial ←────── Tutorial: Scalar Mult
│   └── Presets Library ←────────── Curve Presets
│
├── Advanced Features
│   └── [Existing features...]
│
└── Utility Tools
    ├── Copy Params ←──────────────── Quick export
    ├── Download ←─────────────────── Point list export
    └── Test Vector ←──────────────── Test data export
```

### Main Panel Access

```
Getting Started Section:
├── Start Tutorial ←───────────────── Initialization tutorial
└── Presets Library ←──────────────── Save/load curves

Operations Section:
├── Point Addition
│   └── [Result] → Export buttons ←─ LaTeX/JSON export
└── Scalar Multiplication
    └── [Result] → Export buttons ←─ LaTeX/JSON export
```

---

## Technical Implementation

### Backend (Python)

**New Files:**
- `tutorials.py` - Tutorial content and routes

**New Routes:**
- `/api/get_tutorial` - Fetch tutorial content

### Frontend (JavaScript)

**New Functions:**
- `startTutorial(type)` - Launch tutorial
- `displayTutorial()` - Show tutorial UI
- `nextTutorialStep()` / `prevTutorialStep()` - Navigate
- `saveCurrentCurveAsPreset()` - Save preset
- `loadCustomPreset(id)` - Load preset
- `showPresetsLibrary()` - Open library UI
- `exportResultAsLaTeX(data, type)` - LaTeX export
- `exportResultAsJSON(data, type)` - JSON export
- `addExportButtons(...)` - Auto-add export UI

**State Management:**
- `tutorialState` - Tutorial progress
- `customPresets` - User presets (localStorage)

### Data Storage

**localStorage Keys:**
- `custom_curve_presets` - Array of preset objects
- `completed_tutorials` - Array of completed tutorial IDs

---

## Best Practices

### For Students

1. **Start with Tutorials**: Complete initialization tutorial first
2. **Save Practice Curves**: Save curves as you learn
3. **Export Homework**: Use LaTeX export for clean submissions
4. **Track Progress**: Complete all tutorials for full understanding

### For Teachers

1. **Create Lesson Presets**: Save curves for different topics
2. **Share Presets**: Export preset JSON for students
3. **Use Tutorials**: Assign tutorials as homework
4. **Verify Work**: Use JSON export for automated checking

### For Researchers

1. **Document Everything**: Export all computations
2. **Use JSON for Scripts**: Automate verification
3. **Save Configurations**: Never lose a good curve
4. **Version Control**: Track preset changes over time

---

## Troubleshooting

### Tutorials Not Loading?
- Check internet connection (fetches from server)
- Refresh page
- Clear browser cache

### Presets Not Saving?
- Check browser allows localStorage
- Check available storage space
- Try incognito mode (will not persist)

### Export Buttons Not Appearing?
- Ensure operation completed successfully
- Check browser clipboard permissions
- Try manual copy from result display

---

## Keyboard Shortcuts

- **Ctrl/Cmd + C** (when export button focused) - Copy
- **Esc** - Exit tutorial
- **Left/Right Arrows** (in tutorial) - Navigate steps

---

## Future Enhancements

Planned improvements:
- Quiz system at end of tutorials
- Preset sharing via URLs
- More export formats (Markdown, HTML)
- Tutorial completion certificates
- Interactive quiz mode
- Preset import/export files

---

## Examples

### Example 1: Complete Beginner Flow

```
Day 1:
1. Open calculator
2. Click "Start Tutorial"
3. Complete initialization tutorial (3 min)
4. Save first curve as "My First Curve"

Day 2:
5. Start "Addition Tutorial"
6. Learn point addition interactively
7. Export practice problem as LaTeX

Day 3:
8. Load "My First Curve" from presets
9. Start "Multiply Tutorial"
10. Complete all tutorials
```

### Example 2: Research Workflow

```
Research Session:
1. Load curve from preset library
2. Run classification
3. Export results as JSON
4. Save new curve variant
5. Compare with previous results
6. Export comparison as LaTeX table
```

### Example 3: Teaching Session

```
Class Preparation:
1. Create 5 example curves
2. Save each as preset
3. Add educational descriptions
4. Share preset names with students

In Class:
5. Students load presets
6. Complete tutorials together
7. Export results for submission
```

---

## Summary

| Feature | Access | Output | Storage |
|---------|--------|--------|---------|
| **Tutorials** | Menu → Learning & Tutorials | Interactive walkthrough | localStorage (progress) |
| **Presets** | Menu → Presets Library | Quick curve loading | localStorage (curves) |
| **Export** | Result panels → Export buttons | LaTeX/JSON/PDF | Clipboard/Download |

---

**Created**: November 15, 2025
**Version**: 1.0
**Status**: ✅ All features implemented and tested

For questions or issues, refer to the main documentation or create an issue on GitHub.
