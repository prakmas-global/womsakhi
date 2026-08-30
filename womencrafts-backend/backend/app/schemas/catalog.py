from typing import Optional

from pydantic import BaseModel


class CatalogService(BaseModel):
    id: str
    name: str
    type: str
    tone: str
    #: A stable per-category number the UI uses to keep a service's colour and
    #: position from reshuffling between loads. `ServiceModel.to_response` sends
    #: it; there was no slot here, so it was dropped on the way out.
    slot: int = 0
    icon: str
    duration: str
    price: str
    status: str
    bookings: int
    rating: str
    description: str


class CatalogProgram(BaseModel):
    id: str
    name: str
    desc: str
    category: str
    cat_tone: str
    mode: str
    duration: str
    dates: str
    days: str
    enrolled: int
    cap: int
    pct: int
    status: str
    note: str
    bar: str
    # member-specific extras
    joined: bool = False
    seats_left: Optional[int] = None
    is_full: bool = False
