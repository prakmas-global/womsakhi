"""
The Reminder Engine's two records: the rule, and each time it comes due.

**Why two collections and not one.** A reminder that repeats is one rule and
many due instants, and the catalogue is explicit that they have to be told
apart: *"Each occurrence has its own ID and schedule version. Completing one
occurrence does not delete a recurring series."* Storing "next due" on the rule
collapses that — you cannot then mark Tuesday done while Wednesday is still
coming, and you cannot re-run a Tuesday the worker crashed on.

**Why the occurrence carries the schedule version.** She edits a daily 7am
reminder to 9am. Queued 7am occurrences are now wrong, but some may already be
in flight. Version-stamping every occurrence means the tick can discard the
stale ones by comparing against the rule, rather than trying to delete rows out
from under a worker (REM-UC-006, REM-UC-012).

**Why `due_at` is UTC and the local time is kept beside it.** Both are needed
and neither is enough. A 7am habit reminder should stay 7am when she flies to
Dubai; a safety check-in deadline is elapsed time and must not shift at all.
So: the instant is authoritative, the intended local time is what lets an
ordinary schedule be rebuilt in a new zone, and `drift` records which rule
applies (REM-UC-002).

**Why `klass` exists on the rule.** Everything downstream — quiet hours, the
attention budget, the fatigue pause, retry policy — turns on whether this is a
safety deadline, a transactional fact, or an optional nudge. Deciding that once
at creation, rather than inferring it at dispatch, is what keeps a safety
escalation out of the ordinary suppression path (REM-UC-009).
"""

from datetime import datetime, timedelta, timezone


