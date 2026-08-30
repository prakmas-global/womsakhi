"""
A person's colour theme.

Stored on the account, like their language, so it follows them to any device
rather than living in one browser's storage.

The server keeps only the two seed colours. Every shade, the dark variants and
the readable foregrounds are derived on the client by the theme engine — one
source of truth, and no chance of twenty stored values drifting apart.
"""

import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator

from app.core.deps import get_current_user
from app.core.permissions import require_permission
from app.core.rbac import require_staff
from app.core.serializers import to_object_id
from app.db.mongodb import get_database
from app.models.member import MemberModel
from app.models.org import OrgSettingsModel
from app.models.user import UserModel

router = APIRouter(prefix="/theme", tags=["Theme"])

HEX = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")

# Mirrors theme-engine/presets.ts. Kept here so the server can validate a preset
# id and so a future email or PDF can use the same colours.
PRESET_IDS = {
    "womsakhi", "indigo", "forest", "sunset",
    "rose", "ocean", "marigold", "graphite", "custom",
}

DEFAULT_PRIMARY = "#d21f7c"
DEFAULT_SECONDARY = "#7440a6"


class Theme(BaseModel):
    id: str
    primary: str
    secondary: str


class ThemeUpdate(BaseModel):
    id: str = "custom"
    primary: str
    secondary: str

    @field_validator("primary", "secondary")
    @classmethod
    def valid_hex(cls, v: str) -> str:
        if not HEX.match(v or ""):
            raise ValueError("Colours must be hex, like #d21f7c")
        return v.lower()

    @field_validator("id")
    @classmethod
    def known_id(cls, v: str) -> str:
        return v if v in PRESET_IDS else "custom"


def _theme_of(doc: dict) -> Theme:
    return Theme(
        id=doc.get("theme_id") or "womsakhi",
        primary=doc.get("theme_primary") or DEFAULT_PRIMARY,
        secondary=doc.get("theme_secondary") or DEFAULT_SECONDARY,
    )


async def _org_default() -> dict | None:
    """The palette the organisation wants new accounts to start from.

    Consulted ONLY when the account has not chosen one. An organisation able to
    restyle someone who HAS chosen would be overriding a setting a woman picked
    deliberately — often an accessibility one. See routes/org.py.
    """
    doc = await get_database()[OrgSettingsModel.collection_name].find_one({"singleton": True})
    if not doc or not (doc.get("default_theme_id") or "").strip():
        return None
    return doc


@router.get("/me", response_model=Theme, summary="My colour theme")
async def my_theme(me: dict = Depends(get_current_user)):
    # `theme_id` cannot answer "did she choose?" — every account is created with
    # "womsakhi" in it, so choosing the default and never opening the picker look
    # identical. `theme_chosen` is set only by the PUT below, which is the only
    # code path that means a person decided something.
    if not me.get("theme_chosen"):
        org = await _org_default()
        if org:
            return Theme(
                id=org["default_theme_id"],
                primary=org.get("default_primary") or DEFAULT_PRIMARY,
                secondary=org.get("default_secondary") or DEFAULT_SECONDARY,
            )
    return _theme_of(me)


@router.put("/me", response_model=Theme, summary="Set my colour theme")
async def set_my_theme(body: ThemeUpdate, me: dict = Depends(get_current_user)):
    """Members and staff alike — everyone owns the colours of their own app."""
    await get_database()[UserModel.collection_name].update_one(
        {"_id": me["_id"]},
        {"$set": {
            "theme_id": body.id,
            "theme_primary": body.primary,
            "theme_secondary": body.secondary,
            # From here on the org default no longer applies to this account.
            "theme_chosen": True,
            "updated_at": datetime.now(timezone.utc),
        }},
    )
    return Theme(id=body.id, primary=body.primary, secondary=body.secondary)


@router.get(
    "/member/{member_id}",
    response_model=Theme,
    summary="A member's theme",
    dependencies=[Depends(require_permission("users.view"))],
)
async def member_theme(member_id: str, _: dict = Depends(require_staff)):
    db = get_database()
    member = await db[MemberModel.collection_name].find_one({"_id": to_object_id(member_id)})
    if not member:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    user = await db[UserModel.collection_name].find_one({"email": member.get("email", "")})
    return _theme_of(user or {})


