"""
Organisation settings — the four `org.*` features, implemented.

These were gated in [[Entitlements]] long before they existed: the enum listed
`org.branding`, `org.default_theme`, `org.layout_templates` and
`org.custom_domain`, and nothing sat behind any of them. The seam was cheap and
the features were not needed yet. They are now.

Two guards on every write, and they are different questions:

  · `require_super_admin` — is this person allowed to change how the whole
    installation looks?
  · `require_feature(...)` — has this installation licensed that?

Either alone is wrong. A Super Admin on the free tier must not be able to set a
platform-wide palette, and an org-tier account operated by a Viewer must not
either. `allows()` **fails closed** — an unrecognised tier loses features rather
than gaining them ([[ADR-001 Everything personal is free]]).

**Nothing here overwrites a personal choice.** The default theme applies to
members who have not picked one; a layout template writes only to accounts with
no saved layout of their own, and reports how many it skipped. An organisation
that can silently restyle someone's accessibility settings is a worse product
than one that cannot.
"""

from __future__ import annotations

import secrets
from datetime import datetime, timezone

from bson import ObjectId
from pymongo import UpdateOne
from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.audit import record
from app.core.entitlements import Feature, allows
from app.core.permissions import require_permission
from app.core.rbac import require_staff, require_super_admin
from app.core.serializers import to_object_id
from app.db.mongodb import get_database
from app.models.layout import LayoutModel
from app.models.org import LayoutTemplateModel, OrgSettingsModel
from app.models.user import UserModel
from app.schemas.org import (
    ApplyResult,
    BrandingUpdate,
    DefaultThemeUpdate,
    DomainUpdate,
    LayoutTemplate,
    LayoutTemplateCreate,
    MessageResponse,
    OrgSettings,
)

router = APIRouter(prefix="/org", tags=["Organisation"])

FEATURE_LABELS = {
    Feature.ORG_BRANDING: "organisation branding",
    Feature.ORG_DEFAULT_THEME: "a platform-wide default theme",
    Feature.ORG_LAYOUT_TEMPLATES: "layout templates",
    Feature.ORG_CUSTOM_DOMAIN: "a custom domain",
}


def require_feature(feature: Feature):
    """Dependency factory. Says what is missing and what would provide it —
    a bare 403 on a licensing boundary sends people to read the source."""

    async def guard(user: dict = Depends(require_super_admin)) -> dict:
        if not allows(user, feature):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"This installation's plan does not include {FEATURE_LABELS.get(feature, feature.value)}.",
            )
        return user

    return guard


def _settings():
    return get_database()[OrgSettingsModel.collection_name]


def _templates():
    return get_database()[LayoutTemplateModel.collection_name]


async def _read_settings() -> dict:
    doc = await _settings().find_one({"singleton": True})
    if not doc:
        doc = OrgSettingsModel.create_document()
        await _settings().insert_one(doc)
    return doc


