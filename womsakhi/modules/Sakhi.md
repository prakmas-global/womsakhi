---
status: built
updated: 2026-08-22
tags: [module, ai]
---

# Sakhi — the assistant

**Status:** phases 0 and 1 built and verified. Voice, retrieval and the avatar
are not started.

An assistant for members — she reads her records, searches what is open to her,
and performs the operation rather than pointing at a menu. The manual screens
all remain: she is an addition to the product, never the only way through it.

## What exists

**The gateway** — `core/llm/`. A port (`base.py`), an Anthropic adapter
(`claude.py`), and a mock (`mock.py`). Nothing above that directory imports the
SDK or names a model. A blank `ANTHROPIC_API_KEY` is a supported configuration,
not an error: the mock answers, and every screen keeps working.

**The ledger** — `core/llm/usage.py`. Every turn's cost is computed from a price
table and written down; a monthly ceiling stops her before the account does.
Two locks, because either one can be misconfigured.

**The loop** — `core/sakhi/engine.py`, in a fixed order:

```
safety gate  ->  budget check  ->  model  ->  tools  ->  answer
```

**The tools** — `core/sakhi/tools.py`. Ten of them: six reads, four writes. The
write tools call the *real endpoint functions* — `book_session` calls
`me.create_booking`, the same coroutine the Book button reaches — so the
double-booking check, the notification and the price parsing exist once.
See [[Say it once, in one place]].

**The screen** — `/app/sakhi`, phone-first, translated into en/hi/ur.

## The three rules, and where each is actually enforced

| Rule | Enforced in |
|---|---|
| She only ever touches the caller's own data | no tool takes an id — [[ADR-007 Ownership comes from the token]] |
| She proposes a change, never makes one | the round trip — [[ADR-014 An assistant may propose a change, never make one]] |
| Distress reaches a person, not a model | the gate — [[ADR-015 The safety gate runs before the model, not after]] |

None of the three is a sentence in the prompt. The prompt explains them so her
answers make sense; the code guarantees them. An instruction is a request.

## Why the prompt has no name or date in it

The system prompt is cached, and caching is a **prefix match** — one varying
byte and every turn is billed at full price, silently, with nothing appearing to
break. Her name, her language and today's date ride as a first user message
instead. See `core/sakhi/prompt.py`.

## Verified

- `scratchpad/test_sakhi.py` — 26 checks at the API, including: nothing is
  written before she answers, an approval cannot be replayed to book twice, a
  declined action cannot be approved afterwards, another member gets 404 on her
  conversation, and a deleted conversation is really gone.
- `checks/sakhi.mjs` — the same rules on a 390px screen.

## Not started

Voice (Azure keys are live, unused), retrieval over the library, the staff
copilot, and the avatar. The **avatar route is still an open decision** — a
rigged 3D model driven by Azure visemes, versus a talking-photo service at a
per-minute cost forever.

Related: [[Member app]], [[Safety]], [[Third-party services]], [[Entitlements]]
