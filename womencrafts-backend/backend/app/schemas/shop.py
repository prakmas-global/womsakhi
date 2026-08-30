"""Request and response shapes for her business."""

from typing import Optional

from pydantic import BaseModel, Field

from app.models.shop import ListingModel


class ListingResponse(BaseModel):
    id: str
    kind: str
    title: str
    desc: str
    price_minor: int
    price_label: str
    rate: str
    #: None means "not something you count" — a service has no stock, and zero
    #: would render a tailor's listing as out of stock.
    stock: Optional[int] = None
    low_stock: bool
    out_of_stock: bool
    category: str
    place: str
    travels_km: int
    photo: str
    status: str
    views: int


class ListingCreate(BaseModel):
    kind: str = Field(..., description=f"{ListingModel.KIND_PRODUCT} | {ListingModel.KIND_SERVICE}")
    title: str = Field(..., min_length=2, max_length=120)
    desc: str = Field("", max_length=2000)
    price_minor: int = Field(0, ge=0)
    rate: str = Field("", description=" | ".join(ListingModel.RATES))
    stock: Optional[int] = Field(None, ge=0)
    category: str = Field("", max_length=60)
    place: str = Field("", max_length=120)
    travels_km: int = Field(0, ge=0, le=200)
    photo: str = Field("", max_length=400)


class OrderResponse(BaseModel):
    id: str
    buyer_name: str
    listing_id: str
    title: str
    quantity: int
    total_minor: int
    total_label: str
    note: str
    state: str
    next_state: Optional[str] = None
    needs_her: bool
    placed_on: str


class ReviewResponse(BaseModel):
    id: str
    who: str
    stars: int
    text: str
    what: str
    reply: str
    when: str


class ReplyRequest(BaseModel):
    reply: str = Field(..., min_length=1, max_length=800)


class ShopSummary(BaseModel):
    """Everything the My Business screen needs, in one request."""

    name: str
    handle: str
    rating: float
    review_count: int
    #: Orders waiting on her — the question she opens the screen with.
    needs_her: int
    month_minor: int
    last_month_minor: int
    listings: int
    week_orders: list[int]
    #: Share of her buyers who came back. A real number from her own orders —
    #: and the single best signal that what she makes is worth returning for.
    repeat_buyers_pct: int
