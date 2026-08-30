---
status: stable
updated: 2026-08-15
tags: [idea, layout, ux]
---

# Cannot trap yourself

The invariant that constrains every control in the [[Layout engine]]:

> **No sequence of customisations may leave the user unable to undo them, using
> only what is on screen.**

Customisation hands the user controls that can make the app worse. That's fine —
that's what customisation is. What is not fine is a state they cannot get out
of, because at that point their only remaining option is to stop using the
product.

## The failure modes this rules out

- **Hide every nav item**, including the one leading to settings. Now there's no
  route back to the screen that unhides things.
- **Collapse the sidebar to 0** and lose the handle that expands it. Hence
  `SIDEBAR_MIN = 64` — an icon-only rail, still draggable.
- **Drag a pane to 0** and lose the divider. Hence `PANE_MIN = 0.2`.
- **Hide the widget that contains the reset button.**
- **Set a chart to 0 tall** and lose its resize grip.

## Rules that follow

1. **Every minimum is above zero** and above the size of the control that
   reverses it. A 64px rail exists because the expand affordance has to live
   somewhere.
2. **Some things cannot be hidden.** Settings and the customise entry point are
   not hideable. Not "warn on hide" — not offered.
3. **Reset is reachable at three scopes**: this pane, this screen, everything.
   Global reset is reachable from the account menu, which is not customisable.
4. **Reset is never behind a customisable surface.** If the way to fix your
   layout is inside the thing you broke, it isn't a way out.

## Why this needs its own note

Each control looks safe alone. The trap is compositional — hide two items, then
collapse a rail, then resize a pane, and the exit disappears. It has to be
checked as a property of the *system*, which is why [[Testing]] carries a
dedicated cannot-trap-yourself suite that applies hostile combinations rather
than testing controls one at a time.

Related: [[Clamp on read, not on write]], [[Layout engine]]
