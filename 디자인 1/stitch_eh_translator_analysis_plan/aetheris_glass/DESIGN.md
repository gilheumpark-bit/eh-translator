# Design System Specification: The Celestial Prism

## 1. Overview & Creative North Star
The design system for NTE (Narrative Translation Engine) is built upon the Creative North Star of **"The Celestial Prism."** 

We are moving away from the static, grounded nature of traditional web interfaces toward a weightless, multi-dimensional experience. The interface does not sit "on" the screen; it drifts within a vacuum. By utilizing intentional asymmetry, overlapping crystalline surfaces, and extreme typographic contrast, we create an editorial feel that suggests high-intelligence automation and ethereal precision. Every element should feel as though it is held in place by a gentle magnetic field rather than a rigid grid.

## 2. Colors & Tonal Architecture
The palette is rooted in the depths of space, utilizing high-chroma violets and crystalline whites to punctuate a deep indigo void.

*   **Primary (#cabeff) & Secondary (#dab9ff):** These represent the "Nebula" energy. Use these for interactive focal points and active states.
*   **Surface Hierarchy (The Depth Engine):** We abandon flat backgrounds. 
    *   Base Layer: `surface` (#131318).
    *   Low-Level Containment: `surface-container-low`.
    *   Active Floating Elements: `surface-container-high`.
*   **The "No-Line" Rule:** Direct 1px solid borders are strictly prohibited for defining layout sections. Boundaries must be established through color shifts between surface tiers (e.g., a `surface-container-lowest` card sitting on a `surface-container-low` background) or through the "Ghost Border" mentioned in Section 4.
*   **Signature Textures:** Main CTAs and Hero headers should utilize a subtle linear gradient transitioning from `primary` to `primary-container`. This depth mimics the refraction of light through a crystal, providing a "soul" that flat hex codes cannot achieve.

## 3. Typography: The High-Tech Editorial
We use **Manrope** exclusively. Its geometric foundations provide the "high-tech" feel required for a Translation Engine, while its open apertures maintain legibility in translucent environments.

*   **Display & Headline:** Use `display-lg` (3.5rem) for hero moments. Apply a slight negative letter-spacing (-0.02em) to create an authoritative, "locked-in" feel.
*   **The Hierarchy of Truth:** Contrast is our primary tool. Use `display-md` for headers immediately adjacent to `body-sm`. This extreme scale jump eliminates the "template" look and creates a bespoke, editorial rhythm.
*   **Labels & Metadata:** `label-md` and `label-sm` should be used with 0.05em letter-spacing and uppercase styling when used for technical data points, reinforcing the "engine" aesthetic.

## 4. Elevation & Depth: Anti-Gravity Physics
Depth in this design system is not a visual flourish; it is the primary functional affordance.

*   **The Layering Principle:** Treat the UI as a series of physical layers. Place a `surface-container-lowest` element inside a `surface-container-high` container to create a "recessed" look, or vice-versa to create "lift."
*   **Ambient Shadows:** For floating cards, use a multi-layered shadow approach. 
    *   *Inner Shadow:* 0px 2px 4px rgba(228, 225, 233, 0.04).
    *   *Outer Ambient:* 0px 20px 40px rgba(19, 19, 24, 0.4).
    *   Shadows should never be pure black; they must be tinted with the `background` color to ensure they feel like natural light occlusion.
*   **Glassmorphism (The Translucent State):** Floating panels must use `backdrop-filter: blur(20px)` and a background color of `surface` at 60% opacity. 
*   **The "Ghost Border":** To simulate crystalline edges, use a 1px border with the `outline-variant` token, but reduce its opacity to 15%. This creates a luminous "shimmer" at the edge of the glass without creating a hard structural line.
*   **Anti-Gravity Interaction:** On hover, elements should translate -8px on the Y-axis. Simultaneously, the shadow blur should increase by 50% and the `outline-variant` opacity should increase to 40%, simulating the element moving closer to the user and catching more light.

## 5. Components

### Buttons
*   **Primary:** A "Nebula" gradient (`primary` to `secondary`). No border. Roundedness: `full`.
*   **Secondary (Glass):** `surface-container-highest` at 40% opacity with `backdrop-blur(12px)`. Use a `Ghost Border`.
*   **Interaction:** On hover, apply a `primary` outer glow (4px spread, 20% opacity) to simulate energy activation.

### Floating Cards
*   Cards must never use dividers. 
*   Separate content using `spacing-6` (2rem) or `spacing-8` (2.75rem). 
*   Internal sections should be defined by a shift from `surface-container-high` to `surface-container-low`.

### Narrative Nodes (NTE Specific)
*   For visualizing translation data, use "Nodes"—small `secondary-container` circles with a high-glow `secondary` center. 
*   Connecting lines should be `outline-variant` at 10% opacity, utilizing a dashed stroke to suggest motion.

### Input Fields
*   **State:** Default state is a `surface-container-lowest` fill with no border.
*   **Active State:** The background remains, but a `Ghost Border` at 30% opacity appears, and the `label-sm` transitions to `primary` color.

### Tooltips & Overlays
*   Must use the highest tier of glassmorphism. `surface-bright` at 80% opacity with `backdrop-blur(32px)`. This ensures they "cut through" the visual noise of the layers beneath them.

## 6. Do’s and Don’ts

**Do:**
*   Use `spacing-12` and `spacing-16` to create vast "dead zones" of whitespace, emphasizing the zero-gravity feel.
*   Overlap elements (e.g., a floating image slightly breaking the boundary of its container) to enhance the sense of depth.
*   Use `primary-fixed-dim` for text on dark backgrounds to reduce eye strain while maintaining the violet tint.

**Don’t:**
*   **No Hard Dividers:** Never use a solid line to separate two pieces of content. Use whitespace.
*   **No Pure Black:** Avoid #000000. Use `surface-container-lowest` (#0e0e13) for the deepest blacks to maintain the "Deep Space Indigo" tone.
*   **No Sharp Corners:** All floating elements must use at least `md` (0.75rem) or `lg` (1rem) corner radius to feel organic and ethereal. Avoid `none` (0px) except for full-screen edge-to-edge containers.