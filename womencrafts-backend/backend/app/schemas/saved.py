"""Request and response shapes for saved items."""

from pydantic import BaseModel, Field

from app.models.saved import SavedModel


class SaveRequest(BaseModel):
    kind: str = Field(..., description=" | ".join(SavedModel.KINDS))
    ref_id: str = Field(..., min_length=1, max_length=64)


class SavedResponse(BaseModel):
    id: str
    kind: str
    ref_id: str
    gone: bool
    title: str
    sub: str
    #: Where to open it, when its own id is not its address. Empty for every
    #: kind whose route is `/<section>/<ref_id>`; set for a circle post, which
    #: lives inside a circle rather than at a page of its own.
    href: str = ""
    saved_on: str
