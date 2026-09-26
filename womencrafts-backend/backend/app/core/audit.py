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

── One schema, the one that was already here ──────────────────────────────
`ActivityLogModel` already defined this collection's shape, and the settings
screen already queries it by `user_id` and `category`. Writing a parallel
shape — `actor_id`, `module` — would have produced rows the existing screen
silently filters out: an audit trail that records everything and shows
nothing. So this goes through that model.

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
from app.models.staff import ActivityLogModel

logger = logging.getLogger(__name__)

#: Dotted action prefix -> the bucket the breakdown chart groups by. The
#: model's `CATEGORIES` is the vocabulary; this maps our verbs onto it.
_CATEGORY = {
    "staff": "Users", "member": "Users", "user": "Users", "role": "Users",
    "appointment": "Appointments", "program": "Programs",
    "content": "Content", "community": "Community", "growth": "Growth",
    "safety": "Safety", "report": "Reports", "analytics": "Reports",
    # Added as the modules were rebuilt: each verb prefix goes to the screen
    # a reader would look for it under.
    "service": "Appointments", "calendar": "Appointments", "feedback": "Programs",
    "messages": "Community", "task": "Settings",
    "market": "Market", "money": "Money", "learning": "Learning", "resources": "Resources",
}


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
        doc = ActivityLogModel.create_document(
            user_id=str(actor.get("_id", "")),
            user_name=actor.get("full_name", "") or actor.get("email", ""),
            action=action,
            category=_CATEGORY.get(action.split(".", 1)[0], "Settings"),
            target=target,
            detail=detail[:400],
            # Useful when an account is shared or compromised; empty when the
            # call did not pass a request through.
            ip=_client_ip(request),
        )
        await get_database()[ActivityLogModel.collection_name].insert_one(doc)
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
