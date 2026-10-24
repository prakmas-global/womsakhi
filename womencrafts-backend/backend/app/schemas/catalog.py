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
    #: What is actually in this course. Empty for every seeded programme, and
    #: the detail screen hides its "What is in it" section when it is — rather
    #: than showing one hardcoded digital-marketing syllabus for every course
    #: in the catalogue, which is what it did before.
    curriculum: list[dict] = []
    #: Who teaches it and what it costs (0 = free). A member's paid course is
    #: paid to her by UPI; the catalogue never shows her UPI id.
    owner_kind: str = "staff"
    owner_id: str = ""
    teacher_name: str = "WomSakhi team"
    price_minor: int = 0
    # member-specific extras
    joined: bool = False
    #: "" | pending | active | completed | withdrawn — her enrolment, if any.
    my_status: str = ""
    is_mine: bool = False
    seats_left: Optional[int] = None
    is_full: bool = False
