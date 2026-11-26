## Anti-Generic Guardrails
- Colors: Never use default Tailwind palette (indigo-500, blue-600). Pick a custom brand color and derive from it.
- Shadows: Never use flat shadow-md. Use layered, color-tinted shadows with low opacity.
- Typography: Never use the same font for headings and body. Pair a display/serif with a clean sans. Apply tight tracking (-0.03em) on large headings, generous line-height (1.7) on body.
- Gradients: Layer multiple radial gradients. Add grain/texture via SVG noise filter for depth.
- Interactive states: Every clickable element needs hover, focus-visible, and active states. No exceptions.
- Spacing: Use intentional, consistent spacing tokens - not random steps.
- Depth: Surfaces should have a layering system (base -> elevated -> floating).
- No AI clichés: Avoid fake 01/02/03 numbering (unless truly sequential) and oversized metric numbers with gradient captions.

## Animation, Performance & Accessibility Rules
- Minimalism: Build ONLY ONE staged motion scene (usually on the first screen). Keep other sections static unless asked.
- Properties: Only animate `transform` and `opacity`. Never `transition-all` or layout properties (top/left/width/height). Do not scatter `will-change`.
- LCP Safety: NEVER set `opacity: 0` as the starting state for the hero/first screen (it breaks LCP). Start from non-zero opacity or animate only `transform` on the hero.
- Timing & Scroll: Keep durations between 100ms and 400ms (use spring-style easing, never default to 1s). Never implement scrolljacking.
- Reduced Motion & WCAG 2.2.2: Always implement `@media (prefers-reduced-motion: reduce)` in CSS AND duplicate it in JS (`window.matchMedia` / `gsap.matchMedia()`). Any auto-moving element lasting >5s (marquees, carousels) must have a pause/stop control.
- React: Always bind and clean up animations on unmount/rerender.