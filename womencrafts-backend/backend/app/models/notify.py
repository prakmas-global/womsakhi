"""
The Notification Engine's records.

Eight collections, and the split between them is the whole design:

- **An intent is a wish, not a message.** "Something wants to reach her." It is
  written before any policy runs, so a message that is held or suppressed still
  leaves a trace and a reason — which is what makes "why did she not get this?"
  answerable at 2am instead of a shrug.
- **A policy decision is kept, not just acted on.** allow / hold / suppress,
  with the preference version it was decided against. Preferences change; the
  record of what was true at the time does not.
- **A delivery attempt is per channel.** One intent may become an inbox row and
  a push. They fail independently and must be retried independently.
- **The states are honest.** `provider_accepted` is not `delivered`, and
  neither is `opened`. The catalogue is blunt about this: *"A provider
  acknowledgement does not prove the person saw the message."* Collapsing them
  into a single `sent` boolean is how products end up believing a woman was
  warned when she was not.

**Content is not stored here.** An intent carries a template key and
references. Health, faith, case detail and exact location stay in their own
collections and are read at render time by code already authorised to see them
— so none of it reaches a provider log, an analytics export, or a preview on a
shared phone.
"""

from datetime import datetime, timedelta, timezone


class IntentModel:
    """`notification_intents` — something wants to reach her."""

    collection_name = "notification_intents"

    STATE_CREATED = "created"
    STATE_HELD = "policy_held"        # quiet hours, budget — may be released
    STATE_QUEUED = "queued"
    STATE_DISPATCHED = "dispatched"
    STATE_SUPPRESSED = "suppressed"   # policy said no; will not be retried
    STATE_EXPIRED = "expired"
    STATE_FAILED = "failed"
    STATES = (STATE_CREATED, STATE_HELD, STATE_QUEUED, STATE_DISPATCHED,
              STATE_SUPPRESSED, STATE_EXPIRED, STATE_FAILED)

    @staticmethod
    def dedupe_key(user_id: str, template_key: str, ref: str, bucket: str) -> str:
        """
        One message per thing per window.

        `bucket` is usually the occurrence id, and for direct domain events the
        local day. Unique in the collection, so a duplicated domain event or a
        double tick loses the race at the database rather than producing a
        second buzz in her pocket (NOTIFY-UC-006).
        """
        return f"{user_id}:{template_key}:{ref}:{bucket}"

    @staticmethod
    def create_document(
        *,
        user_id: str,
        template_key: str,
        category: str,
        klass: str,
        dedupe: str,
        payload: dict | None = None,
        occurrence_id: str = "",
        domain_module: str = "",
        domain_ref: str = "",
        expires_at: datetime | None = None,
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "user_id": user_id,
            "template_key": template_key,
            "category": category,
            "klass": klass,
            # References only — see the note at the top of this file.
            "payload": payload or {},
            "domain": {"module": domain_module, "ref": domain_ref},
            "occurrence_id": occurrence_id,
            "dedupe_key": dedupe,
            "state": IntentModel.STATE_CREATED,
            # An undelivered optional message stops being worth sending. Two
            # hours late is a nudge; nine hours late is a stranger waking her.
            "expires_at": expires_at or (now + timedelta(hours=6)),
            "held_reason": "",
            "release_after": None,
            "created_at": now,
            "updated_at": now,
        }