@router.put(
    "/member/{member_id}",
    response_model=Theme,
    summary="Set a member's theme on her behalf",
    dependencies=[Depends(require_permission("users.edit"))],
)
async def set_member_theme(
    member_id: str, body: ThemeUpdate, me: dict = Depends(require_staff)
):
    """
    Staff setting a member's colours — for support calls where she can't
    navigate the picker herself.

    She is told it happened. Changing how someone's app looks without telling
    them is the kind of thing that makes people distrust an app, so this always
    leaves a trace she can see.
    """
    from app.models.conversation import notify
    from app.routes.staff_account import log_activity

    db = get_database()
    member = await db[MemberModel.collection_name].find_one({"_id": to_object_id(member_id)})
    if not member:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    user = await db[UserModel.collection_name].find_one({"email": member.get("email", "")})
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That member has no account")

    await db[UserModel.collection_name].update_one(
        {"_id": user["_id"]},
        {"$set": {
            "theme_id": body.id,
            "theme_primary": body.primary,
            "theme_secondary": body.secondary,
            # From here on the org default no longer applies to this account.
            "theme_chosen": True,
            "updated_at": datetime.now(timezone.utc),
        }},
    )
    await notify(
        db, str(user["_id"]),
        "Your colours were changed",
        f"{me.get('full_name', 'Our team')} set new colours for your app. "
        "You can change them any time under Language & appearance.",
        "account", "/app/settings/appearance",
    )
    await log_activity(
        me, "Changed a member's theme", "Users", target=member.get("full_name", ""),
    )
    return Theme(id=body.id, primary=body.primary, secondary=body.secondary)


# --- onboarding progress -----------------------------------------------------

ONBOARDING_STEPS = ["welcome", "appearance", "language", "needs"]


class OnboardingState(BaseModel):
    steps: list[str]
    done: list[str]
    complete: bool
    next_step: str | None


class OnboardingStep(BaseModel):
    step: str

    @field_validator("step")
    @classmethod
    def known_step(cls, v: str) -> str:
        if v not in ONBOARDING_STEPS:
            raise ValueError("Unknown onboarding step")
        return v


def _onboarding_of(doc: dict) -> OnboardingState:
    done = [s for s in (doc.get("onboarding_done") or []) if s in ONBOARDING_STEPS]
    complete = bool(doc.get("onboarding_complete", False))
    remaining = [s for s in ONBOARDING_STEPS if s not in done]
    return OnboardingState(
        steps=ONBOARDING_STEPS,
        done=done,
        complete=complete,
        next_step=None if complete or not remaining else remaining[0],
    )


@router.get("/onboarding", response_model=OnboardingState, summary="Where I am in onboarding")
async def onboarding_state(me: dict = Depends(get_current_user)):
    return _onboarding_of(me)


@router.post("/onboarding/step", response_model=OnboardingState, summary="Mark a step finished")
async def finish_step(body: OnboardingStep, me: dict = Depends(get_current_user)):
    """
    Saved per step rather than at the end, so closing the app halfway through
    doesn't make her start over.
    """
    fresh = await get_database()[UserModel.collection_name].find_one_and_update(
        {"_id": me["_id"]},
        {"$addToSet": {"onboarding_done": body.step},
         "$set": {"updated_at": datetime.now(timezone.utc)}},
        return_document=True,
    )
    return _onboarding_of(fresh or {})


@router.post("/onboarding/finish", response_model=OnboardingState, summary="Finish onboarding")
async def finish_onboarding(me: dict = Depends(get_current_user)):
    """Also used by "skip" — a skipped step is a finished decision, not a gap."""
    fresh = await get_database()[UserModel.collection_name].find_one_and_update(
        {"_id": me["_id"]},
        {"$set": {"onboarding_complete": True, "updated_at": datetime.now(timezone.utc)}},
        return_document=True,
    )
    return _onboarding_of(fresh or {})
