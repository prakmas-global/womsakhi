---
status: stable
updated: 2026-08-15
tags: [module]
---

# Member app

**Route:** `/app` · **Screens:** 43 · **Audience:** `member`

The product. Phone-first, one-handed, often on a slow connection. See
[[Two apps, one backend]] for why it isn't the staff app with things hidden.

## Areas

Learning · Work · [[Community]] · [[Safety]] · [[Money|Wallet and support]] ·
Account and appearance

## Design rules that took a correction to get right

**Content needs a container.** Early screens put content directly on the page
background, which read as "large amounts of empty space" rather than as a clean
layout. Every mid-page region now sits in a bounded surface with its own
padding. Reported bluntly and correctly as *"lot of spces"*.

**The header shows a name and a chevron.** Not a bare avatar. An avatar alone
doesn't read as a menu, so the dropdown goes undiscovered. Matches the staff
header for exactly that reason — see `MemberAccountMenu`.

**No duplication between sidebar and account menu.** Anything reachable from the
profile dropdown was removed from the sidebar. Two routes to one screen makes a
nav look longer and more confusing than it is, and neither entry feels canonical.

## The five phone tabs are hers to choose

The bottom bar holds five. Which five is a [[Layout engine]] setting — a member
who never touches Learning shouldn't spend a fifth of her navigation on it.
Stored as `nav.member.tabs`, capped at 5.

## Onboarding

3–5 screens after account creation, including the theme choice. See
[[Onboarding]].

Related: [[Admin dashboard]], [[Theme engine]]