async def _update_settings(changes: dict) -> dict:
    changes["updated_at"] = datetime.now(timezone.utc)
    await _settings().update_one(
        {"singleton": True},
        {"$set": changes, "$setOnInsert": {"created_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return await _read_settings()


# --- reading -----------------------------------------------------------------

@router.get("", response_model=OrgSettings, summary="Organisation settings")
async def read_settings(_: dict = Depends(require_permission("settings.view"))):
    """Readable by any staff account — the shell needs the logo and the default
    palette to render, and hiding them behind Super Admin would mean every other
    staff member sees unbranded screens."""
    return OrgSettings(**OrgSettingsModel.to_response(await _read_settings()))


# --- org.branding ------------------------------------------------------------

@router.put("/branding", response_model=OrgSettings, summary="Set the organisation's name and marks")
async def set_branding(
    payload: BrandingUpdate,
    request: Request,
    me: dict = Depends(require_feature(Feature.ORG_BRANDING)),
):
    """`logo` and `wordmark` are URLs returned by `POST /uploads` — this does not
    take file bytes, so there is one upload path in the whole product."""
    doc = await _update_settings({
        "name": payload.name.strip(),
        "logo": payload.logo.strip(),
        "wordmark": payload.wordmark.strip(),
    })
    await record(
        me, "settings.org.branding", target="org_settings",
        detail=f"Set organisation branding: name '{payload.name.strip() or '—'}'"
               + (", logo set" if payload.logo.strip() else ", no logo"),
        request=request,
    )
    return OrgSettings(**OrgSettingsModel.to_response(doc))


# --- org.default_theme -------------------------------------------------------

@router.put("/theme", response_model=OrgSettings, summary="Set the starting palette for new accounts")
async def set_default_theme(
    payload: DefaultThemeUpdate,
    request: Request,
    me: dict = Depends(require_feature(Feature.ORG_DEFAULT_THEME)),
):
    """A *starting* palette, not an enforced one. Anyone who has chosen a theme
    keeps it — see the module docstring."""
    doc = await _update_settings({
        "default_theme_id": payload.theme_id.strip(),
        "default_primary": payload.primary.strip(),
        "default_secondary": payload.secondary.strip(),
        "default_mode": payload.mode,
    })
    theme_name = payload.theme_id.strip() or "WomSakhi's own"
    await record(
        me, "settings.org.default_theme", target="org_settings",
        detail=f"Set the default palette to '{theme_name}' ({payload.mode or 'follow the device'})",
        request=request,
    )
    return OrgSettings(**OrgSettingsModel.to_response(doc))


# --- org.layout_templates ----------------------------------------------------

@router.get("/layout-templates", response_model=list[LayoutTemplate], summary="Saved layout templates")
async def list_templates(_: dict = Depends(require_feature(Feature.ORG_LAYOUT_TEMPLATES))):
    cursor = _templates().find({}).sort("created_at", -1)
    return [LayoutTemplate(**LayoutTemplateModel.to_response(d)) async for d in cursor]


@router.post(
    "/layout-templates",
    response_model=LayoutTemplate,
    status_code=status.HTTP_201_CREATED,
    summary="Save a layout as a template for a role",
)
async def create_template(
    payload: LayoutTemplateCreate,
    request: Request,
    me: dict = Depends(require_feature(Feature.ORG_LAYOUT_TEMPLATES)),
):
    layout = payload.layout
    if layout is None:
        # "Save what I am looking at" — the common case, and it avoids making
        # the client reassemble a layout it already has.
        mine = await get_database()[LayoutModel.collection_name].find_one({"user_id": str(me["_id"])})
        layout = LayoutModel.to_response(mine)
    doc = LayoutTemplateModel.create_document(
        name=payload.name, role=payload.role, app=payload.app,
        layout=layout, created_by=str(me["_id"]),
    )
    result = await _templates().insert_one(doc)
    doc["_id"] = result.inserted_id
    await record(
        me, "settings.org.template.create", target=str(result.inserted_id),
        detail=f"Saved layout template '{doc['name']}' for {payload.role} ({payload.app})",
        request=request,
    )
    return LayoutTemplate(**LayoutTemplateModel.to_response(doc))


@router.post(
    "/layout-templates/{template_id}/apply",
    response_model=ApplyResult,
    summary="Push a template to everyone holding its role",
)
async def apply_template(
    template_id: str,
    request: Request,
    me: dict = Depends(require_feature(Feature.ORG_LAYOUT_TEMPLATES)),
):
    """Writes only to accounts that have **no layout of their own**.

    Overwriting someone's arrangement without asking is the behaviour that makes
    people distrust a "customise" feature — after one silent reset they stop
    bothering. The response says how many were skipped so the number is visible
    rather than surprising.
    """
    template = await _templates().find_one({"_id": to_object_id(template_id)})
    if not template:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Template not found")

    # Three round trips, whoever this lands on.
    #
    # It used to be two per account — read that person's layout, then write it —
    # inside a loop over everyone holding the role. Applying a template to two
    # hundred staff was four hundred round trips to a cluster in another data
    # centre, which is a request that takes long enough to look broken and gets
    # retried, which starts it again.
    #
    # Now: everyone with the role, everyone of those who has already arranged
    # something, then one `bulk_write` for the rest.
    layouts = get_database()[LayoutModel.collection_name]
    ARRANGED = ("nav", "sidebar", "panes", "charts", "columns", "widgets")

    users = await get_database()[UserModel.collection_name].find(
        {"role": template.get("role")}, {"_id": 1},
    ).to_list(5000)
    user_ids = [str(u["_id"]) for u in users]

    # "Has arranged something" asked of the database rather than of every
    # document in turn: a layout row counts as theirs if any of those keys
    # holds a value.
    #
    # The emptiness list is spelled out rather than written `$ne: None`, and it
    # is spelled out to match Python's `any(existing.get(k) ...)` exactly —
    # every falsy thing that could sit in one of those keys, including the
    # empty dict a save that changed nothing leaves behind. Getting this
    # subtly wrong does not fail loudly: it silently overwrites the layout of
    # whichever people fall in the gap, which is precisely the "customise
    # feature you stop trusting" this endpoint's docstring is about.
    EMPTY = [None, {}, [], "", 0, False]
    own = await layouts.find(
        {"user_id": {"$in": user_ids},
         "$or": [{k: {"$nin": EMPTY}} for k in ARRANGED]},
        {"user_id": 1},
    ).to_list(len(user_ids) or 1)
    keep_theirs = {r["user_id"] for r in own}

    now = datetime.now(timezone.utc)
    writes = [
        UpdateOne(
            {"user_id": uid},
            {"$set": {**template["layout"], "user_id": uid, "updated_at": now},
             "$setOnInsert": {"created_at": now}},
            upsert=True,
        )
        for uid in user_ids if uid not in keep_theirs
    ]
    if writes:
        await layouts.bulk_write(writes, ordered=False)

    applied = len(writes)
    skipped = len(keep_theirs)

    await _templates().update_one(
        {"_id": template["_id"]},
        {"$set": {"applied_at": datetime.now(timezone.utc)}, "$inc": {"applied_count": applied}},
    )
    note = f"Applied to {applied} account(s)."
    if skipped:
        note += f" {skipped} kept their own layout."
    await record(
        me, "settings.org.template.apply", target=template_id,
        detail=f"Applied layout template '{template.get('name', '')}' to {template.get('role', '')}: {note}",
        request=request,
    )
    return ApplyResult(applied_count=applied, message=note)


@router.delete(
    "/layout-templates/{template_id}",
    response_model=MessageResponse,
    summary="Delete a layout template",
)
async def delete_template(
    template_id: str,
    request: Request,
    me: dict = Depends(require_feature(Feature.ORG_LAYOUT_TEMPLATES)),
):
    doc = await _templates().find_one_and_delete({"_id": to_object_id(template_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Template not found")
    await record(
        me, "settings.org.template.delete", target=template_id,
        detail=f"Deleted layout template '{doc.get('name', '')}' ({doc.get('role', '')})",
        request=request,
    )
    return MessageResponse(message="Deleted")


# --- org.custom_domain -------------------------------------------------------

@router.put("/domain", response_model=OrgSettings, summary="Claim a custom domain")
async def set_domain(
    payload: DomainUpdate,
    request: Request,
    me: dict = Depends(require_feature(Feature.ORG_CUSTOM_DOMAIN)),
):
    """Issues a verification token. The domain is NOT live until DNS proves
    ownership — anyone can type a domain they do not own."""
    if not payload.domain:
        doc = await _update_settings({
            "domain": "", "domain_status": OrgSettingsModel.DOMAIN_UNSET,
            "domain_token": "", "domain_checked_at": None,
        })
        await record(me, "settings.org.domain", target="org_settings",
                     detail="Cleared the custom domain", request=request)
        return OrgSettings(**OrgSettingsModel.to_response(doc))

    current = await _read_settings()
    # Keep the token if the domain has not changed, so a half-finished DNS
    # record does not have to be redone because someone re-saved the form.
    token = current.get("domain_token") if current.get("domain") == payload.domain else ""
    doc = await _update_settings({
        "domain": payload.domain,
        "domain_token": token or f"womsakhi-verify={secrets.token_urlsafe(24)}",
        "domain_status": OrgSettingsModel.DOMAIN_PENDING,
        "domain_checked_at": None,
    })
    await record(me, "settings.org.domain", target="org_settings",
                 detail=f"Claimed custom domain {payload.domain} (awaiting DNS)", request=request)
    return OrgSettings(**OrgSettingsModel.to_response(doc))


@router.post("/domain/verify", response_model=OrgSettings, summary="Check the DNS record")
async def verify_domain(
    request: Request,
    me: dict = Depends(require_feature(Feature.ORG_CUSTOM_DOMAIN)),
):
    """Looks for the token in a TXT record, for real.

    A "verified" flag that nothing checks is worse than no flag: it is a claim
    the product makes on its own. If DNS cannot be reached the state goes to
    `failed`, never to `verified`.
    """
    current = await _read_settings()
    domain, token = current.get("domain"), current.get("domain_token")
    if not domain or not token:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Set a domain first")

    found = False
    try:
        import dns.resolver

        answers = dns.resolver.resolve(domain, "TXT", lifetime=6)
        for record in answers:
            text = b"".join(record.strings).decode("utf-8", "ignore")
            if token in text:
                found = True
                break
    except Exception:
        # Missing record, NXDOMAIN, timeout — all mean "not proven".
        found = False

    doc = await _update_settings({
        "domain_status": (
            OrgSettingsModel.DOMAIN_VERIFIED if found else OrgSettingsModel.DOMAIN_FAILED
        ),
        "domain_checked_at": datetime.now(timezone.utc),
    })
    await record(me, "settings.org.domain.verify", target="org_settings",
                 detail=f"Checked DNS for {domain}: {'verified' if found else 'token not found'}",
                 request=request)
    return OrgSettings(**OrgSettingsModel.to_response(doc))
