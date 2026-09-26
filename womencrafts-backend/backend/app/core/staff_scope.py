"""Server-side record scopes for staff accounts."""

from fastapi import HTTPException, status

from app.core.rbac import SUPER_ADMIN, role_name

SCOPE_ALL = "all"
SCOPE_ASSIGNED = "assigned"


def normalise_scope(value: dict | None) -> dict:
    raw = value or {}

    def strings(key: str) -> list[str]:
        return sorted({str(v).strip() for v in (raw.get(key) or []) if str(v).strip()})

    mode = raw.get("mode") if raw.get("mode") in (SCOPE_ALL, SCOPE_ASSIGNED) else SCOPE_ALL
    return {
        "mode": mode,
        "regions": strings("regions"),
        "categories": strings("categories"),
        "organizations": strings("organizations"),
        "communities": strings("communities"),
        "member_ids": strings("member_ids"),
    }


def scope_for(user: dict) -> dict:
    if role_name(user) == SUPER_ADMIN:
        return normalise_scope({"mode": SCOPE_ALL})
    return normalise_scope(user.get("staff_scope"))


def member_scope_query(user: dict) -> dict:
    """Return the Mongo predicate for member records visible to ``user``."""
    scope = scope_for(user)
    if scope["mode"] == SCOPE_ALL:
        return {}

    alternatives: list[dict] = []
    if scope["member_ids"]:
        from bson import ObjectId
        ids = [ObjectId(v) for v in scope["member_ids"] if ObjectId.is_valid(v)]
        if ids:
            alternatives.append({"_id": {"$in": ids}})
    if scope["regions"]:
        alternatives.append({"location": {"$in": scope["regions"]}})
    if scope["categories"]:
        alternatives.append({"segment": {"$in": scope["categories"]}})
    if scope["organizations"]:
        alternatives.append({"organization": {"$in": scope["organizations"]}})
    if scope["communities"]:
        alternatives.append({"community_ids": {"$in": scope["communities"]}})
    return {"$or": alternatives} if alternatives else {"_id": {"$exists": False}}


def combine_scope(query: dict, user: dict) -> dict:
    scoped = member_scope_query(user)
    if not scoped:
        return query
    if not query:
        return scoped
    return {"$and": [query, scoped]}


def member_in_scope(member: dict, user: dict) -> bool:
    scope = scope_for(user)
    if scope["mode"] == SCOPE_ALL:
        return True
    return bool(
        str(member.get("_id", "")) in scope["member_ids"]
        or member.get("location") in scope["regions"]
        or member.get("segment") in scope["categories"]
        or member.get("organization") in scope["organizations"]
        or set(member.get("community_ids") or []) & set(scope["communities"])
    )


def require_member_in_scope(member: dict, user: dict) -> None:
    if not member_in_scope(member, user):
        # Do not reveal that an out-of-scope member exists.
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
