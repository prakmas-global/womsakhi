# WomSakhi Knowledge Base

An Obsidian vault that lives inside the repo, at `PRAKMAS-GLOBAL/womsakhi/`. It
is versioned with the code it describes, so it cannot quietly rot in a wiki
nobody opens.

**Entry point: [[Home]].**

If Obsidian is showing an almost-empty graph, you are looking at a different
vault. *Open folder as vault* → `PRAKMAS-GLOBAL/womsakhi`.

## How this is written

Two rules, and they matter more than the folder structure.

**One idea per note.** A note is named after the idea, not the file it lives in.
`Fractions not pixels` is a note. `layout.py` is not. Ideas get linked from many
places; files get linked from one. If you find yourself writing "and also" in a
note, that's a second note.

**Explain the mechanism, not the conclusion.** "We use CSS variables for
theming" is worthless — you can see that from the code. "Tailwind v4 compiles
`.bg-brand-600` down to `background-color: var(--color-brand-600)`, so the
utility *references* the variable rather than baking the hex in, which means
overwriting 54 variables at runtime recolours 929 usages with no rebuild and no
React re-render" is the note. The second one tells you what happens if you touch
it.

Corollary: **write down what surprised you.** The ADRs here are mostly records
of being wrong about something. That's the useful part. A note that only
restates the code is worse than no note, because it will drift and then lie.

## Structure

Folders are storage; **[[Home]] is the map**. Navigate by links, not the file
tree.

```
decisions/    numbered ADRs — the why. append-only.
modules/      one note per product area
engines/      the portable subsystems
operations/   how to run, test, and not break it
reference/    data model, API surface, glossary
```

ADRs are **append-only**. To change your mind, write a new one that supersedes
the old. The wrong turn is the valuable part of the record — delete it and the
next person takes the same wrong turn.

## Never put credentials here

This vault is committed to the repository. See [[Secrets]].
