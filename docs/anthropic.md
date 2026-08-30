# Anthropic / Claude — WomSakhi

The language model behind **Sakhi**, the assistant.

> **The key is NOT in this file.** It lives in
> `womencrafts-backend/backend/.env`, which is git-ignored. This file records
> everything else so anyone can find and manage it without handling the secret.

---

## The account

| | |
|---|---|
| **Console** | platform.claude.com |
| **Account** | praveen (Admin) |
| **Key name** | `womsakhi-dev` |
| **Credits** | $20 purchased 14 Aug 2026 (expire after 1 year) |
| **Auto-reload** | OFF during development — deliberately |
| **Verified** | ✔ live call returned a reply on 14 Aug 2026 |

**Why auto-reload is off:** in production you want it on, so Sakhi never goes
silent mid-conversation. While building, a runaway loop that silently recharges
a card is worse than one that stops and tells you. Turn it on at launch.

**Spend limit:** set in Settings → Limits. The code also enforces its own
ceiling — two independent locks, because one can be misconfigured.

---

## Models and why each is used

| Model | ID | Used for |
|---|---|---|
| **Haiku 4.5** | `claude-haiku-4-5-20251001` | Intent routing, classification, short replies. Fast and cheap. |
| **Opus 5** | `claude-opus-5` | Real reasoning, multi-step tool use, anything sensitive. |
| **Sonnet 5** | `claude-sonnet-5` | Middle ground if Opus proves more than needed. |

**The routing rule:** Haiku decides what she's asking for; Opus only runs when
genuine reasoning is required. That's typically a 5–10× cost reduction with no
quality loss where it matters, because most turns in a booking conversation are
simple.

**Prompt caching** is enabled for the system prompt and tool definitions. An
agent re-sends those on every single turn, so caching them cuts input cost
dramatically (Anthropic quotes 50–90% for this pattern).

---

## Cost baseline

First verified call: 17 input + 9 output tokens on Haiku ≈ **$0.000062**.

Once Langfuse is wired, the number that actually matters will be **cost per
member conversation**. Multiply by expected members for a real monthly budget
instead of a guess.

Watch it at: platform.claude.com → Dashboard → Spend this month.

---

## Safety rules baked into the implementation

1. **The model never holds permissions.** Sakhi calls the same
   ownership-scoped `/me/*` endpoints the member's own screens use, with her
   session. Prompt injection therefore buys an attacker nothing — the
   permission check sits below the model, not in its instructions.
2. **Crisis handling is not the model's job.** Disclosures of abuse, violence
   or self-harm are detected before the model answers and routed to a human.
   An LLM must never improvise there.
3. **She always knows it's an assistant.** Sakhi is warm, but never implies she
   is a human counsellor.
4. **Nothing changes without her confirmation.** The agent proposes; the member
   taps yes. Especially for money and calendar.
5. **Conversations are personal data** — retention policy, and never used for
   training.

---

## If the key leaks

1. platform.claude.com → **API keys** → delete `womsakhi-dev`
2. Create a replacement, update `.env`, restart the backend
3. Check **Dashboard → Spend** for unexpected usage

Keep separate keys for development and production — never share one.

---

## Related

- `docs/azure-speech.md` — her voice and lip-sync visemes
- `app/core/matching.py` — the deterministic matcher the model replaces,
  kept as a fallback for when the model is slow or unavailable