class PreferenceModel:
    """
    `preference_versions` — her settings, versioned.

    Versioned rather than mutated because a message can be queued for hours.
    The catalogue requires that *"queued prompts honour changes"* (CYCLE-UC-036)
    and that Off takes effect *"on unsent work"* (NOTIFY-UC-010) — both of which
    need the dispatcher to re-read the CURRENT version immediately before it
    sends, and the audit to show which version a past decision used.
    """

    collection_name = "preference_versions"

    MODE_ALL = "all"
    MODE_IMPORTANT = "important"
    MODE_INAPP = "inapp_only"
    MODE_OFF = "off"
    MODES = (MODE_ALL, MODE_IMPORTANT, MODE_INAPP, MODE_OFF)

    CHANNELS = ("inapp", "push", "email", "sms", "whatsapp", "voice")

    @staticmethod
    def create_document(
        *,
        user_id: str,
        version: int,
        tz: str = "UTC",
        mode: str = MODE_ALL,
        quiet_start: str = "21:30",
        quiet_end: str = "07:00",
        quiet_days: list[int] | None = None,   # empty = every night
        channels: dict | None = None,
        discretionary_per_day: int = 2,
        min_gap_minutes: int = 240,
        paused_until: datetime | None = None,
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "user_id": user_id,
            "version": int(version),
            "tz": tz or "UTC",
            "mode": mode if mode in PreferenceModel.MODES else PreferenceModel.MODE_ALL,
            "quiet": {
                "start": quiet_start,
                "end": quiet_end,
                "days": list(quiet_days or []),
                # Off by default: a woman who has never been asked should not
                # silently have her evening messages withheld.
                "enabled": True,
            },
            # Per category, per channel. Absent means "not chosen", which is
            # treated as off for everything except the in-app inbox — the one
            # surface that needs no permission and costs nothing.
            "channels": channels or {"inapp": True, "push": False, "email": False,
                                     "sms": False, "whatsapp": False, "voice": False},
            "budget": {
                "discretionary_per_day": int(discretionary_per_day),
                "min_gap_minutes": int(min_gap_minutes),
            },
            # Set when two prompts in a series go unanswered (§24.4).
            "fatigue": {},
            "paused_until": paused_until,
            "created_at": now,
        }


class PolicyDecisionModel:
    """`policy_decisions` — why she did or did not get it."""

    collection_name = "policy_decisions"

    ALLOW = "allow"
    HOLD = "hold"
    SUPPRESS = "suppress"

    @staticmethod
    def create_document(
        *,
        intent_id: str,
        user_id: str,
        decision: str,
        reason: str,
        preference_version: int,
        channels: list[str] | None = None,
        release_after: datetime | None = None,
        budget_used: int = 0,
    ) -> dict:
        return {
            "intent_id": intent_id,
            "user_id": user_id,
            "decision": decision,
            # A short machine reason — "quiet_hours", "budget_exhausted",
            # "fatigue_pause", "consent_withdrawn", "mode_off". The member-
            # facing "Why this reminder?" is rendered from it in her language.
            "reason": reason,
            "preference_version": int(preference_version),
            "channels": list(channels or []),
            "release_after": release_after,
            "budget_used": int(budget_used),
            "decided_at": datetime.now(timezone.utc),
        }


class DeliveryModel:
    """`delivery_attempts` — one row per channel per intent."""

    collection_name = "delivery_attempts"

    CREATED = "created"
    QUEUED = "queued"
    ACCEPTED = "provider_accepted"   # the provider took it. Not delivered.
    DELIVERED = "delivered"          # only where the channel can tell us
    OPENED = "opened"                # only where observable
    ACTED = "action_confirmed"       # she pressed Done. The only certain one.
    FAILED = "failed"
    EXPIRED = "expired"
    SUPPRESSED = "suppressed"
    STATES = (CREATED, QUEUED, ACCEPTED, DELIVERED, OPENED, ACTED,
              FAILED, EXPIRED, SUPPRESSED)

    # Bounded, with backoff. Not infinite: a provider that has failed five
    # times in twenty minutes is not going to succeed on the sixth, and the
    # message is stale by then anyway.
    MAX_ATTEMPTS = 5
    BACKOFF_SECONDS = (30, 120, 600, 1800)

    @staticmethod
    def next_retry(attempts: int) -> datetime:
        idx = min(max(attempts - 1, 0), len(DeliveryModel.BACKOFF_SECONDS) - 1)
        return datetime.now(timezone.utc) + timedelta(
            seconds=DeliveryModel.BACKOFF_SECONDS[idx])

    @staticmethod
    def create_document(
        *,
        intent_id: str,
        user_id: str,
        channel: str,
        provider: str = "",
        cost_micros: int = 0,
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "intent_id": intent_id,
            "user_id": user_id,
            "channel": channel,
            "provider": provider,
            "state": DeliveryModel.CREATED,
            "attempts": 0,
            "next_retry_at": None,
            "provider_message_id": "",
            "error": "",
            # Counted BEFORE dispatch, not after. An optional message that
            # would exceed the approved budget is suppressed, never quietly
            # escalated to a cheaper channel (NOTIFY-UC-015).
            "cost_micros": int(cost_micros),
            "created_at": now,
            "updated_at": now,
        }


