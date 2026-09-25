"""Listing photos and drafts survive the API/model boundary."""

from bson import ObjectId
import pytest
from pydantic import ValidationError

from app.models.shop import ListingModel
from app.schemas.shop import ListingCard, ListingCreate, ListingResponse
from app.routes import market
from app.schemas.market import PlaceOrderRequest
from fastapi import HTTPException
from unittest.mock import AsyncMock
import asyncio


def test_draft_is_created_paused_with_gallery():
    body = ListingCreate(kind="product", title="Handmade bag", status="paused",
                         photos=["http://localhost:8020/media/attachment/bag.png"])
    doc = ListingModel.create_document(user_id="seller", member_id="member", **body.model_dump())
    doc["_id"] = ObjectId()
    assert doc["status"] == "paused"
    assert doc["photo"] == "media/attachment/bag.png"
    assert doc["photos"] == [doc["photo"]]
    response = ListingModel.to_response(doc)
    assert ListingResponse(**response).photos == [response["photo"]]
    assert ListingCard(**response).photos == [response["photo"]]


def test_existing_editor_does_not_reset_unprovided_fields():
    body = ListingCreate(kind="product", title="Handmade bag", price_minor=25000)
    changes = body.model_dump(exclude_unset=True)
    assert "status" not in changes
    assert "photos" not in changes
    assert "category" not in changes


@pytest.mark.parametrize("changes", [{"status": "unknown"}, {"photos": ["media/a.png"] * 5}])
def test_invalid_listing_options_are_rejected(changes):
    with pytest.raises(ValidationError):
        ListingCreate(kind="product", title="Handmade bag", **changes)


@pytest.mark.parametrize("mode", ["quote", "range"])
def test_quote_order_is_rejected_before_stock_mutation(monkeypatch, mode):
    collection = AsyncMock()
    collection.find_one.return_value = {
        "status": "live", "user_id": "seller", "price_mode": mode, "stock": 2,
    }
    monkeypatch.setattr(market, "_listings", lambda: collection)
    with pytest.raises(HTTPException) as error:
        asyncio.run(market._place_order(str(ObjectId()), PlaceOrderRequest(quantity=1), {"_id": "buyer"}))
    assert error.value.status_code == 409
    collection.find_one_and_update.assert_not_awaited()


def test_quote_label_is_not_zero_rupees():
    response = ListingModel.to_response({"_id": ObjectId(), "price_mode": "quote", "price_minor": 0})
    assert response["price_label"] == "By quote"
