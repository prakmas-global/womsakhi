---
status: stable
updated: 2026-08-15
tags: [idea, layout, robustness]
---

# Clamp on read, not on write

Validating on write is the obvious move and it is not enough.

Write-time validation guarantees that *values written by the current version of
the code, through the current endpoint* are sane. That's a narrower guarantee
than it sounds. It says nothing about:

- rows written by an older build, before the limit existed
- rows written by a newer build, if a user is on two devices mid-deploy
- anything touched directly in Atlas during support
- a bug in a client that never hit the endpoint you're thinking of

Any of those and the user opens the app to a 900px sidebar swallowing a laptop
screen, with no way to drag it back because the drag handle is off-canvas.

So `LayoutModel.to_response()` clamps **every field, every read**:

```python
sidebar[bp] = int(clamp(float(value), SIDEBAR_MIN, SIDEBAR_MAX))
```

It also clamps on write. Both. Reading is the one that saves you.

## The upper bound matters as much as the lower

Easy to remember `SIDEBAR_MIN = 64` — don't let the rail vanish. Easy to forget
`SIDEBAR_MAX = 420` — don't let it eat the page. The failure mode of "too wide"
is worse than "too narrow", because a too-narrow sidebar still shows its own
drag handle and a too-wide one may not.

This is the same instinct as [[Cannot trap yourself]]: the user must always be
able to get back, using only what is on screen.

## Unparseable values are skipped, not defaulted

`continue`, not `= DEFAULT`. If a row holds `"wide"` where a number belongs, the
key simply doesn't appear in the response and the component falls through to its
own default. Substituting a default would silently manufacture an opinion the
user never expressed.

Related: [[Fractions not pixels]], [[Layout engine]]
