---
status: stable
updated: 2026-08-15
tags: [ops, security]
---

# Secrets

Three rules, all absolute.

## 1. Secrets live in `backend/.env`. Nowhere else.

Not in this vault, not in a note, not in a commit, not pasted into a chat. This
vault is committed to the repository — anything written here is published to
everyone with repo access, permanently, including in history after deletion.

That's why [[Demo accounts]] names the accounts but not their passwords.

## 2. Verify a key by using it, never by printing it.

To check an API key works, call the service and look at the status code. Do not
echo it, do not log it, do not print it "just to confirm it loaded". A key in
terminal scrollback is a key in a screen recording.

## 3. Identity documents are not files, they are liabilities.

Covered fully in [[ADR-011 ID documents are never publicly reachable]]. Never
serve them from a public path, never generate a long-lived URL, never include
them in an export that isn't itself access-controlled.

## Live keys

Anthropic and Azure Speech keys are configured for the upcoming
[[Sakhi]] assistant. Present in `.env`, referenced by name only in
[[Third-party services]].

Related: [[Backup and Restore]]