class SubscriptionModel:
    """`device_subscriptions` — where a web push can actually go."""

    collection_name = "device_subscriptions"

    @staticmethod
    def create_document(*, user_id: str, endpoint: str, p256dh: str,
                        auth: str, user_agent: str = "") -> dict:
        now = datetime.now(timezone.utc)
        return {
            "user_id": user_id,
            "endpoint": endpoint,
            "keys": {"p256dh": p256dh, "auth": auth},
            "user_agent": user_agent,
            # A push endpoint dies silently when she clears site data or
            # changes phone. The provider tells us with a 404/410 and the row
            # is marked here rather than retried forever.
            "invalid_at": None,
            "created_at": now,
            "last_seen_at": now,
        }


class ReceiptModel:
    """
    `action_receipts` — the answer coming back to the domain.

    The catalogue's rule, and the reason this is its own collection: *"opening
    a message does not complete its task."* Done is an act, recorded once,
    unique per occurrence so a double-tap or a retried request cannot count
    twice.
    """

    collection_name = "action_receipts"

    DONE = "done"
    LATER = "later"
    SKIP = "skip"
    STOP = "stop"
    CHANGE = "change_time"
    ACTIONS = (DONE, LATER, SKIP, STOP, CHANGE)

    @staticmethod
    def create_document(*, occurrence_id: str, user_id: str, action: str,
                        via: str = "inapp", detail: dict | None = None) -> dict:
        return {
            "occurrence_id": occurrence_id,
            "user_id": user_id,
            "action": action,
            "via": via,
            "detail": detail or {},
            "at": datetime.now(timezone.utc),
        }


class AuditModel:
    """`audit_events` — who did what, for staff review."""

    collection_name = "audit_events"

    @staticmethod
    def create_document(*, actor: str, action: str, target: str,
                        user_id: str = "", meta: dict | None = None) -> dict:
        return {
            "actor": actor,            # user id, "system", or a staff id
            "action": action,
            "target": target,
            "user_id": user_id,
            "meta": meta or {},
            "at": datetime.now(timezone.utc),
        }


class OutboxModel:
    """
    `outbox` — a domain change and its event, committed together.

    The one thing that makes "the appointment moved, so recalculate the
    reminder" impossible to lose. Without it there are two writes and a window
    between them: the appointment moves, the process dies, and the reminder
    fires at the old time forever with nothing anywhere recording that it
    should not have.

    Atlas is a replica set, so a real transaction is available and this is a
    two-line guarantee rather than a saga.
    """

    collection_name = "outbox"

    @staticmethod
    def create_document(*, event: str, module: str, ref: str,
                        idem: str, payload: dict | None = None) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "event": event,           # "booking.moved", "order.paid", …
            "module": module,
            "ref": ref,
            "payload": payload or {},
            # Unique. A domain handler that runs twice — and at-least-once
            # delivery guarantees it eventually will — writes one event.
            "idem": idem,
            "processed_at": None,
            "attempts": 0,
            "last_error": "",
            "created_at": now,
        }
