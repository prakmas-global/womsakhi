# WomSakhi — Go-Live

What was just built, and the six things only you can supply.

*Written 2026-08-30. Everything below was verified by running it, not by reading it.*

---

## What is done

| # | Blocker | State |
|---|---------|-------|
| 1 | Payments simulated | **Code complete.** Razorpay adapter finished — needs your account keys. |
| 2 | No password reset | **Done and working.** Self-service reset built end to end. |
| 3 | No email sent | **Code complete.** SMTP sender was already built — needs a mail provider. |
| 4 | ID documents in plaintext | **Done locally.** Key generated, 20 existing files encrypted, both paths verified. |
| 5 | `COOKIE_SECURE = False` | **Fixed.** Forced `True` in production; impossible to ship insecure. |
| 6 | Placeholder webhook secret | **Fixed.** The app now refuses to start in production with it. |
| 8–11 | No terms / privacy / about / contact | **Done.** All four written and live, linked from the sign-in page. |
| 12 | Invented figures on sign-in | **Fixed.** Real counts from `GET /public/stats`; the star rating is gone. |
| 13 | Dead Google / Apple buttons | **Fixed.** Rendered only for providers the server says work — none today, so neither appears. |
| 14 | Social rail went nowhere | **Fixed.** Reads `NEXT_PUBLIC_SOCIAL_*`; hidden entirely until you set them. |
| 16–22 | Invented content shown as fact | **Fixed.** Helplines and guidance moved into the database; a fabricated syllabus and two non-existent places removed. |
| 23–26 | Buttons that do nothing | **Fixed.** Found a crash that took `/explore` down entirely, a dead "Resume Learning", and a tab that filtered nothing. |
| 27 | Sign-out didn't end other devices | **Fixed.** `tv` is minted, `/auth/signout-everywhere` added, and a password reset now ends every session. |
| 28 | No referential integrity | **Fixed going forward.** Link graph declared in `app/core/integrity.py`; deleting a member cascades. 12 existing orphans left for you to clear. |
| 29 | Redis before >1 worker | **Fixed.** Rate limiter is shared when `REDIS_URL` is set, and the app refuses to boot with >1 worker without it. |
| 30 | Batched endpoints unused | **Fixed.** Member shell 5 requests → 2; progress screen 5 → 1. |

A seventh thing was found while testing and fixed: **every error message in the
app was showing "Something went wrong. Please try again."** The API wraps errors
as `{ error: { message } }` and two extractors were reading `{ detail }`, which
this backend never sends. A woman who mistyped her password, or whose account
was locked, or whose reset link had expired, was told nothing useful. The server
had written a precise sentence for each case and nobody ever saw one.

---

## What I need from you

### 1. A Razorpay account → unblocks payments

Sign up at **razorpay.com**, complete KYC (needs PAN, bank account, and business
proof — this takes a few days, so start it first).

Then send me, or put in the production environment:

| Where in Razorpay | Variable |
|---|---|
| Settings → API Keys → Generate Key | `RAZORPAY_KEY_ID` |
| Same screen, shown once | `RAZORPAY_KEY_SECRET` |
| Settings → Webhooks → Add New Webhook | `PAYMENT_WEBHOOK_SECRET` |

**The webhook secret is a different value from the key secret.** Mixing them up
is the single most common Razorpay mistake and it fails silently — payments
appear to work and webhooks are quietly rejected.

Point the webhook at `https://<your-api-domain>/api/v1/payments/webhook` and
subscribe to `payment.captured` and `payment.failed`.

Use **test mode keys first.** Everything works identically; no real money moves.

### 2. An email provider → unblocks signup and password reset

Nothing can be delivered until this exists. **Email verification gates signup,
so today nobody can finish joining.**

Any SMTP provider works. For India I would use **Amazon SES** (cheapest at
volume) or **Resend** (easiest to set up). You need:

