"""
The buyer's side of the market.

Deliberately a different shape from `ListingResponse` in `schemas/shop.py`,
which answers "what do I sell?". A buyer is not asking about an item, she is
asking about a *woman*: who she is, how close she is to me, whether anyone I
know has bought from her. So the seller is nested into every row rather than
left for the screen to fetch.

Every money field is an integer in the minor unit (paise), as everywhere else.
`price_label` is formatted server-side so the rate cannot get lost between
screens — "₹400" and "₹400 per piece" are different offers.
"""

from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.shop import ListingCard


class MarketSeller(BaseModel):
    """The woman selling it, and only what is actually known about her."""

    id: str
    name: str
    avatar: str = ""
    #: circle | bought-before | wider. How close she is to the buyer — this is
    #: what the ordering is built on, and it is computed, never stored.
    tie: str
    tie_label: str
    #: Orders she has finished. Counted from her order book, not claimed.
    orders_done: int
    #: Buyers who came back. The signal that replaces a star rating — harder to
    #: fake, and there from the very first repeat order.
    repeat_buyers: int
    #: Where she works from, when she has said. No distance: nothing in this
    #: database knows where either woman is, and "0.4 km" would be invented.
    place: str = ""


class MarketListing(ListingCard):
    """
    A listing plus who is selling it and what she is to this buyer.

    The thing itself is `ListingCard`, shared with the public shop page — one
    shape, two callers, so a field added for a buyer cannot quietly fail to
    reach a stranger on a shared link, or the other way round. Everything added
    here is about the VIEWER: her tie to the seller, whether women she knows
    have bought it, whether she has saved it. None of it means anything to a
    stranger, which is exactly why it is not in the base.
    """

    seller: MarketSeller
    #: Women in her circles who have ordered THIS listing. A real count from
    #: the order book — zero until someone she knows actually buys it.
    bought_by_circle: int
    #: Whether she has already bookmarked it, so the heart is right on the
    #: first paint rather than after a second request.
    saved: bool


class MyMarketOrder(BaseModel):
    """An order she placed, as the buyer sees it."""

    id: str
    listing_id: str
    title: str
    quantity: int
    total_minor: int
    total_label: str
    note: str
    state: str
    placed_on: str
    seller_id: str
    seller_name: str


class MarketListingDetail(MarketListing):
    #: Other things the same woman has live. Sent with the listing because the
    #: screen shows them and a second round trip for four rows is not worth it.
    also_hers: list[MarketListing] = []
    #: What this buyer has already ordered from this listing. This is what
    #: makes "Ordered" survive a reload instead of being a `useState` flag.
    my_orders: list[MyMarketOrder] = []
    #: Her thread with this seller, if one has been started.
    conversation_id: Optional[str] = None


class PlaceOrderRequest(BaseModel):
    quantity: int = Field(1, ge=1, le=99)
    note: str = Field("", max_length=500)


class PlacedOrder(BaseModel):
    """
    What the server actually did, for the screen to report back.

    `pay_directly` is not a flag the UI may ignore. WomSakhi takes no money for
    this order and holds none: the buyer pays the seller herself. The sentence
    to show is `pay_note`, written here so that no screen has to invent one.
    """

    order: MyMarketOrder
    seller_name: str
    pay_directly: bool = True
    pay_note: str


class AskRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)


class AskResult(BaseModel):
    """A message that exists. `conversation_id` is where it landed."""

    conversation_id: str
    delivered_to: str
    text: str
