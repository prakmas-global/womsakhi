"""
Her vault: money she has set aside, and the privacy that makes it hers.

── WomSakhi does not hold this money ───────────────────────────────────────
Not a wallet, not a deposit, not a balance we owe her. Every rupee here stays
exactly where it already is — in her hand, in her own bank account, in the
chit. What this collection stores is her *earmark*: the fact that ₹3,400 of
what she already has is for an emergency and not for the house.

That distinction is the whole licensing position (we take custody of nothing)
and, more importantly, it is the honest one. A screen that showed a balance
WomSakhi did not hold would be telling her she has money somewhere she cannot
go and get it.

── Why an earmark still does the work ──────────────────────────────────────
The evidence behind this screen is not about custody, it is about labelling
and privacy. Four trials, one direction: money that arrives *privately* and
is *named as hers* changes what happens to it.

  India         — wages into her OWN account raised her work in public and
                  private jobs, and shifted her work norms three years on.
  Uganda        — the same loan paid onto a digital account rather than as
                  cash: +11% business capital, +15% profits, largest for the
                  women who reported pressure to share money.
  Kenya         — free savings accounts raised market women's business
                  investment 38–56%, and did nothing at all for men.
  Côte d'Ivoire — an account private rather than visible to her network took
                  up-take from 14% to 60%.

And the Nairobi ROSCA finding names the mechanism plainly: participation is
"a strategy a wife employs to protect her savings against claims by her
husband for immediate consumption." The pot is a shield. A named, private,
written-down earmark is a shield too — which is why this works without us
ever touching the money.

── Why the balance is derived and never stored ─────────────────────────────
A pocket's balance is the sum of its movements, computed on read. Storing a
running total invites the one bug this screen cannot survive: a number that
disagrees with the history under it. If they ever differ, she is right to
stop trusting the app, and she would be right.
"""

from datetime import datetime, timezone

#: What set the money aside. A rule nudged her and she agreed, or she did it
#: herself. Kept because "the app did this" and "I did this" are different
#: facts to her, and the history should not blur them.
SOURCES = ("her", "rule")

#: Rule triggers. Each is a share of something that just happened, never a
#: calendar event — her income is irregular, so a fixed monthly amount fails
#: in a lean month and under-saves in a good one.
TRIGGERS = ("order_paid", "payment_over", "pot_payout", "any_money_in")

#: The privacy guards, with the private state as the default in every case.
GUARD_KEYS = ("hide_amount", "pin_to_move", "quiet_notifications", "quick_exit")
GUARD_DEFAULTS = {
    "hide_amount": True,
    "pin_to_move": True,
    "quiet_notifications": True,
    "quick_exit": False,
}

#: What someone holding her phone is allowed to see. Same shared-handset
#: problem as the guards above, so it lives in the same document.
#:
#: Money is off by default and the three most dangerous things are not here at
#: all — her vault, her savings pot and her papers are never showable by
#: anyone, so there is no switch that could turn them on. A setting that
#: *could* expose them is one someone can lean over her shoulder and flip.
SHOW_KEYS = ("finished_orders", "shop", "classes", "month_earnings")
SHOW_DEFAULTS = {
    "finished_orders": True,
    "shop": True,
    "classes": True,
    "month_earnings": False,
}


class PocketModel:
    """A named earmark. Holds no money — names some of hers."""

    collection_name = "vault_pockets"

    @staticmethod
    def create_document(
        *,
        user_id: str,
        name: str,
        note: str = "",
        instant: bool = True,
        icon: str = "Lock",
        tint: str = "--ux-tint-violet",
        ink: str = "--ux-violet",
        goal_minor: int | None = None,
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "user_id": user_id,
            "name": name.strip()[:60],
            "note": note.strip()[:140],
            # Emergency money must be reachable with no waiting and no
            # permission, so she marks which pockets those are.
            "instant": bool(instant),
            "icon": icon,
            "tint": tint,
            "ink": ink,
            "goal_minor": max(0, int(goal_minor)) if goal_minor else None,
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict, *, minor: int = 0, moves: int = 0) -> dict:
        goal = doc.get("goal_minor")
        return {
            "id": str(doc.get("_id", "")),
            "name": doc.get("name", ""),
            "note": doc.get("note", ""),
            # Derived from the movements, every time. See the module note.
            "minor": int(minor),
            "instant": bool(doc.get("instant", True)),
            "icon": doc.get("icon", "Lock"),
            "tint": doc.get("tint", "--ux-tint-violet"),
            "ink": doc.get("ink", "--ux-violet"),
            "goal_minor": int(goal) if goal else None,
            "moves": int(moves),
        }


