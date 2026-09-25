"""
Who did what, to whom, and when.

── Why this had to be built rather than wired ─────────────────────────────
`ActivityLogModel` already existed on the `activity_log` collection, and the
settings screen already had a page to display it. Nothing anywhere in
`app/routes/` ever wrote a row. So the platform had an audit log in the same
sense that an empty filing cabinet is a filing system.

That matters more here than on most products. Staff can read women's ID
documents, suspend their accounts, see their safety reports and move their
money. An action nobody can attribute is an action nobody can question.

── What is recorded, and what is not ──────────────────────────────────────
Every *mutating* staff action: who, what, the target, a short human detail,
and the request's origin. Reads are not recorded — logging every list view
would bury the writes in noise, and the reads that genuinely matter (opening
a woman's ID document) already have their own access log in
`verification.py`.

The detail line is written for the person who will read it during an
investigation, not for a machine: "Priya Sharma → Supervisor" rather than
`{"from": "Viewer", "to": "Supervisor"}`.

── Never fails the action it is recording ─────────────────────────────────
A failed write here must not roll back the thing that succeeded. If the log
cannot be written the action still stands and the failure is logged to the
process log, because the alternative — refusing to suspend an abusive account
because the audit collection is unreachable — is worse.
"""

import logging
from datetime import datetime, timezone

from fastapi import Request

from app.db.mongodb import get_database

logger = logging.getLogger(__name__)

COLLECTION = "activity_log"

#: How long entries are kept. Long enough for an investigation that starts
#: months after the fact, and a fixed horizon so the collection cannot grow
#: without bound. Enforced by a TTL index in `db/indexes.py`.
RETENTION_DAYS = 730


async def record(
    actor: dict,
    action: str,
    *,
    target: str = "",
    detail: str = "",
    request: Request | None = None,
) -> None:
    """
    Write one audit entry.

    `action` is a dotted verb the UI can group on — `staff.suspend`,
    `member.approve`, `safety.resolve`. `target` is the id of the thing acted
    on, so an investigator can pull every action against one account.
    """
    try:
        await get_database()[COLLECTION].insert_one({
            "actor_id": str(actor.get("_id", "")),
            "actor_name": actor.get("full_name", ""),
            "actor_email": actor.get("email", ""),
            "actor_role": actor.get("role", ""),
            "action": action,
            "module": action.split(".", 1)[0],
            "target": target,
            "detail": detail[:400],
            # Useful when an account is shared or compromised; absent when the
            # call did not pass a request through.
            "ip": _client_ip(request),
            "user_agent": (request.headers.get("user-agent", "")[:200] if request else ""),
            "created_at": datetime.now(timezone.utc),
        })
    except Exception:
        # Deliberately swallowed — see the module note. Logged so it is not
        # invisible if the collection is genuinely broken.
        logger.exception("audit: could not record %s by %s", action, actor.get("email"))


def _client_ip(request: Request | None) -> str:
    if request is None:
        return ""
    # Behind the load balancer the real address is the first hop in
    # X-Forwarded-For; `request.client` is the balancer itself.
    fwd = request.headers.get("x-forwarded-for", "")
    if fwd:
        return fwd.split(",")[0].strip()[:64]
    return (request.client.host if request.client else "")[:64]