class ReminderModel:
    """`reminder_definitions` — the rule."""

    collection_name = "reminder_definitions"

    # How the due instants are produced.
    SCHEDULE_ONCE = "once"
    SCHEDULE_RECURRING = "recurring"
    SCHEDULE_EVENT = "event_relative"     # "15 minutes before the session"
    SCHEDULES = (SCHEDULE_ONCE, SCHEDULE_RECURRING, SCHEDULE_EVENT)

    # What a timezone change does to an already-scheduled series.
    DRIFT_LOCAL = "keep_local"      # 7am stays 7am wherever she is
    DRIFT_ABSOLUTE = "keep_instant"  # elapsed time; safety deadlines only
    DRIFTS = (DRIFT_LOCAL, DRIFT_ABSOLUTE)

    # The class decides policy. It is set once, here, and never inferred later.
    CLASS_SAFETY = "safety"                # never suppressed, never budgeted
    CLASS_TRANSACTIONAL = "transactional"  # orders, bookings, security
    CLASS_USER = "user"                    # she asked for this one herself
    CLASS_DISCRETIONARY = "discretionary"  # encouragement, nudges, digests
    CLASSES = (CLASS_SAFETY, CLASS_TRANSACTIONAL, CLASS_USER, CLASS_DISCRETIONARY)

    # What gets claimed first when several are due in the same second.
    # A NUMBER, not the class name: sorting by the name put "discretionary"
    # ahead of "safety" because d sorts before s, which would have let an
    # encouragement be processed before a check-in deadline under load. The
    # kind of ordering bug that is invisible until the one minute it matters.
    PRIORITY = {CLASS_SAFETY: 0, CLASS_TRANSACTIONAL: 1,
                CLASS_USER: 2, CLASS_DISCRETIONARY: 3}

    STATE_DRAFT = "draft"
    STATE_SCHEDULED = "scheduled"
    STATE_PAUSED = "paused"
    STATE_COMPLETED = "completed"
    STATE_CANCELLED = "cancelled"
    STATE_EXPIRED = "expired"
    STATES = (STATE_DRAFT, STATE_SCHEDULED, STATE_PAUSED,
              STATE_COMPLETED, STATE_CANCELLED, STATE_EXPIRED)

    # The inbox categories from catalogue §24.3. A reminder belongs to exactly
    # one, and it is what the member filters and mutes by.
    CATEGORIES = ("reminders", "orders", "circles", "learning", "safety")

    @staticmethod
    def create_document(
        *,
        user_id: str,
        title_key: str,
        schedule_type: str,
        tz: str,
        klass: str = CLASS_USER,
        category: str = "reminders",
        member_id: str = "",
        # What this reminder is ABOUT. A reference, never the content itself —
        # health, case and location detail stays in its own collection and is
        # read at render time by something already authorised to see it.
        domain_module: str = "",
        domain_ref: str = "",
        # `once`: the instant. `recurring`: local time + days. `event`: offset.
        at: datetime | None = None,
        local_time: str = "",                 # "07:30", her wall clock
        days: list[int] | None = None,        # 0=Mon … 6=Sun; empty = daily
        offset_minutes: int = 0,              # negative = before the anchor
        anchor_at: datetime | None = None,
        drift: str = DRIFT_LOCAL,
        starts_at: datetime | None = None,
        ends_at: datetime | None = None,
        expires_at: datetime | None = None,
        payload: dict | None = None,
        created_by: str = "member",           # member | system | staff
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "user_id": user_id,
            "member_id": member_id,

            # A KEY, not a sentence. The message is rendered in her language at
            # dispatch, so a woman who changes language does not keep receiving
            # reminders written in the old one.
            "title_key": title_key,
            "payload": payload or {},

            "domain": {"module": domain_module, "ref": domain_ref},
            "category": category if category in ReminderModel.CATEGORIES else "reminders",
            "klass": klass if klass in ReminderModel.CLASSES else ReminderModel.CLASS_USER,

            "schedule": {
                "type": schedule_type if schedule_type in ReminderModel.SCHEDULES
                        else ReminderModel.SCHEDULE_ONCE,
                "at": at,
                "local_time": local_time,
                "days": list(days or []),
                "offset_minutes": int(offset_minutes),
                "anchor_at": anchor_at,
            },
            "tz": tz or "UTC",
            "drift": drift if drift in ReminderModel.DRIFTS else ReminderModel.DRIFT_LOCAL,

            "starts_at": starts_at or now,
            "ends_at": ends_at,
            # An optional reminder with no end date is a promise to interrupt
            # her forever. Callers may pass None deliberately; the engine's
            # expiry sweep is what stops a stale one (REM-UC-008).
            "expires_at": expires_at,

            "state": ReminderModel.STATE_SCHEDULED,
            # Bumped on every edit that changes WHEN it fires. Occurrences
            # carry the version they were built from, so stale ones are
            # recognisable instead of needing to be hunted down and deleted.
            "version": 1,

            "created_by": created_by,
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        s = doc.get("schedule") or {}
        return {
            "id": str(doc.get("_id", "")),
            "title_key": doc.get("title_key", ""),
            "payload": doc.get("payload") or {},
            "category": doc.get("category", "reminders"),
            "klass": doc.get("klass", ReminderModel.CLASS_USER),
            "schedule": {
                "type": s.get("type", ReminderModel.SCHEDULE_ONCE),
                "at": s.get("at"),
                "local_time": s.get("local_time", ""),
                "days": s.get("days") or [],
                "offset_minutes": s.get("offset_minutes", 0),
            },
            "tz": doc.get("tz", "UTC"),
            "state": doc.get("state", ReminderModel.STATE_SCHEDULED),
            "version": doc.get("version", 1),
            "ends_at": doc.get("ends_at"),
        }


class OccurrenceModel:
    """`reminder_occurrences` — one due instant, and what happened to it."""

    collection_name = "reminder_occurrences"

    STATE_SCHEDULED = "scheduled"
    STATE_DUE = "due"            # claimed by a worker, being processed
    STATE_SNOOZED = "snoozed"
    STATE_COMPLETED = "completed"
    STATE_CANCELLED = "cancelled"
    STATE_EXPIRED = "expired"    # went stale; deliberately NOT sent
    STATE_FAILED = "failed"
    STATES = (STATE_SCHEDULED, STATE_DUE, STATE_SNOOZED, STATE_COMPLETED,
              STATE_CANCELLED, STATE_EXPIRED, STATE_FAILED)

    @staticmethod
    def idempotency_key(definition_id: str, due_at: datetime, version: int) -> str:
        """
        What makes "process this occurrence" safe to attempt twice.

        Ten Cloud Run instances can tick at the same second, and a retried tick
        must not produce a second message. This key is unique in the
        collection, so the second insert loses the race rather than creating a
        duplicate — the database decides, not application logic that has to
        remember to check.
        """
        # Normalised to UTC first: a datetime read back from Mongo is naive,
        # and `naive.timestamp()` is read in the SERVER's zone. Recomputing
        # this key on a non-UTC host would otherwise produce a different
        # string for the same instant and defeat the unique index that is the
        # only thing stopping a duplicate send.
        if due_at.tzinfo is None:
            due_at = due_at.replace(tzinfo=timezone.utc)
        return f"{definition_id}:{int(due_at.timestamp())}:{version}"

    @staticmethod
    def create_document(
        *,
        definition_id: str,
        user_id: str,
        due_at: datetime,
        version: int,
        intended_local: str = "",
        tz: str = "UTC",
        klass: str = ReminderModel.CLASS_USER,
        category: str = "reminders",
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "definition_id": definition_id,
            "user_id": user_id,
            "due_at": due_at,
            "intended_local": intended_local,
            "tz": tz,
            "klass": klass,
            "priority": ReminderModel.PRIORITY.get(klass, 2),
            "category": category,
            "schedule_version": int(version),
            "idem": OccurrenceModel.idempotency_key(definition_id, due_at, version),

            "state": OccurrenceModel.STATE_SCHEDULED,

            # Leasing, not locking. A worker claims this row by writing its own
            # id and an expiry; if it dies, the lease lapses and the row is
            # claimable again. No lock to release, nothing to clean up after a
            # crash, and no dependency on Redis being reachable (REM-UC-005).
            "lease_owner": "",
            "lease_expires_at": None,
            "attempts": 0,
            "last_error": "",

            "intent_id": "",      # set once a notification intent is raised
            "completed_at": None,
            "completed_via": "",  # inapp | push | email | sms | whatsapp | auto
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def lease_until(seconds: int) -> datetime:
        return datetime.now(timezone.utc) + timedelta(seconds=max(30, seconds))

    @staticmethod
    def to_response(doc: dict) -> dict:
        return {
            "id": str(doc.get("_id", "")),
            "definition_id": doc.get("definition_id", ""),
            "due_at": doc.get("due_at"),
            "state": doc.get("state", OccurrenceModel.STATE_SCHEDULED),
            "category": doc.get("category", "reminders"),
            "completed_at": doc.get("completed_at"),
        }
