---
status: accepted
updated: 2026-08-22
tags: [adr, ai, safety, security]
---

# ADR-014 — An assistant may propose a change, never make one

**Status:** accepted · **Code:** `core/sakhi/engine.py`, `core/sakhi/tools.py`

## Decision

Sakhi's tools are split in two, in data, on the tool definition itself:

```python
ToolSpec(name="list_my_bookings", ...)                    # read  — runs at once
ToolSpec(name="book_session", ..., writes=True)           # write — stops and asks
```

A read runs the moment the model asks for it. A **write never runs inside the
turn that requested it.** The loop stops, the pending call is written to the
conversation, the stream ends, and the member is shown a sentence with two
buttons. Her answer arrives as a *separate HTTP request*, which resumes the loop
from that point.

## Why the round trip, and not an instruction

The obvious cheaper version is a line in the system prompt — *"always ask before
booking"*. That is a request, not a guarantee. It holds until the day a message
is phrased in a way that talks the model out of it, and the failure is silent:
something was booked, or cancelled, and nobody typed yes.

The round trip is a guarantee because **there is no code path from "model asked"
to "database changed" that does not pass through a second request carrying her
decision.** It cannot be talked out of, because the model is not the thing being
asked.

## Three details that carry the weight

**The sentence she reads is built from the database, not from the model.**
`tools.describe()` looks up the service, the booking, the programme by id and
formats the real name. If the model described the action loosely a moment
earlier, what she approves is still what the code is about to do.

**The action lives on the conversation, not in the request.** `/sakhi/confirm`
carries an id and a yes/no — nothing else. What runs is what was stored when she
was asked. A caller cannot say "she approved *this* instead".

**It is cleared before it runs.** A double tap, a retry, or a replayed request
finds nothing pending. Verified: an approval cannot be replayed to book twice,
and a declined action cannot be approved afterwards.

## Reads are deliberately not gated

Confirming a lookup would mean tapping yes so often that the yes stops meaning
anything — the [[Cannot trap yourself|same reasoning]] as elsewhere. Reads are
already scoped to her own account by
[[ADR-007 Ownership comes from the token]], so the worst a wrong read does is
answer a question she did not ask.

## A write anywhere in a turn stops the whole turn

The model can ask for several tools at once. If any of them writes, none of them
run — including the reads. Running the reads and holding the write back would
leave her approving one half of an action whose other half already happened.

## An unknown tool counts as a write

If the model ever names a tool that is not in the registry, `_is_write()`
returns `True`. The safe reading of "I do not know what this is" is "this might
change something".

Related: [[Sakhi]], [[ADR-007 Ownership comes from the token]], [[Safety]]
