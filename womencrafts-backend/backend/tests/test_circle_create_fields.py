from bson import ObjectId
from pydantic import ValidationError
import pytest

from app.models.community import CircleModel
from app.schemas.community import CircleCreate, CircleResourceCreate


def test_circle_settings_and_visuals_round_trip():
    body = CircleCreate(
        name="Women who make", topic="Craft", desc="A useful circle description",
        is_private=True, cover="/media/cover.webp", icon="/media/icon.webp",
        tags=["craft", "business"], guidelines="Be kind", who_posts="hosts",
        review_first=True, tell_me=False, invites=["Meera", "+919876543210"],
    )
    doc = CircleModel.create_document(
        name=body.name, topic=body.topic, desc=body.desc, cover=body.cover,
        icon=body.icon, tags=body.tags, guidelines=body.guidelines,
        who_posts=body.who_posts, review_first=body.review_first,
        tell_me=body.tell_me, is_private=body.is_private,
    )
    doc["_id"] = ObjectId()
    doc["invite_count"] = len(body.invites)
    out = CircleModel.to_response(doc, True)
    assert out["is_private"] is True
    assert out["tags"] == ["craft", "business"]
    assert out["who_posts"] == "hosts"
    assert out["review_first"] is True
    assert out["tell_me"] is False
    assert out["invite_count"] == 2


def test_circle_rejects_too_many_tags_and_unknown_post_policy():
    with pytest.raises(ValidationError):
        CircleCreate(name="Circle", tags=["1", "2", "3", "4", "5", "6"])
    with pytest.raises(ValidationError):
        CircleCreate(name="Circle", who_posts="nobody")


def test_circle_resource_requires_a_web_link():
    assert CircleResourceCreate(name="Pricing guide", url="https://example.com/guide").url.startswith("https://")
    with pytest.raises(ValidationError):
        CircleResourceCreate(name="Pricing guide", url="javascript:alert(1)")
