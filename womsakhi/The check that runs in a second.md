---
status: stable
updated: 2026-08-17
tags: [idea, testing]
---

# The check that runs in a second

The browser sweep drives ~230 page loads through six Chrome instances and takes
about **ten minutes**. That is the right price before calling a section
finished. It is the wrong price while you are in the middle of finishing it.

A check you hesitate to run stops catching things — and that is worse than
having no check, because *you still believe it is watching*.

So the rules that can be read off the source run separately:

```
✓ tokens   every colour comes from a token · 178ms
✓ a11y     every control has a name        · 70ms
✓ types    the types agree                 · 3821ms

all 3 pass in 4070ms
```

Ten minutes → four seconds. Same rule, different evidence.

## The two are not interchangeable

`checks/a11y.mjs` reads the source. `checks/screens.mjs` reads the rendered
page. The static one is **deliberately conservative**: it reports only what it
can prove and stays quiet where it cannot tell. A clean run there proves the
source is consistent — *not* that the app renders correctly.

The split is honest about which is the authority. The browser is.

## It was wrong twice, in opposite directions

**Too eager.** It read prose as markup — the sentence "Deliberately NOT a
native `<select>`" inside a doc comment was reported as an unlabelled control.
Three of its first findings were sentences *about* code rather than code. Fixed
by blanking comments while preserving character positions, so line numbers still
point at the right place.

It also flagged `<button><StatCard label="Upcoming" /></button>` — treating a
component that renders plenty of text as decoration. Fixed by reading each
file's lucide imports, so only names actually imported as icons count as icons.

**Too timid.** Skipping any button containing a `<span>` let **138 real cases**
through — the toggle switches, whose markup is two nested empty spans styled
into a track and a knob. The browser sweep caught what the static check had
excused.

That asymmetry is the lesson. A fast check earns its place by being trusted,
and it is only trustworthy if you know which way it errs — and keep a slower,
truer one behind it.

Related: [[Testing]], [[A label that points at nothing]], [[Where am I]]
