# Design System Specification: Narrative Intelligence

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Liquid Observer."** 

In an era of flat, rigid interfaces, this system moves toward a hyper-professional, high-tech editorial aesthetic. It is designed to feel less like a "tool" and more like a sophisticated engine. We break the standard "dashboard" layout through the use of **Intentional Depth Layers** and **Asymmetric Balance**. 

Instead of a traditional grid, we lean into a "HUD" (Heads-Up Display) philosophy—where the most critical narrative data floats atop a vast, deep navy void. This is not just a dark mode; it is a cinematic environment that uses light and translucency to guide the eye toward AI-driven insights.

---

## 2. Colors: The Depth Palette
Our palette transitions from the abyss of space to the electric pulse of intelligence.

### Core Tones
*   **Background:** `#000e25` (The Foundation)
*   **Primary (Electric Blue):** `#84adff` (Interactive & Active)
*   **Secondary:** `#7e98ff` (Supportive Narrative)
*   **Tertiary (Neon Pulse):** `#fab0ff` (AI Status & Translation Highlights)

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders for sectioning content. Visual boundaries must be defined solely through background color shifts. 
*   Place a `surface-container-low` section against a `surface` background. 
*   Use `surface-container-highest` only for the most critical floating elements.

### The "Glass & Gradient" Rule
To achieve the "Liquid Glass" aesthetic, all modal overlays and floating panels must use **Glassmorphism**:
*   **Fill:** `surface_variant` at 40-60% opacity.
*   **Backdrop Blur:** 12px to 20px.
*   **Signature Texture:** Main Action buttons should utilize a subtle linear gradient from `primary` (#84adff) to `primary_container` (#6c9fff) at a 135-degree angle to provide a metallic, high-end sheen.

---

## 3. Typography: The Editorial Engine
We use **Manrope** for its technical precision and modern geometric forms.

*   **Display (Scale: 3.5rem - 2.25rem):** Reserved for high-impact metrics or narrative titles. Use **Bold (700)** weight with -2% letter spacing to create an authoritative, "big-brand" feel.
*   **Headlines (Scale: 2rem - 1.5rem):** Use **Bold (700)**. These should act as anchors for the page, often paired with a `primary` color accent.
*   **Titles & UI (Scale: 1.375rem - 1rem):** Use **Medium (500)**. This is the workhorse of the interface, providing clarity without the "heaviness" of body text.
*   **Body (Scale: 1rem - 0.75rem):** Use **Medium (500)**. In a dark environment, Medium weight prevents "ink bleed" and ensures high legibility against navy backgrounds.

---

## 4. Elevation & Depth: Tonal Layering
Traditional shadows are too "web 2.0." We define hierarchy through the **Layering Principle**.

### Surface Hierarchy
1.  **Level 0 (The Void):** `surface` (#000e25). Global background.
2.  **Level 1 (The Canvas):** `surface-container-low`. Used for large content areas.
3.  **Level 2 (The Card):** `surface-container`. Used for individual narrative blocks.
4.  **Level 3 (The Pop-over):** `surface-container-highest`. Used for floating menus.

### The Ambient Shadow
When a "floating" effect is required (e.g., a critical AI notification), use an **extra-diffused shadow**:
*   **Blur:** 40px - 60px.
*   **Opacity:** 15%.
*   **Color:** Use `surface_tint` (#84adff) instead of black to create a "blue-glow" ambient light effect.

### The "Ghost Border" Fallback
If a separation is required for accessibility, use a **Ghost Border**:
*   **Token:** `outline_variant` (#354869).
*   **Opacity:** Max 20%. It should be felt, not seen.

---

## 5. Components: Precision Primitives

### Buttons (Liquid State)
*   **Primary:** Gradient fill (Primary to Primary-Container), `xl` (0.75rem) rounding. Text: Manrope Bold.
*   **Secondary:** Ghost style. No background, `outline` token at 40% opacity.
*   **AI Action:** Tertiary color (#fab0ff) with a 4px "Neon Glow" (`drop-shadow`) in the same color.

### Input Fields
*   **Style:** No bottom line. Use `surface_container_low` as a subtle fill.
*   **Focus State:** The background shifts to `surface_container_high` with an `outline` glow of 1px at 50% opacity.
*   **Roundness:** `DEFAULT` (4px) for high-density technical input.

### Status Indicators (Neon Pulse)
For AI status (Translating, Analyzing, Complete):
*   Do not use flat dots. Use a 12px circular element with a **2-step radial gradient** and a CSS "pulse" animation to mimic a breathing engine.

### Cards & Narrative Lists
*   **Forbid Dividers:** Do not use lines between list items. Use `spacing-4` (1rem) or `spacing-6` (1.5rem) to create separation through white space.
*   **Asymmetry:** In cards, align titles to the top-left and metadata (language codes, timestamps) to the bottom-right to break the "boxed" feel.

---

## 6. Do’s and Don’ts

### Do:
*   **Do** use `secondary_container` for subtle "active" backgrounds behind icons.
*   **Do** leverage `backdrop-filter: blur()` on all floating navigation bars to maintain the "Liquid Glass" theme.
*   **Do** use `on_surface_variant` (#98acd2) for helper text to create a natural hierarchy with the brighter `on_surface` content.

### Don't:
*   **Don't** use pure white (#FFFFFF) for text. Always use `on_surface` (#dbe6ff) to reduce eye strain in dark mode.
*   **Don't** use 90-degree sharp corners. Everything must adhere to the `xl` (8px) for containers and `DEFAULT` (4px) for elements scale to feel "approachable-tech."
*   **Don't** use standard "drop shadows" on cards; if the tonal shift between `surface-container-low` and `surface-container-high` isn't enough, increase the contrast of the background, not the shadow.