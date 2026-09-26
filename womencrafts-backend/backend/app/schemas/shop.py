"""Request and response shapes for her business."""

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

from app.models.shop import ListingModel
from app.core.media import MediaRef, MediaRefOptional


class ListingCard(BaseModel):
    """
    One thing for sale, as anyone who is not its owner sees it.

    The base of two responses that would otherwise be written twice and drift:
    `MarketListing` (a signed-in buyer browsing, which adds the seller and her
    tie to that buyer) and `PublicShop.listings` (a stranger on a shared link,
    who gets exactly this and nothing more). Deliberately without `status` and
    `views`: a buyer is only ever shown live listings, and how many people have
    looked at a thing is the seller's business.
    """

    id: str
    kind: str
    title: str
    desc: str
    #: MINOR units — paise, like every other amount in this API.
    price_minor: int
    #: Formatted once, server-side, and it carries the rate: "₹450 per piece".
    price_label: str
    rate: str
    #: None means "not something you count" — a service has no stock.
    stock: Optional[int] = None
    low_stock: bool
    out_of_stock: bool
    category: str
    place: str
    travels_km: int
    photo: str
    photos: list[str] = Field(default_factory=list)
    price_mode: Literal["fixed", "range", "quote"] = "fixed"
    price_high_minor: int = 0
    compare_at_minor: int = 0
    min_quantity: int = 1
    delivery: str = "physical"
    processing_time: str = ""
    ships_to: str = ""
    free_shipping: bool = False
    delivery_note: str = ""
    highlights: list[str] = []
    tags: list[str] = []
    quote_fields: list[str] = []
    quote_message: str = ""
    response_time: str = ""


class PublicShop(BaseModel):
    """
    A woman's shop as a stranger on a shared link sees it.

    **What is deliberately not here** is the whole design of it: no phone, no
    email, no address, no order history, no member id, no user id, and no
    surname. A first name, the trade and place she typed onto her own listings,
    and the things she has live. The link is shared into WhatsApp groups and
    forwarded on from there, so everything on this page has to survive reaching
    somebody she has never met.

    There is no way to pay from here, because this platform cannot take a
    payment without holding her money. Buying is arranged between her and the
    buyer directly.
    """

    handle: str
    #: Her first name. See above — this page reaches strangers.
    name: str
    #: The category most of her listings are in. Derived from them, not typed.
    trade: str
    #: The place she has written on her own listings, when they agree on one.
    place: str
    listings: list[ListingCard] = []
    listing_count: int


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
    photos: list[str] = Field(default_factory=list)
    price_mode: Literal["fixed", "range", "quote"] = "fixed"
    #: When she listed it, ISO. The audit table sorts on this.
    created_at: str = ""
    #: Orders this listing has actually had, counted from her orders.
    orders: int = 0
    price_high_minor: int = 0
    compare_at_minor: int = 0
    min_quantity: int = 1
    low_stock_at: int = 0
    continue_when_out: bool = False
    delivery: str = "physical"
    processing_time: str = ""
    ships_to: str = ""
    free_shipping: bool = False
    delivery_note: str = ""
    highlights: list[str] = []
    tags: list[str] = []
    quote_fields: list[str] = []
    quote_message: str = ""
    response_time: str = ""


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
    photo: MediaRef = Field("", max_length=400)
    photos: list[MediaRef] = Field(default_factory=list, max_length=4)
    status: str = Field("live", pattern="^(live|paused)$")
    price_mode: Literal["fixed", "range", "quote"] = "fixed"
    price_high_minor: int = Field(0, ge=0)
    compare_at_minor: int = Field(0, ge=0)
    min_quantity: int = Field(1, ge=1, le=9999)
    low_stock_at: int = Field(0, ge=0, le=1_000_000)
    continue_when_out: bool = False
    delivery: Literal["physical", "digital", "service"] = "physical"
    processing_time: str = Field("", max_length=80)
    ships_to: str = Field("", max_length=120)
    free_shipping: bool = False
    delivery_note: str = Field("", max_length=500)
    highlights: list[str] = Field(default_factory=list, max_length=6)
    tags: list[str] = Field(default_factory=list, max_length=12)
    quote_fields: list[str] = Field(default_factory=list, max_length=12)
    quote_message: str = Field("", max_length=300)
    response_time: str = Field("", max_length=80)


class OrderResponse(BaseModel):
    id: str
    #: Empty on an order nobody placed through the app — the seeded history.
    buyer_id: str = ""
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
    #: Her shop's handle — the bare slug, and nothing else. `/s/<handle>`
    #: resolves it and `GET /public/shop/<handle>` serves it. It used to be
    #: "womsakhi.in/<member_id>": a domain-and-path shape that matched no route
    #: in the app, so every link copied from the Collect screen was a 404
    #: arriving in a customer's chat under her name.
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


ShopOperationKind = Literal["preorder", "subscription", "slot", "wholesale", "live", "voice", "dispute"]
ShopOperationStatus = Literal["draft", "open", "waiting", "paid", "scheduled", "resolved", "paused"]


class ShopOperationCreate(BaseModel):
    kind: ShopOperationKind
    title: str = Field(..., min_length=2, max_length=120)
    contact: str = Field("", max_length=120)
    amount_minor: int = Field(0, ge=0, le=100_000_000)
    status: ShopOperationStatus = "draft"
    due_on: str = Field("", max_length=40)
    note: str = Field("", max_length=2000)
    details: dict[str, Any] = Field(default_factory=dict)


class ShopOperationUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=120)
    contact: Optional[str] = Field(None, max_length=120)
    amount_minor: Optional[int] = Field(None, ge=0, le=100_000_000)
    status: Optional[ShopOperationStatus] = None
    due_on: Optional[str] = Field(None, max_length=40)
    note: Optional[str] = Field(None, max_length=2000)
    details: Optional[dict[str, Any]] = None


class ShopOperationResponse(BaseModel):
    id: str
    kind: ShopOperationKind
    title: str
    contact: str
    amount_minor: int
    amount_label: str
    status: ShopOperationStatus
    due_on: str
    note: str
    details: dict[str, Any]
    archived: bool
    created_at: str
    updated_at: str
