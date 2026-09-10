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
    #: Which of the three lists this belongs in.
    #:
    #: "mine" is her own — a booking, a person she talks to, her own document.
    #: "app" is the catalogue everyone shares. "do" is an action rather than a
    #: destination. Searching used to return only the catalogue, so a woman
    #: looking for her own buyer got nothing at all and the box looked broken.
    group: str = "app"
    #: A figure worth showing beside the row — money, a count.
    amount: str = ""
    #: A short state word: "Paid", "Waiting", "Verified".
    tag: str = ""


class SearchAnswer(BaseModel):
    """
    A question answered outright, instead of a list of places to look.

    "How much did I earn this month" has one true answer and no useful list of
    links; giving her ten rows to click through is a failure dressed as a
    result.
    """

    label: str
    value: str
    detail: str
    href: str = ""
    action: str = ""


class SearchResults(BaseModel):
    query: str
    hits: list[SearchHit]
    #: Present only when the query is a question this can actually answer.
    answer: SearchAnswer | None = None
    #: How long the server spent, in milliseconds. Shown to her, so the claim
    #: that it is fast is checkable rather than decorative.
    took_ms: float = 0.0
