"""
The organisation running this installation.

One document, never more. WomSakhi is licensed per organisation — another NGO
runs its own copy with its own logo, its own starting palette and its own layout
templates — so "the organisation" is a singleton, not a collection of tenants.
Multi-tenancy would be a different product and a different data model; pretending
this row is one tenant of many would be the expensive kind of wrong.

Everything here sits behind the `org.*` entitlements
([[ADR-001 Everything personal is free]]): personal customisation is free, and
this is the tier a licence fee would actually buy.

**Nothing here overrides a personal choice.** The org default theme is what a
member sees before she picks one; a layout template is what a role starts from.
A woman who has chosen her own palette keeps it. That direction is deliberate —
an organisation that can silently restyle someone's accessibility settings is a
worse product than one that cannot.
"""

from datetime import datetime, timezone
from typing import Optional


def _now() -> datetime:
    return datetime.now(timezone.utc)


class OrgSettingsModel:
    collection_name = "org_settings"

    # Domain verification states. `pending` means we have issued a token and
    # not yet seen it in DNS — never treat it as verified.
    DOMAIN_UNSET = "unset"
    DOMAIN_PENDING = "pending"
    DOMAIN_VERIFIED = "verified"
    DOMAIN_FAILED = "failed"

    @staticmethod
    def create_document() -> dict:
        return {
            "singleton": True,          # the unique index this collection carries
            # org.branding
            "name": "",
            "logo": "",                 # media URL, from POST /uploads
            "wordmark": "",
            # org.default_theme — the palette a member starts from
            "default_theme_id": "",
            # The colours come with the id. The preset palette lives in
            # theme-engine/presets.ts; copying it here would be a second source
            # of truth that drifts the first time a preset is retuned.
            "default_primary": "",
            "default_secondary": "",
            "default_mode": "",         # "", "light" or "dark"
            # org.custom_domain
            "domain": "",
            "domain_status": OrgSettingsModel.DOMAIN_UNSET,
            "domain_token": "",
            "domain_checked_at": None,
            "created_at": _now(),
            "updated_at": _now(),
        }

    @staticmethod
    def to_response(doc: Optional[dict]) -> dict:
        doc = doc or {}
        return {
            "name": doc.get("name", ""),
            "logo": doc.get("logo", ""),
            "wordmark": doc.get("wordmark", ""),
            "default_theme_id": doc.get("default_theme_id", ""),
            "default_primary": doc.get("default_primary", ""),
            "default_secondary": doc.get("default_secondary", ""),
            "default_mode": doc.get("default_mode", ""),
            "domain": doc.get("domain", ""),
            "domain_status": doc.get("domain_status", OrgSettingsModel.DOMAIN_UNSET),
            "domain_token": doc.get("domain_token", ""),
            "domain_checked_at": doc.get("domain_checked_at"),
            "updated_at": doc.get("updated_at"),
        }


class LayoutTemplateModel:
    """A saved layout an admin can push to everyone holding a role.

    Stored as its own collection rather than an array on the settings document:
    templates are listed, added and removed independently, and an array field
    that grows without bound is a document-size problem waiting to happen.
    """

    collection_name = "org_layout_templates"

    @staticmethod
    def create_document(*, name: str, role: str, app: str, layout: dict, created_by: str) -> dict:
        return {
            "name": name.strip() or "Untitled template",
            "role": role,               # which role receives it
            "app": app,                 # "staff" | "member"
            "layout": layout,           # the same shape /layout/me returns
            "created_by": created_by,
            "applied_at": None,
            "applied_count": 0,
            "created_at": _now(),
            "updated_at": _now(),
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        return {
            "id": str(doc["_id"]),
            "name": doc.get("name", ""),
            "role": doc.get("role", ""),
            "app": doc.get("app", "staff"),
            "applied_at": doc.get("applied_at"),
            "applied_count": int(doc.get("applied_count") or 0),
            "created_at": doc.get("created_at"),
        }