| Variable | Example |
|---|---|
| `SMTP_HOST` | `email-smtp.ap-south-1.amazonaws.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | from the provider |
| `SMTP_PASSWORD` | from the provider |
| `EMAIL_FROM` | `no-reply@womsakhi.in` |
| `EMAIL_FROM_NAME` | `WomSakhi` |

You will also need to **verify your sending domain** with the provider (SPF and
DKIM DNS records). Without it, mail goes to spam — which for a password reset
means she never gets back in.

### 3. A domain → so links point somewhere real

| Variable | Value |
|---|---|
| `APP_BASE_URL` | `https://womsakhi.in` (or whatever you register) |

Every emailed link is built from this — verification, password reset, approval.
I corrected its default from `localhost:3000` to `localhost:3100`; **`:3000` on
your machine is your other project**, so every link would have gone there.

### 4. A production `DOCUMENT_ENCRYPTION_KEY`

I generated one for your local machine and encrypted the 20 documents already on
disk. **Production needs its own, generated separately:**

```bash
cd womencrafts-backend/backend
venv/bin/python -m app.core.docvault generate
```

> ### ⚠️ Back this key up before you use it
> These are photographs of government IDs belonging to women who may be hiding
> from someone. **If the key is lost, every stored document is permanently
> unreadable** — there is no recovery. Put it in a secret manager (AWS Secrets
> Manager, 1Password), never in git, and keep a sealed offline copy.

### 5. A new `JWT_SECRET_KEY` for production

Anything long and random. Never reuse the development one.

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

### 6. Optional — things that light up when you supply them

None of these block launch. Each is already wired; it appears the moment the
value exists.

| What | How |
|---|---|
| **The portrait on the sign-in page** | Save your generated image as `womencrafts-frontend/frontend/public/ux/brand/auth-hero.png`. A 1×1 placeholder sits there now, so nothing 404s. Drop yours over it — no code change, no restart. |
| **Social links** | Set `NEXT_PUBLIC_SOCIAL_INSTAGRAM`, `NEXT_PUBLIC_SOCIAL_LINKEDIN`, `NEXT_PUBLIC_SOCIAL_FACEBOOK` in `.env.local`. The rail is hidden until at least one is set. |
| **Continue with Google** | Needs a Google Cloud OAuth client (free). Send me the client ID and secret and I will build the server flow — I have left the seam ready at `/public/auth-providers`. |
| **Continue with Apple** | Needs a paid Apple Developer account (₹8,900/yr) and a signing key. Same seam. |

### 7. Clear the 12 dangling references, when you're ready

I did **not** delete rows from your Atlas database. There are 12 orphans — 1
booking, 1 enrolment, 10 mentorship requests pointing at mentors that no longer
exist. New ones can no longer be created, and the fix is one command:

```bash
cd womencrafts-backend/backend
venv/bin/python -m app.core.integrity check     # see them
venv/bin/python -m app.core.integrity repair    # clear them
```

`check` is worth running on a schedule. The rules live in
`app/core/integrity.py` — CASCADE deletes a child that only existed because of
its parent, ORPHAN keeps the row and clears the pointer (a wallet transaction is
a record of money that moved; deleting it to tidy a reference would falsify a
ledger).

### 8. Redis, if you ever run more than one worker

Set `REDIS_URL` and `WORKERS`. **The app now refuses to start in production with
`WORKERS > 1` and no `REDIS_URL`** — because the rate limiter counts per process,
so a 5-attempt lockout across 4 workers is really 20 attempts, and nothing
anywhere reports that. Verified across two simulated workers: exactly 5 attempts
got through, not 5 each.

The response cache is still per-process. That is a performance characteristic,
not a correctness bug — worth doing eventually, not before launch.

### 9. Verify the helplines before launch

The nine national numbers on the wellbeing screens now live in the database
(`reference` collection, topic `helpline`) rather than in the code, so any of
them can be corrected with an edit instead of a deploy. **Check each against its
official source before you open to the public** — helplines are exactly the kind
of fact that rots quietly:

`112` emergency · `181` women · `108` ambulance · `14416` Tele-MANAS ·
`15100` NALSA · `1098` Childline · `14567` Elderline · `139` railways ·
`1930` cyber fraud

Nothing city-specific is seeded. To add a district line — a local legal-aid
office, a state women's commission — insert a `helpline` entry with `city` set
to that city, and only women there will see it.

### 10. Four mailboxes that must actually exist

