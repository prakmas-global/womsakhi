"""Response shapes for search."""

from pydantic import BaseModel


class SearchHit(BaseModel):
    id: str
    kind: str
    title: str
    sub: str
    #: Where tapping it goes. Built here rather than on the phone so the route
    #: for a kind lives in one place and cannot drift between screens.
    href: str


class SearchResults(BaseModel):
    query: str
    hits: list[SearchHit]
