---
status: stable
updated: 2026-08-15
tags: [idea, theming, css]
---

# Tokens reference variables, so themes are free

The whole [[Theme engine]] rests on one property of Tailwind v4, and if you
don't know it the design looks impossible.

Write `@theme static` in the stylesheet and Tailwind compiles a utility to this:

```css
.bg-brand-600 { background-color: var(--color-brand-600); }
```

Note what it did **not** do. It did not bake `#d21f7c` into the rule. The class
holds a *reference*. Which means the colour is decided at paint time by whatever
`--color-brand-600` currently is — and that is a thing you can overwrite from
JavaScript in one line:

```js
document.documentElement.style.setProperty("--color-brand-600", "#0f766e");
```

Every `.bg-brand-600` in the document turns teal. Immediately.

## Why this is a big deal

Count the alternatives.

- **Ship a stylesheet per theme.** 8 presets × the whole utility surface. And
  custom colours are impossible — you can't pre-build a stylesheet for a hex the
  user hasn't picked yet.
- **Thread colour through React props.** Every component takes a `color`. 900+
  call sites. Every new component is a chance to forget.
- **Overwrite the variables.** 54 properties. One `setProperty` loop. Zero React
  re-renders, because the browser is doing the work, not the reconciler.

The current count: **54 variables** controlling **929 utility usages**. That
ratio is the entire argument.

## The part that surprised me

SVG resolves `var()` inside *attributes*, not just CSS properties. So a chart
can be written:

```jsx
<Bar fill="var(--color-brand-600)" />
```

No hook, no context, no re-render on theme change. I assumed this needed a
`useThemeColor()` and wrote one before testing whether it was necessary. It
wasn't. Charts recolour by the same mechanism as everything else.

## What this rules out

You may not hardcode a brand hex anywhere. Two real bugs came from breaking it:

- `.dark .text-brand-600 { color: #f272b0 }` — a hardcoded pink that overrode
  every theme in dark mode. Now `var(--color-brand-300)`.
- Button shadows at `rgba(210,31,124,0.55)`. Now
  `color-mix(in srgb, var(--color-brand-600) 55%, transparent)`.

Both were invisible in light mode with the default theme, which is exactly the
configuration you develop in. See [[Testing]] for why the theme sweep exists.

Related: [[ADR-002 Theme via CSS variables, not classes]], [[Derive, never store what you can compute]]