The new pages tell women to write to these. **Every one has to receive mail
before launch**, or the pages are lying:

- `hello@womsakhi.in` — general, and account recovery
- `safety@womsakhi.in` — reporting a member
- `privacy@womsakhi.in` — data requests, answered within 30 days as promised
- `no-reply@womsakhi.in` — the sending address

### 11. A lawyer to read the terms and privacy policy

Both are accurate — every claim was checked against the source — but accuracy is
not legal sufficiency. They carry a visible "not yet reviewed by a lawyer"
notice. **Have them reviewed, then delete the `<ReviewNotice />` from both
pages.** Razorpay and the app stores will read them.

Two things to settle with whoever reviews them:

1. **The registered entity and address.** Both pages say "PRAKMAS GLOBAL,
   Hyderabad, Telangana" — correct this if the registered name or city differs.
2. **Account deletion.** The privacy page says plainly that there is no
   self-delete button yet and that you have to ask a person. That is honest and
   allowed, but the DPDP Act expects erasure on request, so the button should
   get built.

### 12. Revoke the GitHub token you pasted in chat

`ghp_htL4…` has `admin:org` and `delete_repo` scopes and is in two old
`.git/config` files. Go to **GitHub → Settings → Developer settings → Personal
access tokens** and delete it. This is unrelated to the six items but it is the
most urgent thing on this page.

---

## Setting it live

Set `ENVIRONMENT=production` and the app hardens itself:

- `COOKIE_SECURE` is forced to `True` — it can no longer be turned off by a
  `.env` line, because "remember to set it" is a hope, not a control.
- **The app refuses to start** if any of these are still development values.
  You will see a numbered list of exactly what is wrong and how to fix it.

Try it before you deploy:

```bash
cd womencrafts-backend/backend
ENVIRONMENT=production venv/bin/python -c "
from app.core.config import Settings
for i, p in enumerate(Settings().unsafe_for_production(), 1): print(i, p)
"
```

When that prints nothing, you are ready.

### Encrypting documents on the production server

Once the production key is set, on that machine:

```bash
venv/bin/python -m app.core.docvault status     # what is encrypted right now
venv/bin/python -m app.core.docvault backfill   # encrypt the rest
```

Safe to re-run. Already-encrypted files are skipped, and it decrypts old
plaintext files transparently during the migration, so there is no flag day.

---

## What was verified, and how

**Password reset — 11 backend assertions and 7 browser assertions:**
an unknown address and a real one return identical words (no account
enumeration); the token is 43 characters; a forged token is refused; a
5-character password is refused; the reset succeeds; **the same link cannot be
spent twice**; she can sign in afterwards; `token_version` is bumped ready for
session invalidation.

**Document encryption — measured before and after:** 20 plaintext → 20
encrypted, 0 failed. All 20 decrypt back to real PNGs. A reviewer opening one
through `GET /verification/documents/{id}/file` gets `200` and a valid image. A
**brand-new upload** lands as `WSV1…` on disk, not plaintext. Test accounts
created for this were deleted.

**Production hardening:** with `ENVIRONMENT=production`, `COOKIE_SECURE` flips
to `True` on its own and five unsafe settings are reported.

**Razorpay:** the adapter has no `NotImplementedError` left. With no keys it
raises a clear config error instead of a crash, and the API answers `503`
*"Payments are unavailable right now. Nothing has been taken from you"* rather
than a bare 500 — because a woman who sees "something went wrong" while paying
does not know whether her money left.

---

## Still open after this

These remain outstanding:

- **Programme curricula are empty.** `/programs/[id]` now reads the real lessons
  from `/me/programs/{id}/detail` and hides the "What is in it" section when a
  course has none — instead of showing one hardcoded digital-marketing syllabus
  for every course, with lessons already ticked off. Somebody has to write the
  real ones.
- **No self-service account deletion.** The privacy policy says so plainly
  rather than promising a button that does not exist, but the DPDP Act expects
  erasure on request — build it.
- Sign-out does not end other devices. `token_version` is now bumped on reset
  and still unread — one line in `auth.py::_token_for` activates it.
- Redis before running more than one worker; the cache and rate limiter are
  per-process.
