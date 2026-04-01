# Design System Specification: Liquid Glass Editorial

## 1. Overview & Creative North Star

### Creative North Star: "The Intelligent Prism"
This design system moves beyond the rigid, utilitarian structures of standard translation tools to create an experience that feels both authoritative and ethereal. We are moving away from "software" and toward a "digital workspace" that treats text as a living element.

The hallmark of this system is **intentional asymmetry** and **tonal depth**. Rather than boxing content into a predictable 12-column grid, we utilize generous negative space and overlapping "Liquid Glass" surfaces to create a sense of focus. High-contrast typography scales—mixing the functional `inter` with the editorial `manrope`—ensure that while the interface feels high-end, the utility remains uncompromised.

---

## 2. Colors: Tonal Depth & Liquid Glass

The palette is anchored in professional deep blues (`primary: #003d9b`) and pristine surfaces (`surface: #f6fafe`). The goal is to convey trust through color while using material properties to convey modernism.

### The "No-Line" Rule
Traditional 1px solid borders are strictly prohibited for defining layout sections. Boundaries must be established through:
- **Background Shifts:** Placing a `surface-container-low` section against a `surface` background.
- **Tonal Transitions:** Using the hierarchy of container tokens to define edge cases.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Use the Material tokens to "stack" depth:
1.  **Base Layer:** `surface` (#f6fafe) – The global background.
2.  **Section Layer:** `surface-container-low` (#f0f4f8) – Secondary utility areas.
3.  **Active Component Layer:** `surface-container-lowest` (#ffffff) – Primary content cards and input modules.

### The "Liquid Glass" Rule
For floating elements (Command-K bars, contextual translation popovers, or floating action menus), use a backdrop-blur effect (minimum 12px) paired with 80% opacity versions of `surface-container-lowest`. This creates a "frosted glass" effect that allows the underlying translation context to bleed through, softening the interface.

### Signature Textures
Main CTAs and AI-verified states should utilize subtle linear gradients (e.g., `primary` to `primary-container`) with a 135-degree angle. This prevents the "flat-box" aesthetic and adds a premium, "intelligent" shimmer to AI-driven actions.

---

## 3. Typography: Editorial Clarity

Typography must account for the **40% expansion rule** common in multi-language translation (e.g., English to German).

*   **The Display Duo:** Use `manrope` for all `display` and `headline` tokens. This sans-serif has an editorial, wide-tracking feel that communicates sophistication.
*   **The Workhorse:** Use `inter` for all `title`, `body`, and `label` tokens. Inter’s tall x-height ensures legibility even when text density increases during translation.
*   **The Semantic Scale:**
    *   **Headline-LG (`manrope`, 2rem):** Used for primary section headings.
    *   **Body-MD (`inter`, 0.875rem):** The default for translated text strings.
    *   **Label-SM (`inter`, 0.6875rem):** Used for metadata like "AI-Verified" or "Source: English."

---

## 4. Elevation & Depth

This system avoids the "pasted-on" shadow look. We use **Tonal Layering** to create a natural, ambient lift.

*   **The Layering Principle:** Place a `surface-container-lowest` card on top of a `surface-container-low` background to create a soft, natural lift without a single drop shadow.
*   **Ambient Shadows:** For floating modules (Command-K), use an extra-diffused shadow: `box-shadow: 0 20px 40px rgba(23, 28, 31, 0.06);`. The shadow color must be a tinted version of `on-surface` (#171c1f) at very low opacity to mimic natural light.
*   **The Ghost Border Fallback:** If high-contrast accessibility is required, use a "Ghost Border": `outline-variant` (#c3c6d6) at 20% opacity. 100% opaque borders are forbidden.
*   **Backdrop Blur:** All overlays must implement `backdrop-filter: blur(16px)` to integrate the glass component into the environment.

---

## 5. Components

### The Command Bar (Command-K)
A centered, floating `Liquid Glass` module.
- **Background:** `surface-container-lowest` at 85% opacity + 20px backdrop blur.
- **Border:** 1px "Ghost Border" at 10% opacity.
- **Typography:** Uses `title-md` for the input field.

### Buttons
- **Primary:** Gradient fill (`primary` to `primary-container`), `XL` (0.75rem) roundedness, and `on-primary` text.
- **Secondary:** Transparent background with a `surface-tint` 1px ghost border. 
- **States:** On hover, primary buttons should increase their shadow diffusion rather than changing color.

### Contextual Translation Modules
For comparing 'AI-verified' vs 'Generated' content:
- **AI-Verified:** Uses a subtle `secondary_container` (#8df5e4) background glow.
- **Generated:** Uses `surface-container-highest` (#dfe3e7) with a slight desaturation.
- **Separation:** No dividers. Use `spacing-8` (2rem) of white space between original and translated blocks.

### Input Fields
- **Container:** `surface-container-low` with `md` roundedness.
- **Focus State:** Transition background to `surface-container-lowest` and add a 2px `primary` bottom-bar only (no full-box stroke).

---

## 6. Do's and Don'ts

### Do
*   **DO** use white space as a structural element. If two elements feel too close, use the `spacing-12` (3rem) token before reaching for a divider line.
*   **DO** ensure that translated text expansion is tested using the `body-md` scale; leave at least 40% "breathing room" in container widths.
*   **DO** use `tertiary` (#4c00c8) sparingly for "Intelligent" or "AI" features to separate them from standard UI actions.

### Don't
*   **DON'T** use 1px solid black or high-contrast grey borders. Use background tonal shifts.
*   **DON'T** use default "Drop Shadows." Only use the Ambient Shadow specification for floating glass elements.
*   **DON'T** mix `manrope` into body text. Keep `manrope` for headlines to maintain the editorial hierarchy.
*   **DON'T** use `error` (#ba1a1a) for anything other than critical system failures. For "Translation Warnings," use a softer tonal shift.