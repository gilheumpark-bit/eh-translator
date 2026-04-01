# Design System Strategy: Crystalline Architecture

### 1. Overview & Creative North Star
The Creative North Star for this design system is **"Crystalline Architecture."** 

Unlike traditional enterprise platforms that rely on rigid grids and heavy borders, this system treats the UI as a high-end editorial space defined by light, refraction, and weightlessness. We are moving away from "boxed-in" layouts toward an "anti-gravity" feel. Elements should appear as if they are precision-cut shards of glass floating over a vast, illuminated landscape. 

By leveraging intentional asymmetry—such as oversized display type paired with generous, unconventional white space—we break the "template" look. This creates a signature experience that feels bespoke, authoritative, and innovative.

---

### 2. Colors & Tonal Logic
This palette is rooted in a professional, "Glacial" spectrum. We use deep blues to anchor the eye and a range of translucent whites to define the structure.

*   **Primary (#003d9b) & Primary-Container (#0052cc):** These are our "Active Light." They should be used sparingly for high-intent actions and critical brand moments.
*   **Surface (#f7f9fb):** Our base environment. It is not quite white, providing a soft canvas that allows pure white floating elements to "pop."
*   **The "No-Line" Rule:** We strictly prohibit the use of 1px solid borders for sectioning or containment. Boundaries must be defined solely through background color shifts. For example, a `surface-container-low` section should sit directly on a `surface` background to create a visible but soft distinction.
*   **Surface Hierarchy & Nesting:** Treat the UI as a physical stack.
    *   **Base:** `surface`
    *   **Level 1 (Sections):** `surface-container-low`
    *   **Level 2 (Cards/Modules):** `surface-container-lowest` (Pure White)
*   **The "Glass & Gradient" Rule:** To achieve a "soulful" enterprise look, use linear gradients for primary buttons transitioning from `primary` to `primary_container`. For floating overlays (menus, tooltips), use a semi-transparent `surface` color with a `backdrop-blur` of 12px–20px.

---

### 3. Typography: The Manrope Identity
We use **Manrope** for its geometric balance and modern professional tone. The hierarchy is designed to feel editorial and high-contrast.

*   **Display (lg/md/sm):** Use these for hero moments. They should feel authoritative. Don't be afraid to use `display-lg` (3.5rem) with tight letter-spacing to create a "Crystalline" focal point.
*   **Headline & Title:** These serve as the structural anchors. Bold weights are preferred to maintain clarity against the soft, glass-like backgrounds.
*   **Body (lg/md/sm):** Set in `on-surface-variant` (#434654) for long-form reading to reduce eye strain, while using `on-surface` (#191c1e) for critical data points.
*   **Labels:** Always uppercase with slight letter-spacing (0.05rem) when used for categories or small metadata to ensure they don't get lost in the minimalism.

---

### 4. Elevation & Depth: Anti-Gravity
Depth in this system is achieved through light and layering, not heavy shadows.

*   **The Layering Principle:** Instead of a drop shadow, place a `surface-container-lowest` card on top of a `surface-container-low` background. The subtle shift from #ffffff to #f2f4f6 creates a natural, sophisticated lift.
*   **Ambient Shadows:** When an element must float (e.g., a Modal or FAB), use "Ambient Shadows." These are extra-diffused: `box-shadow: 0 12px 40px rgba(0, 61, 155, 0.06);`. Note the use of a tinted shadow (using a tiny fraction of the Primary color) to mimic natural light refraction.
*   **The "Ghost Border" Fallback:** If a container requires more definition for accessibility, use the `outline-variant` (#c3c6d6) at **15% opacity**. This creates a "breath" of a line rather than a hard edge.
*   **Glassmorphism:** Apply to navigation bars and sidebars. Use a background of `rgba(255, 255, 255, 0.7)` combined with a 20px blur. This ensures the "Glacial" theme feels integrated as the user scrolls.

---

### 5. Components

*   **Buttons:**
    *   **Primary:** A gradient from `primary` to `primary_container`. Corner radius: `md` (0.375rem).
    *   **Secondary:** No background, `outline-variant` ghost border (15% opacity), and `primary` text.
    *   **Tertiary:** Purely text-based with `label-md` styling.
*   **Cards:**
    *   Always use `surface-container-lowest` (#ffffff).
    *   Corner radius: `xl` (0.75rem) for a premium, friendly feel.
    *   **Strict Rule:** No dividers. Use `spacing-6` (2rem) to separate internal content blocks.
*   **Input Fields:**
    *   Background: `surface-container-high` (#e6e8ea). 
    *   Focus State: Transitions to a `primary` ghost border (20% opacity) and a soft ambient glow.
*   **Chips:**
    *   Use `full` (9999px) roundedness. 
    *   Background: `secondary_container` (#b6c8fe) with `on-secondary-container` (#415382) text.
*   **Lists:**
    *   Forbid divider lines. Separate list items using a background hover state of `surface-container-highest` (#e0e3e5) and `spacing-2` (0.7rem) of vertical padding.

---

### 6. Do's and Don'ts

**Do:**
*   **Do** use asymmetrical margins (e.g., a wider left margin for headlines) to create a premium editorial feel.
*   **Do** use `spacing-12` (4rem) and `spacing-16` (5.5rem) to let high-level sections breathe.
*   **Do** ensure all "glass" elements have sufficient backdrop-blur to maintain text legibility (WCAG 2.1 compliance).

**Don't:**
*   **Don't** use 1px solid borders to separate sections of a page.
*   **Don't** use pure black (#000000) for text; always use `on-surface` (#191c1e) to keep the "Glacial" softness.
*   **Don't** use standard "drop shadows" (e.g., 0px 2px 4px black). If it doesn't look like light passing through ice, it's too heavy.
*   **Don't** crowd the layout. If in doubt, increase the spacing by one tier on the scale.