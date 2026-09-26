from datetime import datetime, timezone

import pytest
from bson import ObjectId
from pydantic import ValidationError

from app.models.shop import ListingModel, ShopOperationModel
from app.schemas.shop import ListingCreate, ShopOperationCreate


def test_shop_operation_round_trip_uses_minor_units_and_safe_defaults():
    doc = ShopOperationModel.create_document(
        user_id="member-1", kind="preorder", title="  Six blouses  ",
        contact="  Meera  ", amount_minor=180000, status="waiting",
        due_on="2026-10-01", note="Cloth money",
    )
    doc["_id"] = ObjectId()
    out = ShopOperationModel.to_response(doc)
    assert out["title"] == "Six blouses"
    assert out["contact"] == "Meera"
    assert out["amount_label"] == "₹1,800"
    assert out["archived"] is False
    assert datetime.fromisoformat(out["created_at"]).tzinfo == timezone.utc


@pytest.mark.parametrize("kind", ShopOperationModel.KINDS)
def test_every_supported_shop_operation_kind_validates(kind: str):
    assert ShopOperationCreate(kind=kind, title="Valid title").kind == kind


def test_unknown_kind_and_negative_amount_are_rejected():
    with pytest.raises(ValidationError):
        ShopOperationCreate(kind="anything", title="Valid title")
    with pytest.raises(ValidationError):
        ShopOperationCreate(kind="slot", title="Valid title", amount_minor=-1)


def test_listing_merchandising_options_survive_round_trip():
    body = ListingCreate(
        kind="product", title="Festival blouses", price_minor=120000,
        price_high_minor=180000, compare_at_minor=200000, price_mode="range",
        min_quantity=2, stock=12, low_stock_at=4, continue_when_out=True,
        delivery="physical", processing_time="3–5 days", ships_to="India",
        free_shipping=True, delivery_note="Packed in cotton",
        highlights=["Handmade", "Custom fit"], tags=["blouse", "festival"],
        quote_fields=["needs", "when"], quote_message="Tell me your size",
        response_time="Within a day",
    )
    doc = ListingModel.create_document(user_id="u1", member_id="m1", **body.model_dump())
    doc["_id"] = ObjectId()
    out = ListingModel.to_response(doc)
    assert out["price_high_minor"] == 180000
    assert out["highlights"] == ["Handmade", "Custom fit"]
    assert out["min_quantity"] == 2
    assert out["low_stock_at"] == 4
    assert out["delivery_note"] == "Packed in cotton"
    assert out["quote_fields"] == ["needs", "when"]