class VaultMoveModel:
    """Money going into an earmark, or coming back out of it."""

    collection_name = "vault_moves"

    @staticmethod
    def create_document(
        *,
        user_id: str,
        pocket_id: str,
        what: str,
        minor: int,
        source: str = "her",
        rule_id: str | None = None,
        on: datetime | None = None,
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "user_id": user_id,
            "pocket_id": pocket_id,
            "what": what.strip()[:140],
            # Signed: positive set aside, negative taken back out. Taking it
            # out is not a failure and is never styled as one — it is what
            # the emergency pocket is *for*.
            "minor": int(minor),
            "source": source if source in SOURCES else "her",
            "rule_id": rule_id,
            "on": on or now,
            "created_at": now,
        }

    @staticmethod
    def to_response(doc: dict, *, pocket_name: str = "") -> dict:
        on = doc.get("on")
        return {
            "id": str(doc.get("_id", "")),
            "pocket_id": doc.get("pocket_id", ""),
            "pocket": pocket_name,
            "what": doc.get("what", ""),
            "minor": int(doc.get("minor", 0)),
            "source": doc.get("source", "her"),
            "automatic": doc.get("source") == "rule",
            "on": on.isoformat() if isinstance(on, datetime) else "",
        }


class VaultRuleModel:
    """
    Saving by default rather than by decision.

    A rule cannot move money on its own, because there is no money here to
    move. What it does is *ask*: when the thing happens, she is nudged to set
    the amount aside, and the move is only written when she says yes. The
    behavioural win is in the default and the prompt, not in the automation.
    """

    collection_name = "vault_rules"

    @staticmethod
    def create_document(
        *,
        user_id: str,
        trigger: str,
        pocket_id: str,
        keep_minor: int | None = None,
        keep_pct: int | None = None,
        over_minor: int | None = None,
        on: bool = True,
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "user_id": user_id,
            "trigger": trigger if trigger in TRIGGERS else "order_paid",
            "pocket_id": pocket_id,
            # Exactly one of these two. A flat amount she can picture, or a
            # share that scales with a lumpy income.
            "keep_minor": max(0, int(keep_minor)) if keep_minor else None,
            "keep_pct": min(100, max(1, int(keep_pct))) if keep_pct else None,
            # Only for "payment_over": the threshold that arms it.
            "over_minor": max(0, int(over_minor)) if over_minor else None,
            "on": bool(on),
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict, *, pocket_name: str = "", saved_minor: int = 0) -> dict:
        return {
            "id": str(doc.get("_id", "")),
            "trigger": doc.get("trigger", "order_paid"),
            "pocket_id": doc.get("pocket_id", ""),
            "into": pocket_name,
            "keep_minor": doc.get("keep_minor"),
            "keep_pct": doc.get("keep_pct"),
            "over_minor": doc.get("over_minor"),
            "on": bool(doc.get("on", True)),
            # What this rule has actually put aside — counted from the moves
            # it produced, so a rule she never acted on honestly reads zero.
            "saved_minor": int(saved_minor),
        }


class VaultGuardsModel:
    """
    The shared-handset settings, one document per woman.

    Treated as product rather than as a settings page nobody opens, and every
    default is the private one. GSMA names safety and security as a top
    barrier to women's further use of mobile internet; in Pakistan only 48%
    of women who use mobile internet on someone else's phone use it daily,
    against 94% of those who own theirs. A balance readable over her shoulder
    is not her money.
    """

    collection_name = "vault_guards"

    @staticmethod
    def create_document(*, user_id: str) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "user_id": user_id,
            **GUARD_DEFAULTS,
            **SHOW_DEFAULTS,
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        return {k: bool(doc.get(k, GUARD_DEFAULTS[k])) for k in GUARD_KEYS}

    @staticmethod
    def showing_response(doc: dict) -> dict:
        return {k: bool(doc.get(k, SHOW_DEFAULTS[k])) for k in SHOW_KEYS}
