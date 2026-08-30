---
status: stable
updated: 2026-08-17
tags: [idea, accessibility, css]
---

# Where am I

Before this, exactly **one** thing in the app showed keyboard focus: `.btn`.

Thirty-four files set `outline-none` — which is simply how you make a text field
look right — and nothing put a focus style back. So tabbing through the admin
left no visible trace at all. Focus was real, and moving, and invisible. A
keyboard user had no way to tell where Enter would land.

## One rule, not thirty-four decisions

```css
a:focus-visible, button:focus-visible, … {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}
```

Defined once, for everything interactive, rather than asked of each component —
the same reasoning as [[ADR-013 Colour only ever comes from a token]]. A component that
*wants* its own ring uses a `focus-visible:` utility, which scores higher and
wins. This is a floor, not an override.

## Three details that carry the whole thing

**`:focus-visible`, not `:focus`.** A mouse click does not draw it. Only
keyboard navigation does. That distinction is the reason designers started
removing focus rings in the first place, and the reason they no longer need to.

**`outline-offset: 2px`.** The ring sits *outside* the control. Without the
offset, a brand-coloured outline on a brand-coloured button is invisible —
correct in code, absent to the eye.

**The colour is `--color-brand-ink`.** That token is already solved for 4.5:1
against every surface in the theme, in both modes. Reusing it means the focus
ring inherits that proof rather than needing its own — one colour, already
checked, across all 16 theme/mode combinations. See
[[Tokens reference variables, so themes are free]].

## Reaching content at all

The admin rail is twenty-odd links, repeated identically on all 76 screens.
Without a skip link, reaching the first thing on the page means tabbing past
that entire list, on every navigation, forever.

`SkipToContent` is positioned off-screen until focused — **not** `display: none`,
because a hidden element is not focusable, so the usual way of hiding it would
also disable it.

Related: [[A label that points at nothing]], [[The check that runs in a second]]
