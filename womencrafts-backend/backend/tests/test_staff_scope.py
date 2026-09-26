from bson import ObjectId
from fastapi import HTTPException

from app.core.staff_scope import (
    combine_scope,
    member_in_scope,
    normalise_scope,
    require_member_in_scope,
    scope_for,
)


def test_scope_normalises_and_deduplicates_values():
    scope = normalise_scope({
        "mode": "assigned",
        "regions": [" Jaipur ", "Jaipur", ""],
        "categories": ["Artisan"],
    })
    assert scope["regions"] == ["Jaipur"]
    assert scope["categories"] == ["Artisan"]
    assert scope["member_ids"] == []


def test_super_admin_scope_is_always_platform_wide():
    assert scope_for({"role": "Super Admin", "staff_scope": {"mode": "assigned"}})["mode"] == "all"


def test_assigned_scope_matches_region_category_or_named_member():
    named = str(ObjectId())
    user = {"role": "Regional Admin", "staff_scope": {
        "mode": "assigned",
        "regions": ["Jaipur"],
        "categories": ["Artisan"],
        "member_ids": [named],
    }}
    assert member_in_scope({"_id": ObjectId(), "location": "Jaipur"}, user)
    assert member_in_scope({"_id": ObjectId(), "segment": "Artisan"}, user)
    assert member_in_scope({"_id": ObjectId(named)}, user)
    assert not member_in_scope({"_id": ObjectId(), "location": "Pune", "segment": "Student"}, user)


def test_empty_assigned_scope_matches_no_records_and_hides_member():
    user = {"role": "Admin", "staff_scope": {"mode": "assigned"}}
    assert combine_scope({"status": "Active"}, user) == {
        "$and": [{"status": "Active"}, {"_id": {"$exists": False}}]
    }
    try:
        require_member_in_scope({"_id": ObjectId()}, user)
    except HTTPException as exc:
        assert exc.status_code == 404
    else:
        raise AssertionError("out-of-scope member should be hidden")
