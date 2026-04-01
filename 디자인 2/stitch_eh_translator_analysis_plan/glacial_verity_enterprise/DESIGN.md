# Design System Specification: The Architectural Intelligence

## 1. Overview & Creative North Star: "The Crystalline Executive"
This design system is a bridge between the ethereal beauty of "Liquid Glass" and the unwavering rigor of enterprise-level data architecture. The Creative North Star is **"The Crystalline Executive"**—a vision where the UI feels like a high-end, bespoke digital workspace carved from a single block of translucent sapphire.

We break the "generic enterprise" mold by replacing rigid, line-heavy grids with **Atmospheric Depth**. By utilizing intentional asymmetry and tonal layering, we transform dense data into an editorial experience. The goal is to move away from "software you have to use" toward "an environment you want to inhabit," where deep professional blues provide the bedrock of trust, and glass-like surfaces provide the clarity of thought.

---

## 2. Colors: Tonal Depth & The "No-Line" Philosophy
The palette is rooted in `primary` (#001736 - Deep Navy) and `secondary` (#0058bb - Professional Blue). It is designed to be felt rather than seen through heavy-handed strokes.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to define sections. Layout boundaries must be established through:
1.  **Background Shifts:** Placing a `surface-container-low` section against a `surface` background.
2.  **Tonal Transitions:** Using subtle shifts between `surface-container` tiers (Lowest to Highest).

### Surface Hierarchy & Nesting
Treat the UI as physical layers of frosted glass.
*   **Base:** `surface` (#f7f9fb)
*   **Secondary Sections:** `surface-container-low` (#f2f4f6)
*   **Interactive Cards:** `surface-container-lowest` (#ffffff)
*   **Active/Elevated Elements:** `surface-container-high` (#e6e8ea)

### The "Liquid Glass" Gradient
To inject "soul" into enterprise components, use a **Signature Gradient** for primary CTAs and Hero backgrounds:
*   **Linear Gradient (135deg):** From `primary` (#001736) to `secondary_container` (#1471e6). This creates a sense of deep, liquid motion that flat colors cannot replicate.

---

## 3. Typography: Editorial Authority
We utilize a dual-typeface strategy to balance human emotion with technical precision.

*   **Display & Headlines (Manrope):** Chosen for its geometric modernism. Large-scale headlines (`display-lg` at 3.5rem) should use tight letter-spacing (-0.02em) to create an authoritative, editorial "vibe."
*   **Body & Data (Inter):** Chosen for its exceptional legibility at small sizes. 
    *   **Data Density:** In tables, use `body-sm` (0.75rem) with `label-md` for headers to maximize information density without sacrificing clarity.
    *   **Hierarchy:** `title-lg` (Inter, 1.375rem) serves as the bridge between the expressive Manrope and the functional Inter.

---

## 4. Elevation & Depth: Atmospheric Layering
Forget shadows as "effects"; treat them as physics.

*   **The Layering Principle:** Depth is achieved by stacking. A `surface-container-lowest` card sitting on a `surface-container-low` background creates a natural lift.
*   **Ambient Shadows:** For floating elements (Modals, Popovers), use a shadow with a 24px-32px blur at 4% opacity, using the `on-surface` color (#191c1e) as the tint.
*   **The "Ghost Border" Fallback:** If a border is required for accessibility, use the `outline-variant` (#c4c6d0) at **15% opacity**. This creates a suggestion of a boundary without breaking the liquid aesthetic.
*   **Glassmorphism:** For sidebars or floating navigation, apply `surface-container-lowest` with 80% opacity and a `backdrop-filter: blur(12px)`.

---

## 5. Components: Enterprise Precision

### Data Tables (The Core)
*   **Structure:** No vertical or horizontal lines. Use a `surface-container-low` background for the header row.
*   **Spacing:** Use `spacing-2` (0.4rem) for cell padding to ensure high density, but maintain `spacing-4` (0.9rem) for outer container padding to provide "breathing room."
*   **Hover State:** Change row background to `surface-container-high`.

### Buttons
*   **Primary:** Signature Gradient (Primary to Secondary Container), `rounded-md` (0.375rem), white text.
*   **Secondary:** `surface-container-highest` background with `secondary` text. No border.
*   **Tertiary:** Ghost style. `on-surface-variant` text, appearing on a `surface-variant` background only on hover.

### Input Fields
*   **Style:** `surface-container-lowest` background with a `Ghost Border`. 
*   **Focus State:** The border transitions to 100% opacity `secondary` (#0058bb) with a subtle glow effect (2px blur).

### Signature Component: The "Insight Card"
A custom component for AI-driven or critical data. It uses a `secondary_container` background with a subtle "Liquid Glass" shimmer (a 20% opacity white gradient overlay) to draw immediate professional attention.

---

## 6. Do’s and Don’ts

### Do:
*   **Use Asymmetry:** Place a large `display-sm` title off-center to create a premium, non-template look.
*   **Embrace White Space:** Use `spacing-16` (3.5rem) between major sections to let the "Liquid Glass" aesthetic breathe.
*   **Nesting over Bordering:** Always try to separate two areas by changing the `surface-container` level before reaching for a line.

### Don’t:
*   **Don't use pure black:** Use `primary` (#001736) or `on-surface` (#191c1e) for text to maintain the navy-toned sophistication.
*   **Don't use "Drop Shadows":** Avoid high-opacity, small-blur shadows that look like 2005-era web design.
*   **Don't crowd the margins:** Enterprise doesn't mean "cramped." Use the `Spacing Scale` to maintain an expensive feel.

---

## 7. Spacing & Radius Summary
*   **Standard Radius:** `rounded-md` (0.375rem) for most enterprise components (Inputs, Buttons).
*   **Container Radius:** `rounded-xl` (0.75rem) for main dashboard cards to soften the professional edge.
*   **Base Unit:** 0.2rem (`spacing-1`). All layouts should follow a multiple of 0.2rem/0.4rem to ensure mathematical harmony across dense data sets.